'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, Clock, Loader2, Wallet } from 'lucide-react';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    createBooking,
    initiateBookingPayment,
    PaymentPath,
    verifyBookingPayment,
} from '@/features/bookedService/bookedServiceSlice';
import { fetchAllCustomers } from '@/features/customer/customerSlice';
import type { Customer } from '@/features/customer/customerSlice';
import {
    ADMIN_BOOKER,
    isAdminBookerCustomer,
} from '@/lib/admin-booker-customer';
import { fetchServices } from '@/features/service/approveServicesSlice';
import { fetchCoupons, type Coupon } from '@/features/coupon/couponSlice';
import { fetchCategories } from '@/features/category/categorySlice';
import { fetchSubCategories } from '@/features/subcategory/subcategorySlice';
import { computeBookingAmounts, resolveServiceUnitPrice } from '@/lib/booking-pricing';
import { BOOKING_PAYMENT_STATUS, resolveInitialBookingStatus } from '@/lib/booking-status';
import {
    buildChapaStep1TableWrites,
    buildChapaStep2TableWrites,
    buildChapaStep3TableWrites,
    type ChapaDebugFormContext,
    type TableWritePreview,
} from '@/lib/booking-chapa-debug-preview';
import { formatCouponDiscountLabel, formatCouponSelectDescription, formatCouponSelectLabel } from '@/lib/coupon-format';
import { formatServiceDiscountLabel } from '@/lib/service-discount';
import { formatBookingAmount } from '@/lib/booking-display';
import { BOOKING_FIELD_LIMITS, clampBookingQuantity, bookingSecurePhoneError, bookingSecureQuantityError, bookingSecureTextError } from '@/lib/booking-field-limits';
import { distanceKm, parseProviderLocation, type ProviderAddressValue } from '@/lib/provider-location';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';
import { ProviderAddressPicker } from '@/components/ProviderAddressPicker';
import { useIsLocalhost } from '@/hooks/use-is-localhost';

interface BookingServiceRow {
    id: string;
    provider_id?: string;
    providerName?: string;
    providerLocation?: Record<string, unknown> | null;
    location?: Record<string, unknown> | null;
    categoryId?: string;
    subCategoryId?: string;
    serviceName?: string;
    name?: string;
    price?: string | number;
    discount?: string;
    serviceImage?: string | string[];
    status?: boolean;
    approved?: boolean;
    isArchived?: boolean;
}

type WizardStep = 'details' | 'payment_path' | 'chapa' | 'success';

interface ChapaDebugTrace {
    createRequest: Record<string, unknown>;
    createTableWrites: ReturnType<typeof buildChapaStep1TableWrites>;
    createResponse?: Record<string, unknown>;
    paymentRequest?: Record<string, unknown>;
    paymentTableWrites?: ReturnType<typeof buildChapaStep2TableWrites>;
    paymentResponse?: Record<string, unknown>;
    capturedAt?: string;
}

function resolveApiPaymentMode(path: PaymentPath): 'pay_later' | 'chapa' | 'wallet' | 'mark_paid' {
    if (path === 'pay_now') return 'chapa';
    if (path === 'wallet') return 'wallet';
    if (path === 'mark_paid') return 'mark_paid';
    return 'pay_later';
}

const CHAPA_CREATE_BOOKING_TABLES = {
    read: ['service', 'customer', 'coupon', 'app_settings'],
    write: ['booked_service', 'notification'],
    note: 'Provider SMS/notification skipped until Chapa payment completes.',
} as const;

const CHAPA_INIT_PAYMENT_TABLES = {
    read: ['booked_service', 'app_settings'],
    write: ['booked_service', 'payments'],
    external: ['Chapa API (transaction/initialize)'],
} as const;

const CHAPA_VERIFY_PAYMENT_TABLES = {
    read: ['booked_service', 'payments'],
    write: ['booked_service', 'payments', 'notification'],
    external: ['Chapa API (transaction/verify)'],
    note: 'Provider SMS + notification sent after payment_completed.',
} as const;

function buildChapaDebugFormContext(
    providerId: string,
    serviceId: string,
    customerId: string,
    selectedService: BookingServiceRow | undefined,
    selectedCustomer: Customer | undefined,
    bookingDate: string,
    quantity: string,
    description: string,
    address: string,
    locality: string,
    landmark: string,
    selectedCoupon: Coupon | null,
    priceSummary: ReturnType<typeof computeBookingAmounts> | null,
    unitPrice: number
): ChapaDebugFormContext | null {
    if (!selectedService || !selectedCustomer || !priceSummary) return null;

    const qty = parseInt(quantity, 10);

    return {
        providerId,
        serviceId,
        customerId,
        customerFirstName: selectedCustomer.first_name || '',
        customerLastName: selectedCustomer.last_name || '',
        customerEmail: selectedCustomer.email || '',
        customerPhone: customerPhone(selectedCustomer),
        serviceName: serviceLabel(selectedService),
        serviceImage: Array.isArray(selectedService.serviceImage)
            ? selectedService.serviceImage[0] ?? ''
            : (selectedService.serviceImage ?? ''),
        unitPrice,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        bookingDateIso: bookingDate ? new Date(bookingDate).toISOString() : new Date().toISOString(),
        description: description.trim(),
        bookingAddress: {
            address: address.trim(),
            locality: locality.trim(),
            landmark: landmark.trim() || undefined,
        },
        couponSnapshot: selectedCoupon ? (selectedCoupon as unknown as Record<string, unknown>) : null,
        subTotal: priceSummary.subTotal,
        totalAmount: priceSummary.totalAmount,
        discount: selectedService.discount,
    };
}

function TableWritesDebugBlock({ writes }: { writes: TableWritePreview[] }) {
    if (!writes.length) return null;

    return (
        <div className="space-y-2">
            <div className="text-[13px] font-semibold text-card-foreground">Table writes</div>
            {writes.map((write, index) => (
                <div
                    key={`${write.table}-${write.operation}-${index}`}
                    className="rounded-md border border-border bg-background p-3"
                >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]">
                        <span className="font-semibold text-primary">{write.table}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase">
                            {write.operation}
                        </span>
                        {write.skipped && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                                skipped
                            </span>
                        )}
                    </div>
                    {write.skip_reason && (
                        <p className="mb-2 text-[11px] text-amber-700">{write.skip_reason}</p>
                    )}
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {JSON.stringify(write.rows ?? write.fields ?? {}, null, 2)}
                    </pre>
                </div>
            ))}
        </div>
    );
}

function DebugJsonBlock({ title, value }: { title: string; value: unknown }) {
    return (
        <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-1.5 text-[13px] font-semibold text-card-foreground">{title}</div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-muted-foreground">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}

interface CreateBookingModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

function customerPhone(customer: Customer): string {
    return customer.phoneNumber || customer.mobile_number || customer.phone || '';
}

function customerWalletLabel(customer: Customer): string {
    const amount = Number(customer.wallet_amount ?? 0);
    const value = Number.isFinite(amount) ? amount : 0;
    return `Wallet ${formatBookingAmount(value)}`;
}

/** Normalize ET phone to 09xxxxxxxx / 07xxxxxxxx for Chapa. */
function normalizeChapaPhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('07'))) return digits;
    if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) return `0${digits}`;
    if (digits.length === 12 && digits.startsWith('251') && (digits[3] === '9' || digits[3] === '7')) {
        return `0${digits.slice(3)}`;
    }
    return null;
}

function customerName(customer: Customer): string {
    const first = customer.first_name || '';
    const last = customer.last_name || '';
    return [first, last].filter(Boolean).join(' ').trim() || 'Unnamed';
}

function customerLabel(customer: Customer): string {
    const name = customerName(customer);
    const email = customer.email || '';
    const phone = customerPhone(customer);
    return [name, email, phone].filter(Boolean).join(' · ');
}

function serviceLabel(service: BookingServiceRow): string {
    return service.serviceName || service.name || service.id;
}

function isServiceSelectable(service: BookingServiceRow): boolean {
    if (service.isArchived === true) return false;
    if (service.status === false) return false;
    if (!service.provider_id) return false;
    return true;
}

function serviceCoords(service: BookingServiceRow): { latitude: number; longitude: number } | null {
    const fromService = parseProviderLocation(service.location);
    if (
        typeof fromService.latitude === 'number' &&
        typeof fromService.longitude === 'number'
    ) {
        return { latitude: fromService.latitude, longitude: fromService.longitude };
    }
    const fromProvider = parseProviderLocation(service.providerLocation);
    if (
        typeof fromProvider.latitude === 'number' &&
        typeof fromProvider.longitude === 'number'
    ) {
        return { latitude: fromProvider.latitude, longitude: fromProvider.longitude };
    }
    return null;
}

function isCouponSelectable(coupon: Coupon): boolean {
    if (coupon.active === false) return false;
    if (coupon.expiredAt) {
        const expires = new Date(coupon.expiredAt);
        if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) return false;
    }
    return Boolean(coupon.code);
}

export function CreateBookingModal({ open, onClose, onCreated }: CreateBookingModalProps) {
    const dispatch = useAppDispatch();
    const isLocalhost = useIsLocalhost();
    const { customers, loading: customersLoading } = useAppSelector((state) => state.customer);
    const { services: allServicesRaw, loading: servicesLoading } = useAppSelector((state) => state.approveServices);
    const { coupons, loading: couponsLoading } = useAppSelector((state) => state.coupon);
    const { categories, loading: categoriesLoading } = useAppSelector((state) => state.category);
    const { subCategories, loading: subCategoriesLoading } = useAppSelector((state) => state.subcategory);

    const [step, setStep] = useState<WizardStep>('details');
    const [categoryId, setCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState('');
    const [providerId, setProviderId] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [description, setDescription] = useState('');
    const [customerAddress, setCustomerAddress] = useState<ProviderAddressValue>({
        address: '',
        latitude: null,
        longitude: null,
    });
    const [locality, setLocality] = useState('');
    const [landmark, setLandmark] = useState('');
    const [couponId, setCouponId] = useState('');
    const [unitPriceInput, setUnitPriceInput] = useState('');
    const [paymentPath, setPaymentPath] = useState<PaymentPath>('pay_later');
    const [chapaPhone, setChapaPhone] = useState('');
    const [createdBookingId, setCreatedBookingId] = useState('');
    const [chapaCheckoutUrl, setChapaCheckoutUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [chapaDebugTrace, setChapaDebugTrace] = useState<ChapaDebugTrace | null>(null);
    const [showChapaDebug, setShowChapaDebug] = useState(true);
    const [autoVerifyStatus, setAutoVerifyStatus] = useState<string | null>(null);
    const verifyInFlightRef = useRef(false);

    const isChapaPendingError = useCallback((message: string) => {
        const normalized = message.toLowerCase();
        return normalized.includes('not yet confirmed') || normalized.includes('payment not yet');
    }, []);

    const runPaymentVerify = useCallback(async (options?: { auto?: boolean }) => {
        if (!createdBookingId || verifyInFlightRef.current) return;

        verifyInFlightRef.current = true;
        if (options?.auto) {
            setAutoVerifyStatus('Checking payment with Chapa…');
        } else {
            setLoading(true);
            setError(null);
            setAutoVerifyStatus(null);
        }

        try {
            await dispatch(verifyBookingPayment({ bookingId: createdBookingId })).unwrap();
            setAutoVerifyStatus(null);
            setSuccessMessage('Booking created and payment confirmed.');
            setStep('success');
            onCreated();
        } catch (err: unknown) {
            const message = typeof err === 'string' ? err : 'Payment verification failed';
            if (options?.auto && isChapaPendingError(message)) {
                setAutoVerifyStatus('Waiting for Chapa confirmation… return here after paying.');
            } else {
                setAutoVerifyStatus(null);
                setError(message);
            }
        } finally {
            verifyInFlightRef.current = false;
            if (!options?.auto) setLoading(false);
        }
    }, [createdBookingId, dispatch, isChapaPendingError, onCreated]);

    useEffect(() => {
        if (!open || step !== 'chapa' || !createdBookingId) {
            setAutoVerifyStatus(null);
            return;
        }

        let cancelled = false;

        function tryAutoVerify() {
            if (cancelled) return;
            void runPaymentVerify({ auto: true });
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') tryAutoVerify();
        }

        window.addEventListener('focus', tryAutoVerify);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const initialTimer = window.setTimeout(tryAutoVerify, 2000);
        const intervalTimer = window.setInterval(tryAutoVerify, 5000);

        return () => {
            cancelled = true;
            window.removeEventListener('focus', tryAutoVerify);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearTimeout(initialTimer);
            window.clearInterval(intervalTimer);
        };
    }, [open, step, createdBookingId, runPaymentVerify]);

    useEffect(() => {
        if (!open) return;
        dispatch(fetchServices());
        dispatch(fetchCoupons());
        dispatch(fetchCategories());
        dispatch(fetchSubCategories());

        let cancelled = false;
        void (async () => {
            try {
                await fetch('/api/admin/customers/admin-booker');
            } catch {
                // list still loads; create will fail clearly if ensure never ran
            }
            if (!cancelled) dispatch(fetchAllCustomers());
        })();

        return () => {
            cancelled = true;
        };
    }, [dispatch, open]);

    useEffect(() => {
        if (!open) return;
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setBookingDate(now.toISOString().slice(0, 16));
    }, [open]);

    const allServices = useMemo(
        () => (allServicesRaw as BookingServiceRow[]).filter((service) => Boolean(service.id)),
        [allServicesRaw]
    );

    const activeCustomers = useMemo(
        () => customers.filter((customer) => !customer.archived_at),
        [customers]
    );

    const selectableServices = useMemo(
        () => allServices.filter(isServiceSelectable),
        [allServices]
    );

    const categoryFilteredServices = useMemo(() => {
        if (!categoryId || !subCategoryId) return [];
        return selectableServices.filter(
            (service) =>
                service.categoryId === categoryId && service.subCategoryId === subCategoryId
        );
    }, [selectableServices, categoryId, subCategoryId]);

    const servicesForSelect = useMemo(() => {
        const customerLat = customerAddress.latitude;
        const customerLng = customerAddress.longitude;
        const hasCustomerCoords =
            typeof customerLat === 'number' &&
            typeof customerLng === 'number' &&
            Number.isFinite(customerLat) &&
            Number.isFinite(customerLng);

        if (!hasCustomerCoords) return categoryFilteredServices;

        return [...categoryFilteredServices].sort((a, b) => {
            const aCoords = serviceCoords(a);
            const bCoords = serviceCoords(b);
            if (!aCoords && !bCoords) return 0;
            if (!aCoords) return 1;
            if (!bCoords) return -1;
            return (
                distanceKm(customerLat, customerLng, aCoords.latitude, aCoords.longitude) -
                distanceKm(customerLat, customerLng, bCoords.latitude, bCoords.longitude)
            );
        });
    }, [categoryFilteredServices, customerAddress.latitude, customerAddress.longitude]);

    const activeCoupons = useMemo(
        () => coupons.filter(isCouponSelectable),
        [coupons]
    );

    const selectedService = useMemo(
        () => servicesForSelect.find((service) => service.id === serviceId),
        [servicesForSelect, serviceId]
    );

    useEffect(() => {
        if (!serviceId) return;
        if (servicesForSelect.some((service) => service.id === serviceId)) return;
        setServiceId('');
        setProviderId('');
        setUnitPriceInput('');
    }, [servicesForSelect, serviceId]);

    const selectedProviderName = selectedService?.providerName || selectedService?.provider_id || '';

    const selectedCustomer = useMemo(
        () => activeCustomers.find((customer) => customer.id === customerId),
        [activeCustomers, customerId]
    );

    const isAdminBooker = isAdminBookerCustomer(selectedCustomer);

    const selectedCoupon = useMemo(
        () => activeCoupons.find((coupon) => String(coupon.id) === couponId) ?? null,
        [activeCoupons, couponId]
    );

    const priceSummary = useMemo(() => {
        if (!selectedService) return null;
        const unitPrice = resolveServiceUnitPrice(unitPriceInput);
        if (unitPrice <= 0) return null;
        const qty = parseInt(quantity, 10);
        return computeBookingAmounts(
            unitPrice,
            selectedService.discount,
            Number.isFinite(qty) && qty > 0 ? qty : 1,
            selectedCoupon
        );
    }, [selectedService, quantity, selectedCoupon, unitPriceInput]);

    const catalogUnitPrice = selectedService
        ? resolveServiceUnitPrice(selectedService.price)
        : 0;
    const resolvedUnitPrice = resolveServiceUnitPrice(unitPriceInput);
    const priceIsCustom =
        selectedService != null &&
        Number.isFinite(resolvedUnitPrice) &&
        resolvedUnitPrice > 0 &&
        Math.abs(resolvedUnitPrice - catalogUnitPrice) > 0.0001;

    const customerWalletBalance = selectedCustomer?.wallet_amount ?? 0;
    const walletCanCover =
        priceSummary !== null && customerWalletBalance >= priceSummary.totalAmount;
    const walletInsufficient = paymentPath === 'wallet' && priceSummary !== null && !walletCanCover;
    const chapaPhoneNormalized = normalizeChapaPhone(chapaPhone);
    const chapaPhoneInvalid = paymentPath === 'pay_now' && !chapaPhoneNormalized;

    const categoryOptions = useMemo<SearchSelectOption[]>(
        () =>
            categories
                .filter((category) => category.active !== false)
                .map((category) => ({
                    value: category.id,
                    label: category.categoryName,
                })),
        [categories]
    );

    const subCategoryOptions = useMemo<SearchSelectOption[]>(
        () =>
            subCategories
                .filter((sub) => sub.categoryId === categoryId)
                .map((sub) => ({
                    value: sub.id,
                    label: sub.subCategoryName,
                })),
        [subCategories, categoryId]
    );

    const serviceOptions = useMemo<SearchSelectOption[]>(
        () => {
            const customerLat = customerAddress.latitude;
            const customerLng = customerAddress.longitude;
            const hasCustomerCoords =
                typeof customerLat === 'number' &&
                typeof customerLng === 'number' &&
                Number.isFinite(customerLat) &&
                Number.isFinite(customerLng);

            return servicesForSelect.map((service) => {
                const parts = [
                    service.providerName || service.provider_id,
                    formatBookingAmount(resolveServiceUnitPrice(service.price)),
                ];
                if (hasCustomerCoords) {
                    const coords = serviceCoords(service);
                    if (coords) {
                        parts.push(
                            `${distanceKm(customerLat, customerLng, coords.latitude, coords.longitude).toFixed(1)} km`
                        );
                    } else {
                        parts.push('no location');
                    }
                }
                return {
                    value: service.id,
                    label: serviceLabel(service),
                    description: parts.filter(Boolean).join(' · '),
                    searchText: [service.providerName, service.provider_id, service.id]
                        .filter(Boolean)
                        .join(' '),
                };
            });
        },
        [servicesForSelect, customerAddress.latitude, customerAddress.longitude]
    );

    const customerOptions = useMemo<SearchSelectOption[]>(() => {
        const withId = activeCustomers.filter(
            (customer): customer is Customer & { id: string } => Boolean(customer.id)
        );
        const booker = withId.find((c) => isAdminBookerCustomer(c));
        const rest = withId
            .filter((c) => !isAdminBookerCustomer(c))
            .map((customer) => ({
                value: customer.id,
                label: customerName(customer),
                description: [customerWalletLabel(customer), customer.email, customerPhone(customer)]
                    .filter(Boolean)
                    .join(' · '),
                searchText: [
                    customer.id,
                    customer.email,
                    customerName(customer),
                    customerWalletLabel(customer),
                ]
                    .filter(Boolean)
                    .join(' '),
            }));

        const pinned: SearchSelectOption[] = booker
            ? [
                  {
                      value: booker.id,
                      label: ADMIN_BOOKER.displayName,
                      description: [
                          ADMIN_BOOKER.badge,
                          customerWalletLabel(booker),
                          ADMIN_BOOKER.phoneDigits,
                      ].join(' · '),
                      searchText: `admin booker zemen ${booker.id} ${ADMIN_BOOKER.email} wallet`,
                  },
              ]
            : [];

        return [...pinned, ...rest];
    }, [activeCustomers]);

    const couponOptions = useMemo<SearchSelectOption[]>(
        () =>
            activeCoupons.map((coupon) => ({
                value: String(coupon.id),
                label: formatCouponSelectLabel(coupon),
                description: formatCouponSelectDescription(coupon),
                searchText: [coupon.code, coupon.title].filter(Boolean).join(' '),
            })),
        [activeCoupons]
    );

    function handleCategoryChange(nextCategoryId: string) {
        setCategoryId(nextCategoryId);
        setSubCategoryId('');
        setServiceId('');
        setProviderId('');
        setUnitPriceInput('');
    }

    function handleSubCategoryChange(nextSubCategoryId: string) {
        setSubCategoryId(nextSubCategoryId);
        setServiceId('');
        setProviderId('');
        setUnitPriceInput('');
    }

    function handleServiceChange(nextServiceId: string) {
        setServiceId(nextServiceId);
        const service = servicesForSelect.find((item) => item.id === nextServiceId);
        setProviderId(service?.provider_id ?? '');
        const listPrice = resolveServiceUnitPrice(service?.price);
        setUnitPriceInput(listPrice > 0 ? String(listPrice) : '');
    }

    function handleCustomerAddressChange(next: ProviderAddressValue) {
        setCustomerAddress(next);
        if (!locality.trim() && next.address.trim()) {
            const parts = next.address.split(',').map((part) => part.trim()).filter(Boolean);
            if (parts.length >= 2) setLocality(parts[1] ?? '');
        }
    }

    function resetState() {
        setStep('details');
        setCategoryId('');
        setSubCategoryId('');
        setProviderId('');
        setServiceId('');
        setCustomerId('');
        setQuantity('1');
        setDescription('');
        setCustomerAddress({ address: '', latitude: null, longitude: null });
        setLocality('');
        setLandmark('');
        setCouponId('');
        setUnitPriceInput('');
        setPaymentPath('pay_later');
        setChapaPhone('');
        setCreatedBookingId('');
        setChapaCheckoutUrl('');
        setLoading(false);
        setError(null);
        setSuccessMessage('');
        setChapaDebugTrace(null);
        setShowChapaDebug(true);
    }

    const buildCreateRequestPayload = useCallback((path: PaymentPath): Record<string, unknown> => {
        const apiPaymentMode = resolveApiPaymentMode(path);
        return {
            provider_id: providerId,
            service_id: serviceId,
            customer_id: customerId,
            bookingDate: bookingDate ? new Date(bookingDate).toISOString() : undefined,
            quantity,
            description: description.trim() || undefined,
            payment_path: path,
            payment_mode: path,
            unit_price: resolveServiceUnitPrice(unitPriceInput) || undefined,
            bookingAddress: {
                address: customerAddress.address.trim(),
                locality: locality.trim(),
                landmark: landmark.trim() || undefined,
                latitude: customerAddress.latitude ?? undefined,
                longitude: customerAddress.longitude ?? undefined,
            },
            coupon_id: selectedCoupon?.id,
            coupon_code: selectedCoupon?.code,
            _debug_expected_db: {
                resolved_payment_mode: apiPaymentMode,
                status: resolveInitialBookingStatus(apiPaymentMode),
                payment_status:
                    path === 'mark_paid'
                        ? BOOKING_PAYMENT_STATUS.COMPLETED
                        : BOOKING_PAYMENT_STATUS.PENDING,
                paymentCompleted: path === 'mark_paid',
            },
        };
    }, [
        providerId,
        serviceId,
        customerId,
        bookingDate,
        quantity,
        description,
        customerAddress,
        locality,
        landmark,
        selectedCoupon,
        unitPriceInput,
    ]);

    const chapaDebugFormContext = useMemo(
        () =>
            isLocalhost
                ? buildChapaDebugFormContext(
                      providerId,
                      serviceId,
                      customerId,
                      selectedService,
                      selectedCustomer,
                      bookingDate,
                      quantity,
                      description,
                      customerAddress.address,
                      locality,
                      landmark,
                      selectedCoupon,
                      priceSummary,
                      resolvedUnitPrice
                  )
                : null,
        [
            isLocalhost,
            providerId,
            serviceId,
            customerId,
            selectedService,
            selectedCustomer,
            bookingDate,
            quantity,
            description,
            customerAddress.address,
            locality,
            landmark,
            selectedCoupon,
            priceSummary,
            resolvedUnitPrice,
        ]
    );

    const chapaDebugPreview = useMemo(() => {
        if (!isLocalhost || paymentPath !== 'pay_now' || !chapaDebugFormContext) return null;

        const bookingIdPlaceholder = '<id from step 1 response>';
        const paymentIdPlaceholder = '<uuid generated on init>';
        const txRefPlaceholder = 'bkg-<bookingId>-<timestamp>';

        return {
            step1_create_booking: {
                method: 'POST',
                url: '/api/admin/bookings',
                tables: CHAPA_CREATE_BOOKING_TABLES,
                api_body: buildCreateRequestPayload('pay_now'),
                table_writes: buildChapaStep1TableWrites(chapaDebugFormContext),
            },
            step2_init_chapa: {
                method: 'POST',
                url: '/api/admin/bookings/payment',
                tables: CHAPA_INIT_PAYMENT_TABLES,
                api_body: { bookingId: bookingIdPlaceholder },
                table_writes: buildChapaStep2TableWrites(
                    chapaDebugFormContext,
                    bookingIdPlaceholder,
                    paymentIdPlaceholder,
                    txRefPlaceholder
                ),
            },
            step3_verify_chapa: {
                method: 'POST',
                url: '/api/admin/bookings/payment/verify',
                tables: CHAPA_VERIFY_PAYMENT_TABLES,
                api_body: { bookingId: bookingIdPlaceholder },
                note: 'Runs automatically when you return from Chapa (also on Verify Payment click).',
                table_writes: buildChapaStep3TableWrites(
                    chapaDebugFormContext,
                    bookingIdPlaceholder,
                    paymentIdPlaceholder,
                    txRefPlaceholder
                ),
            },
        };
    }, [
        isLocalhost,
        paymentPath,
        chapaDebugFormContext,
        buildCreateRequestPayload,
    ]);

    function handleClose() {
        if (loading) return;
        resetState();
        onClose();
    }

    function validateDetails(): string | null {
        if (!categoryId) return 'Select a category';
        if (!subCategoryId) return 'Select a subcategory';
        if (!serviceId) return 'Select a service';
        if (!providerId) return 'Selected service has no provider';
        if (!customerId) return 'Select a customer';
        const unitPrice = resolveServiceUnitPrice(unitPriceInput);
        if (!Number.isFinite(unitPrice) || unitPrice < BOOKING_FIELD_LIMITS.unitPriceMin) {
            return `Unit price must be at least ${BOOKING_FIELD_LIMITS.unitPriceMin} ETB`;
        }
        if (unitPrice > BOOKING_FIELD_LIMITS.unitPriceMax) {
            return `Unit price cannot exceed ${BOOKING_FIELD_LIMITS.unitPriceMax} ETB`;
        }
        const qty = parseInt(quantity, 10);
        const quantitySecurityError = bookingSecureQuantityError(quantity);
        if (quantitySecurityError) return quantitySecurityError;
        if (!Number.isFinite(qty) || qty < BOOKING_FIELD_LIMITS.quantityMin) {
            return `Quantity must be at least ${BOOKING_FIELD_LIMITS.quantityMin}`;
        }
        if (qty > BOOKING_FIELD_LIMITS.quantityMax) {
            return `Quantity cannot exceed ${BOOKING_FIELD_LIMITS.quantityMax}`;
        }
        if (!bookingDate) return 'Booking date is required';
        const bookingMs = Date.parse(bookingDate);
        if (!Number.isFinite(bookingMs)) return 'Booking date is invalid';
        const maxAheadMs =
            Date.now() + BOOKING_FIELD_LIMITS.bookingDateMaxDaysAhead * 24 * 60 * 60 * 1000;
        if (bookingMs > maxAheadMs) {
            return `Booking date cannot be more than ${BOOKING_FIELD_LIMITS.bookingDateMaxDaysAhead} days ahead`;
        }
        const address = customerAddress.address.trim();
        if (!address) return 'Customer address is required';
        if (address.length > BOOKING_FIELD_LIMITS.addressMax) {
            return `Address cannot exceed ${BOOKING_FIELD_LIMITS.addressMax} characters`;
        }
        const addressSecurityError = bookingSecureTextError('Address', address);
        if (addressSecurityError) return addressSecurityError;
        if (
            typeof customerAddress.latitude !== 'number' ||
            typeof customerAddress.longitude !== 'number'
        ) {
            return 'Pick an address from the map suggestions so coordinates are set';
        }
        const localityValue = locality.trim();
        if (!localityValue) return 'Locality is required';
        if (localityValue.length < BOOKING_FIELD_LIMITS.localityMin) {
            return `Locality must be at least ${BOOKING_FIELD_LIMITS.localityMin} characters`;
        }
        if (localityValue.length > BOOKING_FIELD_LIMITS.localityMax) {
            return `Locality cannot exceed ${BOOKING_FIELD_LIMITS.localityMax} characters`;
        }
        const localitySecurityError = bookingSecureTextError('Locality', localityValue);
        if (localitySecurityError) return localitySecurityError;
        if (landmark.trim().length > BOOKING_FIELD_LIMITS.landmarkMax) {
            return `Landmark cannot exceed ${BOOKING_FIELD_LIMITS.landmarkMax} characters`;
        }
        const landmarkSecurityError = bookingSecureTextError('Landmark', landmark);
        if (landmarkSecurityError) return landmarkSecurityError;
        if (description.trim().length > BOOKING_FIELD_LIMITS.descriptionMax) {
            return `Description cannot exceed ${BOOKING_FIELD_LIMITS.descriptionMax} characters`;
        }
        const descriptionSecurityError = bookingSecureTextError('Description', description);
        if (descriptionSecurityError) return descriptionSecurityError;
        return null;
    }

    async function handleCreateBooking(path: PaymentPath) {
        const validationError = validateDetails();
        if (validationError) {
            setError(validationError);
            return;
        }

        if (path === 'wallet' && walletInsufficient) {
            setError(
                isAdminBooker
                    ? 'Zemen Admin wallet balance is insufficient — top up the float (ETB 20,000 floor) and try again'
                    : 'Customer wallet balance is insufficient for this booking'
            );
            return;
        }

        // Admin booker seat always debits the internal wallet float (API coerces mark_paid/chapa → wallet).
        if (isAdminBooker && path === 'mark_paid') {
            path = 'wallet';
        }

        if (path === 'pay_now') {
            const phoneSecurityError = bookingSecurePhoneError(chapaPhone);
            if (phoneSecurityError) {
                setError(phoneSecurityError);
                return;
            }
            if (!chapaPhoneNormalized) {
                setError('Enter a valid Ethiopian mobile number for Chapa (e.g. 09xxxxxxxx or 07xxxxxxxx)');
                return;
            }
        }

        setLoading(true);
        setError(null);

        const createRequestPayload = buildCreateRequestPayload(path);

        try {
            const booking = await dispatch(
                createBooking({
                    provider_id: providerId,
                    service_id: serviceId,
                    customer_id: customerId,
                    bookingDate: new Date(bookingDate).toISOString(),
                    quantity,
                    description: description.trim() || undefined,
                    payment_mode: path,
                    unit_price: resolveServiceUnitPrice(unitPriceInput),
                    bookingAddress: {
                        address: customerAddress.address.trim(),
                        locality: locality.trim(),
                        landmark: landmark.trim() || undefined,
                        latitude: customerAddress.latitude ?? undefined,
                        longitude: customerAddress.longitude ?? undefined,
                    },
                    coupon_id: selectedCoupon?.id,
                    coupon_code: selectedCoupon?.code,
                })
            ).unwrap();

            setCreatedBookingId(booking.id);
            onCreated();

            if (path === 'pay_later') {
                setSuccessMessage('Booking created. The customer can pay later after the provider accepts.');
                setStep('success');
                return;
            }

            if (path === 'wallet') {
                setSuccessMessage('Booking created and paid from customer wallet.');
                setStep('success');
                return;
            }

            if (path === 'mark_paid') {
                setSuccessMessage(
                    'Booking created and marked paid. Provider is credited when you set the job status to Completed.'
                );
                setStep('success');
                return;
            }

            const paymentRequestPayload = {
                bookingId: booking.id,
                phone_number: chapaPhoneNormalized ?? undefined,
            };
            const payment = await dispatch(initiateBookingPayment(paymentRequestPayload)).unwrap();
            const bookingRecord = booking as unknown as Record<string, unknown>;

            if (isLocalhost) {
                setChapaDebugTrace({
                    createRequest: createRequestPayload,
                    createTableWrites: chapaDebugFormContext
                        ? buildChapaStep1TableWrites(chapaDebugFormContext, booking.id)
                        : [],
                    createResponse: bookingRecord,
                    paymentRequest: paymentRequestPayload,
                    paymentTableWrites: chapaDebugFormContext
                        ? buildChapaStep2TableWrites(
                            chapaDebugFormContext,
                            booking.id,
                            String(bookingRecord.payment_id ?? '<uuid set on init — refresh debug row>'),
                            payment.tx_ref
                        )
                        : [],
                    paymentResponse: payment as unknown as Record<string, unknown>,
                    capturedAt: new Date().toISOString(),
                });
            }

            if (!payment.checkout_url) {
                setError('Chapa did not return a checkout URL');
                return;
            }

            setChapaCheckoutUrl(payment.checkout_url);
            setStep('chapa');
        } catch (err: unknown) {
            const message = typeof err === 'string' ? err : 'Failed to create booking';
            setError(message);
            if (path === 'pay_now' && isLocalhost) {
                setChapaDebugTrace((current) => ({
                    createRequest: createRequestPayload,
                    createTableWrites:
                        current?.createTableWrites ??
                        (chapaDebugFormContext ? buildChapaStep1TableWrites(chapaDebugFormContext) : []),
                    createResponse: current?.createResponse,
                    paymentRequest: current?.paymentRequest,
                    paymentTableWrites: current?.paymentTableWrites,
                    paymentResponse: current?.paymentResponse,
                    capturedAt: new Date().toISOString(),
                }));
            }
        } finally {
            setLoading(false);
        }
    }

    function handleVerifyPayment() {
        void runPaymentVerify();
    }

    async function handleReopenCheckout() {
        if (!createdBookingId) return;
        setLoading(true);
        setError(null);

        try {
            const payment = await dispatch(
                initiateBookingPayment({
                    bookingId: createdBookingId,
                    phone_number: chapaPhoneNormalized ?? undefined,
                })
            ).unwrap();
            if (!payment.checkout_url) {
                setError('Chapa did not return a checkout URL');
                return;
            }

            setChapaCheckoutUrl(payment.checkout_url);
        } catch (err: unknown) {
            const message = typeof err === 'string' ? err : 'Failed to reopen checkout';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    const stepTitle =
        step === 'details'
            ? 'Create Booking'
            : step === 'payment_path'
                ? 'Payment Method'
                : step === 'chapa'
                    ? 'Complete Payment'
                    : 'Booking Created';

    return (
        <Dialog open={open} onClose={handleClose} scrollable className="p-0">
            <DialogHeader className="border-b border-border px-4 pb-3 pt-4">
                <DialogTitle>{stepTitle}</DialogTitle>
                <DialogDescription>
                    {step === 'details' && 'Select service and customer for the new booking.'}
                    {step === 'payment_path' && 'Choose how payment should be handled for this booking.'}
                    {step === 'chapa' && 'Open Chapa checkout and complete payment. Verification runs automatically when you return.'}
                    {step === 'success' && successMessage}
                </DialogDescription>
            </DialogHeader>

            <DialogBody className="px-4 py-4">
            {step === 'details' && (
                <div className="grid gap-4">
                    <SearchSelect
                        id="booking-category"
                        label="Category"
                        value={categoryId}
                        onChange={handleCategoryChange}
                        options={categoryOptions}
                        placeholder="Select category"
                        searchPlaceholder="Search categories..."
                        emptyMessage="No categories found"
                        loading={categoriesLoading}
                        loadingMessage="Loading categories..."
                    />

                    <SearchSelect
                        id="booking-subcategory"
                        label="Subcategory"
                        value={subCategoryId}
                        onChange={handleSubCategoryChange}
                        options={subCategoryOptions}
                        placeholder={categoryId ? 'Select subcategory' : 'Select a category first'}
                        searchPlaceholder="Search subcategories..."
                        emptyMessage={categoryId ? 'No subcategories found' : 'Select a category first'}
                        loading={subCategoriesLoading}
                        loadingMessage="Loading subcategories..."
                        disabled={!categoryId}
                    />

                    <ProviderAddressPicker
                        id="booking-customer-address"
                        label="Customer address"
                        value={customerAddress}
                        onChange={handleCustomerAddressChange}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="booking-locality">Locality</Label>
                            <Input
                                id="booking-locality"
                                value={locality}
                                onChange={(e) => setLocality(e.target.value.slice(0, BOOKING_FIELD_LIMITS.localityMax))}
                                placeholder="Area or neighborhood"
                                maxLength={BOOKING_FIELD_LIMITS.localityMax}
                                required
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="booking-landmark">Landmark (optional)</Label>
                            <Input
                                id="booking-landmark"
                                value={landmark}
                                onChange={(e) => setLandmark(e.target.value.slice(0, BOOKING_FIELD_LIMITS.landmarkMax))}
                                placeholder="Nearby landmark"
                                maxLength={BOOKING_FIELD_LIMITS.landmarkMax}
                            />
                        </div>
                    </div>

                    <SearchSelect
                        id="booking-service"
                        label="Service"
                        value={serviceId}
                        onChange={handleServiceChange}
                        options={serviceOptions}
                        placeholder={
                            !categoryId || !subCategoryId
                                ? 'Select category and subcategory first'
                                : 'Search and select service'
                        }
                        searchPlaceholder="Search service, provider, or price..."
                        emptyMessage={
                            !categoryId || !subCategoryId
                                ? 'Select category and subcategory first'
                                : 'No services found for this subcategory'
                        }
                        loading={servicesLoading}
                        loadingMessage="Loading services..."
                        disabled={!categoryId || !subCategoryId}
                    />

                    {selectedService && (
                        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                            <div className="text-muted-foreground">Provider</div>
                            <div className="font-medium text-card-foreground">
                                {selectedProviderName || '—'}
                            </div>
                        </div>
                    )}

                    <SearchSelect
                        id="booking-customer"
                        label="Customer"
                        value={customerId}
                        onChange={setCustomerId}
                        options={customerOptions}
                        placeholder="Search customer or Zemen Admin"
                        searchPlaceholder="Search name, email, phone, or Zemen Admin..."
                        emptyMessage="No customers found"
                        loading={customersLoading}
                        loadingMessage="Loading customers..."
                    />

                    {isAdminBooker ? (
                        <div className="rounded-md border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-[13px] text-indigo-900">
                            Booking under <span className="font-semibold">{ADMIN_BOOKER.displayName}</span>{' '}
                            ({ADMIN_BOOKER.badge}) — paid from this account&apos;s wallet float (no Chapa).
                            Balance: {formatBookingAmount(customerWalletBalance)}.
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="booking-date">Booking date</Label>
                            <Input
                                id="booking-date"
                                type="datetime-local"
                                value={bookingDate}
                                onChange={(e) => setBookingDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="booking-quantity">Quantity</Label>
                            <Input
                                id="booking-quantity"
                                type="number"
                                inputMode="numeric"
                                min={BOOKING_FIELD_LIMITS.quantityMin}
                                max={BOOKING_FIELD_LIMITS.quantityMax}
                                step={1}
                                value={quantity}
                                onChange={(e) => setQuantity(clampBookingQuantity(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    {selectedService ? (
                        <div className="grid gap-1.5 rounded-md border border-border bg-card p-3">
                            <Label htmlFor="booking-unit-price">Unit price (ETB) — editable</Label>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    id="booking-unit-price"
                                    type="number"
                                    inputMode="decimal"
                                    min={BOOKING_FIELD_LIMITS.unitPriceMin}
                                    max={BOOKING_FIELD_LIMITS.unitPriceMax}
                                    step="0.01"
                                    value={unitPriceInput}
                                    onChange={(e) => setUnitPriceInput(e.target.value)}
                                    placeholder="e.g. 500"
                                    required
                                    className="max-w-56 font-medium tabular-nums"
                                />
                                {catalogUnitPrice > 0 && (
                                    <button
                                        type="button"
                                        className="text-[12px] font-medium text-primary hover:underline"
                                        onClick={() => setUnitPriceInput(String(catalogUnitPrice))}
                                    >
                                        Reset to list {formatBookingAmount(catalogUnitPrice)}
                                    </button>
                                )}
                            </div>
                            <p className="text-[12px] text-muted-foreground">
                                {catalogUnitPrice > 0
                                    ? priceIsCustom
                                        ? `Custom price for this booking (catalog: ${formatBookingAmount(catalogUnitPrice)}). Discounts and coupons still apply.`
                                        : 'Pre-filled from catalog. Type a new amount for this booking only — does not change the service list price.'
                                    : 'No catalog price — enter the amount charged for this booking.'}
                            </p>
                        </div>
                    ) : null}

                    <SearchSelect
                        id="booking-coupon"
                        label="Coupon (optional)"
                        value={couponId}
                        onChange={setCouponId}
                        options={couponOptions}
                        placeholder="No coupon"
                        searchPlaceholder="Search coupon code..."
                        emptyMessage="No active coupons found"
                        loading={couponsLoading}
                        loadingMessage="Loading coupons..."
                    />

                    <div className="grid gap-1.5">
                        <Label htmlFor="booking-description">Admin notes / description</Label>
                        <textarea
                            id="booking-description"
                            value={description}
                            onChange={(e) =>
                                setDescription(e.target.value.slice(0, BOOKING_FIELD_LIMITS.descriptionMax))
                            }
                            rows={4}
                            maxLength={BOOKING_FIELD_LIMITS.descriptionMax}
                            placeholder="Notes for this booking (special terms, context, follow-up…) — stored as description"
                            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        />
                        <p className="text-[12px] text-muted-foreground">
                            Optional. Visible on the booking detail. {description.length}/
                            {BOOKING_FIELD_LIMITS.descriptionMax}
                        </p>
                    </div>

                    {priceSummary && selectedService && (
                        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    Unit price × qty
                                    {priceIsCustom ? ' (custom)' : ''}
                                </span>
                                <span>
                                    {formatBookingAmount(resolvedUnitPrice)} × {quantity || '1'}{' '}
                                    = ETB {priceSummary.subTotal.toFixed(2)}
                                </span>
                            </div>
                            {priceSummary.serviceDiscountAmount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Service discount ({formatServiceDiscountLabel(selectedService.discount)})
                                    </span>
                                    <span>- ETB {priceSummary.serviceDiscountAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">After service discount</span>
                                <span>ETB {priceSummary.afterServiceDiscount.toFixed(2)}</span>
                            </div>
                            {priceSummary.couponAmount > 0 && selectedCoupon && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Coupon ({selectedCoupon.code ?? 'applied'} · {formatCouponDiscountLabel(selectedCoupon)})
                                    </span>
                                    <span>- ETB {priceSummary.couponAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="mt-2 flex justify-between font-semibold">
                                <span>Total</span>
                                <span>ETB {priceSummary.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {selectedCustomer && (
                        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                            Booking for {isAdminBooker ? ADMIN_BOOKER.displayName : customerLabel(selectedCustomer)}
                            {isAdminBooker ? (
                                <div className="mt-1 text-[12px]">
                                    Admin float wallet · {formatBookingAmount(customerWalletBalance)}
                                </div>
                            ) : (
                                typeof selectedCustomer.wallet_amount === 'number' && (
                                    <div className="mt-1">
                                        Wallet balance: ETB {selectedCustomer.wallet_amount.toFixed(2)}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            )}

            {step === 'payment_path' && (
                <div className="grid gap-4">
                    {priceSummary && selectedCustomer && (
                        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-muted-foreground">Amount due</span>
                                <span className="font-semibold tabular-nums text-card-foreground">
                                    {formatBookingAmount(priceSummary.totalAmount)}
                                </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-muted-foreground">Wallet balance</span>
                                <span className="tabular-nums text-card-foreground">
                                    {formatBookingAmount(customerWalletBalance)}
                                    {walletCanCover ? (
                                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                                            {isAdminBooker ? 'Float ready' : 'Enough to pay'}
                                        </span>
                                    ) : (
                                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                                            {isAdminBooker ? 'Float too low' : 'Use Chapa or pay later'}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setPaymentPath('wallet')}
                            disabled={!walletCanCover}
                            className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                paymentPath === 'wallet'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-border hover:bg-muted/40'
                            }`}
                        >
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 font-semibold text-card-foreground">
                                    <Wallet className="h-5 w-5" />
                                    Pay from wallet
                                </div>
                                {walletCanCover && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                        Recommended
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {isAdminBooker
                                    ? 'Debit Zemen Admin float wallet and mark the booking paid (recommended for admin bookings).'
                                    : 'Debit this customer’s wallet now and mark the booking paid.'}
                            </p>
                            {!walletCanCover && (
                                <p className="mt-2 text-sm text-amber-700">
                                    {isAdminBooker
                                        ? 'Admin float balance is too low. The API tops up to ETB 20,000 — refresh customer list and retry.'
                                        : 'Wallet balance is too low for this booking. Choose Chapa instead.'}
                                </p>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentPath('pay_now')}
                            disabled={isAdminBooker}
                            className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                paymentPath === 'pay_now'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-border hover:bg-muted/40'
                            }`}
                        >
                            <div className="mb-1 flex items-center gap-2 font-semibold text-card-foreground">
                                <CreditCard className="h-5 w-5" />
                                Pay via Chapa
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {isAdminBooker
                                    ? 'Disabled for Zemen Admin — use wallet float.'
                                    : 'Always available. Customer pays from their phone using the number below.'}
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentPath('pay_later')}
                            className={`rounded-xl border p-4 text-left transition-colors ${
                                paymentPath === 'pay_later'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-border hover:bg-muted/40'
                            }`}
                        >
                            <div className="mb-1 flex items-center gap-2 font-semibold text-card-foreground">
                                <Clock className="h-5 w-5" />
                                Customer pays later
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Create unpaid. Customer pays in the app after the provider accepts.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentPath('mark_paid')}
                            className={`rounded-xl border p-4 text-left transition-colors ${
                                paymentPath === 'mark_paid'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-border hover:bg-muted/40'
                            }`}
                        >
                            <div className="mb-1 flex items-center gap-2 font-semibold text-card-foreground">
                                <Banknote className="h-5 w-5" />
                                Mark as paid
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Record as paid by admin. Provider wallet credit waits until job is Completed.
                            </p>
                        </button>
                    </div>

                    {paymentPath === 'pay_now' && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                            <Label htmlFor="chapa-phone">Customer phone for Chapa</Label>
                            <Input
                                id="chapa-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={chapaPhone}
                                onChange={(e) =>
                                    setChapaPhone(e.target.value.slice(0, BOOKING_FIELD_LIMITS.phoneMax))
                                }
                                placeholder="09xxxxxxxx or 07xxxxxxxx"
                                maxLength={BOOKING_FIELD_LIMITS.phoneMax}
                                className="mt-1.5 bg-white"
                                aria-invalid={chapaPhoneInvalid || undefined}
                            />
                            <p className="mt-1.5 text-[13px] text-muted-foreground">
                                Prefills from the customer profile. Ethiopian mobile: 09 or 07.
                            </p>
                            {chapaPhone.trim() && chapaPhoneInvalid && (
                                <p className="mt-1.5 text-sm text-red-600">
                                    Enter a valid Ethiopian mobile number (09xxxxxxxx or 07xxxxxxxx).
                                </p>
                            )}
                        </div>
                    )}

                    {paymentPath === 'pay_now' && isLocalhost && (
                        <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-4">
                            <button
                                type="button"
                                onClick={() => setShowChapaDebug((value) => !value)}
                                className="flex w-full items-center justify-between text-left text-sm font-semibold text-indigo-900"
                            >
                                <span>Debug: Chapa create &amp; pay payloads</span>
                                <span className="text-xs font-medium text-indigo-700">
                                    {showChapaDebug ? 'Hide' : 'Show'}
                                </span>
                            </button>

                            {showChapaDebug && chapaDebugPreview && (
                                <div className="mt-3 space-y-3">
                                    <p className="text-xs text-indigo-800">
                                        Preview of API calls and explicit per-table writes when you click Create &amp; Pay.
                                    </p>
                                    <div className="space-y-2 rounded-md border border-border bg-background/80 p-3">
                                        <div className="text-sm font-semibold text-card-foreground">1) Create booking</div>
                                        <TableWritesDebugBlock writes={chapaDebugPreview.step1_create_booking.table_writes} />
                                        <DebugJsonBlock title="API request body" value={chapaDebugPreview.step1_create_booking.api_body} />
                                    </div>
                                    <div className="space-y-2 rounded-md border border-border bg-background/80 p-3">
                                        <div className="text-sm font-semibold text-card-foreground">2) Init Chapa payment</div>
                                        <TableWritesDebugBlock writes={chapaDebugPreview.step2_init_chapa.table_writes} />
                                        <DebugJsonBlock title="API request body" value={chapaDebugPreview.step2_init_chapa.api_body} />
                                    </div>
                                    <div className="space-y-2 rounded-md border border-border bg-background/80 p-3">
                                        <div className="text-sm font-semibold text-card-foreground">3) Verify payment (after checkout)</div>
                                        <TableWritesDebugBlock writes={chapaDebugPreview.step3_verify_chapa.table_writes} />
                                        <DebugJsonBlock title="API request body" value={chapaDebugPreview.step3_verify_chapa.api_body} />
                                    </div>
                                    {chapaDebugTrace && (
                                        <DebugJsonBlock
                                            title="Last captured API responses"
                                            value={chapaDebugTrace}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {step === 'chapa' && (
                <div className="space-y-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Booking created. Open Chapa checkout, complete payment, then return to this tab — payment will verify automatically.
                    </div>
                    {autoVerifyStatus && (
                        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                            {autoVerifyStatus}
                        </div>
                    )}
                    {chapaCheckoutUrl ? (
                        <a
                            href={chapaCheckoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-accent"
                        >
                            Open Chapa Checkout
                        </a>
                    ) : (
                        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                            Checkout link is not available. Use refresh checkout below.
                        </div>
                    )}
                    <Button onClick={handleVerifyPayment} disabled={loading} className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Verify Payment'
                        )}
                    </Button>
                    <Button variant="outline" onClick={handleReopenCheckout} disabled={loading} className="w-full">
                        Refresh Checkout Link
                    </Button>
                    {isLocalhost && chapaDebugTrace && chapaDebugFormContext && (
                        <div className="space-y-3 rounded-md border border-dashed border-indigo-300 bg-indigo-50/40 p-3">
                            <div className="text-sm font-semibold text-indigo-900">Debug: captured writes &amp; responses</div>
                            <div className="space-y-2 rounded-md border border-border bg-background/80 p-3">
                                <div className="text-sm font-semibold">Step 1 — booked_service + notification</div>
                                <TableWritesDebugBlock writes={chapaDebugTrace.createTableWrites} />
                                <DebugJsonBlock title="API response (booked_service row)" value={chapaDebugTrace.createResponse} />
                            </div>
                            <div className="space-y-2 rounded-md border border-border bg-background/80 p-3">
                                <div className="text-sm font-semibold">Step 2 — booked_service + payments</div>
                                <TableWritesDebugBlock writes={chapaDebugTrace.paymentTableWrites ?? []} />
                                <DebugJsonBlock title="API response (Chapa init)" value={chapaDebugTrace.paymentResponse} />
                            </div>
                            <div className="space-y-2 rounded-md border border-border bg-background/80 p-3">
                                <div className="text-sm font-semibold">Step 3 — on Verify click</div>
                                <TableWritesDebugBlock
                                    writes={buildChapaStep3TableWrites(
                                        chapaDebugFormContext,
                                        createdBookingId,
                                        String(
                                            (chapaDebugTrace.createResponse?.payment_id as string | undefined) ??
                                                '<payment uuid>'
                                        ),
                                        String(
                                            (chapaDebugTrace.paymentResponse?.tx_ref as string | undefined) ??
                                                '<tx_ref>'
                                        )
                                    )}
                                />
                            </div>
                            {chapaDebugTrace.capturedAt && (
                                <p className="text-xs text-muted-foreground">
                                    Captured at {chapaDebugTrace.capturedAt}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {step === 'success' && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    {successMessage}
                </div>
            )}

            {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}
            </DialogBody>

            <DialogFooter className="border-t border-border bg-card px-4 py-3">
                {step === 'details' && (
                    <>
                        <Button variant="ghost" onClick={handleClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                const validationError = validateDetails();
                                if (validationError) {
                                    setError(validationError);
                                    return;
                                }
                                setError(null);
                                setChapaPhone(selectedCustomer ? customerPhone(selectedCustomer) : '');
                                setPaymentPath(
                                    isAdminBooker || walletCanCover ? 'wallet' : 'pay_now'
                                );
                                setStep('payment_path');
                            }}
                            disabled={loading}
                        >
                            Continue
                        </Button>
                    </>
                )}

                {step === 'payment_path' && (
                    <>
                        <Button variant="ghost" onClick={() => setStep('details')} disabled={loading}>
                            Back
                        </Button>
                        <Button
                            onClick={() => void handleCreateBooking(paymentPath)}
                            disabled={loading || walletInsufficient || chapaPhoneInvalid}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : paymentPath === 'pay_now' ? (
                                'Create & Pay'
                            ) : paymentPath === 'wallet' ? (
                                'Create & Pay from Wallet'
                            ) : paymentPath === 'mark_paid' ? (
                                'Create & Mark Paid'
                            ) : (
                                'Create Booking'
                            )}
                        </Button>
                    </>
                )}

                {step === 'chapa' && (
                    <Button variant="ghost" onClick={handleClose} disabled={loading}>
                        Close
                    </Button>
                )}

                {step === 'success' && (
                    <Button onClick={handleClose}>
                        Done
                    </Button>
                )}
            </DialogFooter>
        </Dialog>
    );
}
