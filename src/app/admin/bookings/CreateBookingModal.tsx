'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { fetchServices } from '@/features/service/approveServicesSlice';
import { computeBookingAmounts, resolveServiceUnitPrice } from '@/lib/booking-pricing';
import { formatServiceDiscountLabel } from '@/lib/service-discount';
import type { Customer } from '@/features/customer/customerSlice';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';

interface BookingServiceRow {
    id: string;
    provider_id?: string;
    providerName?: string;
    serviceName?: string;
    name?: string;
    price?: string | number;
    discount?: string;
    status?: boolean;
    approved?: boolean;
    isArchived?: boolean;
}

type WizardStep = 'details' | 'payment_path' | 'chapa' | 'success';

interface CreateBookingModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

function customerPhone(customer: Customer): string {
    return customer.phoneNumber || customer.mobile_number || customer.phone || '';
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
    return resolveServiceUnitPrice(service.price) > 0;
}

export function CreateBookingModal({ open, onClose, onCreated }: CreateBookingModalProps) {
    const dispatch = useAppDispatch();
    const { customers, loading: customersLoading } = useAppSelector((state) => state.customer);
    const { services: allServicesRaw, loading: servicesLoading } = useAppSelector((state) => state.approveServices);

    const [step, setStep] = useState<WizardStep>('details');
    const [providerId, setProviderId] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [description, setDescription] = useState('');
    const [paymentPath, setPaymentPath] = useState<PaymentPath>('pay_later');
    const [createdBookingId, setCreatedBookingId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (!open) return;
        dispatch(fetchServices());
        dispatch(fetchAllCustomers());
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

    const selectedService = useMemo(
        () => selectableServices.find((service) => service.id === serviceId),
        [selectableServices, serviceId]
    );

    const selectedProviderName = selectedService?.providerName || selectedService?.provider_id || '';

    const selectedCustomer = useMemo(
        () => activeCustomers.find((customer) => customer.id === customerId),
        [activeCustomers, customerId]
    );

    const priceSummary = useMemo(() => {
        if (!selectedService) return null;
        const unitPrice = resolveServiceUnitPrice(selectedService.price);
        const qty = parseInt(quantity, 10);
        return computeBookingAmounts(unitPrice, selectedService.discount, Number.isFinite(qty) && qty > 0 ? qty : 1);
    }, [selectedService, quantity]);

    const serviceOptions = useMemo<SearchSelectOption[]>(
        () =>
            selectableServices.map((service) => ({
                value: service.id,
                label: serviceLabel(service),
                description: [
                    service.providerName || service.provider_id,
                    `ETB ${resolveServiceUnitPrice(service.price).toFixed(2)}`,
                ]
                    .filter(Boolean)
                    .join(' · '),
                searchText: [service.providerName, service.provider_id, service.id].filter(Boolean).join(' '),
            })),
        [selectableServices]
    );

    const customerOptions = useMemo<SearchSelectOption[]>(
        () =>
            activeCustomers
                .filter((customer): customer is Customer & { id: string } => Boolean(customer.id))
                .map((customer) => ({
                    value: customer.id,
                    label: customerName(customer),
                    description: [customer.email, customerPhone(customer)].filter(Boolean).join(' · '),
                    searchText: customer.id,
                })),
        [activeCustomers]
    );

    function handleServiceChange(nextServiceId: string) {
        setServiceId(nextServiceId);
        const service = selectableServices.find((item) => item.id === nextServiceId);
        setProviderId(service?.provider_id ?? '');
    }

    function resetState() {
        setStep('details');
        setProviderId('');
        setServiceId('');
        setCustomerId('');
        setQuantity('1');
        setDescription('');
        setPaymentPath('pay_later');
        setCreatedBookingId('');
        setLoading(false);
        setError(null);
        setSuccessMessage('');
    }

    function handleClose() {
        if (loading) return;
        resetState();
        onClose();
    }

    function validateDetails(): string | null {
        if (!serviceId) return 'Select a service';
        if (!providerId) return 'Selected service has no provider';
        if (!customerId) return 'Select a customer';
        const qty = parseInt(quantity, 10);
        if (!Number.isFinite(qty) || qty < 1) return 'Quantity must be at least 1';
        if (!bookingDate) return 'Booking date is required';
        return null;
    }

    async function handleCreateBooking(path: PaymentPath) {
        const validationError = validateDetails();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const booking = await dispatch(
                createBooking({
                    provider_id: providerId,
                    service_id: serviceId,
                    customer_id: customerId,
                    bookingDate: new Date(bookingDate).toISOString(),
                    quantity,
                    description: description.trim() || undefined,
                    payment_path: path,
                })
            ).unwrap();

            setCreatedBookingId(booking.id);
            onCreated();

            if (path === 'pay_later') {
                setSuccessMessage('Booking created. The customer can pay later after the provider accepts.');
                setStep('success');
                return;
            }

            const payment = await dispatch(initiateBookingPayment({ bookingId: booking.id })).unwrap();
            if (payment.checkout_url) {
                window.open(payment.checkout_url, '_blank');
            }
            setStep('chapa');
        } catch (err: unknown) {
            const message = typeof err === 'string' ? err : 'Failed to create booking';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleVerifyPayment() {
        if (!createdBookingId) return;
        setLoading(true);
        setError(null);

        try {
            await dispatch(verifyBookingPayment({ bookingId: createdBookingId })).unwrap();
            setSuccessMessage('Booking created and payment confirmed.');
            setStep('success');
            onCreated();
        } catch (err: unknown) {
            const message = typeof err === 'string' ? err : 'Payment verification failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleReopenCheckout() {
        if (!createdBookingId) return;
        setLoading(true);
        setError(null);

        try {
            const payment = await dispatch(initiateBookingPayment({ bookingId: createdBookingId })).unwrap();
            if (payment.checkout_url) {
                window.open(payment.checkout_url, '_blank');
            }
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
        <Dialog open={open} onClose={handleClose} className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>{stepTitle}</DialogTitle>
                <DialogDescription>
                    {step === 'details' && 'Select service and customer for the new booking.'}
                    {step === 'payment_path' && 'Choose whether to collect payment now or let the customer pay later.'}
                    {step === 'chapa' && 'Complete payment in the Chapa tab, then verify to confirm.'}
                    {step === 'success' && successMessage}
                </DialogDescription>
            </DialogHeader>

            {step === 'details' && (
                <div className="mt-4 grid gap-4">
                    <SearchSelect
                        id="booking-service"
                        label="Service"
                        value={serviceId}
                        onChange={handleServiceChange}
                        options={serviceOptions}
                        placeholder="Search and select service"
                        searchPlaceholder="Search service, provider, or price..."
                        emptyMessage="No services found"
                        loading={servicesLoading}
                        loadingMessage="Loading services..."
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
                        placeholder="Search and select customer"
                        searchPlaceholder="Search name, email, or phone..."
                        emptyMessage="No customers found"
                        loading={customersLoading}
                        loadingMessage="Loading customers..."
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="booking-date">Booking date</Label>
                            <Input
                                id="booking-date"
                                type="datetime-local"
                                value={bookingDate}
                                onChange={(e) => setBookingDate(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="booking-quantity">Quantity</Label>
                            <Input
                                id="booking-quantity"
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="booking-description">Description (optional)</Label>
                        <textarea
                            id="booking-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        />
                    </div>

                    {priceSummary && selectedService && (
                        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Unit price</span>
                                <span>ETB {resolveServiceUnitPrice(selectedService.price).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Discount</span>
                                <span>{formatServiceDiscountLabel(selectedService.discount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>ETB {priceSummary.subTotal.toFixed(2)}</span>
                            </div>
                            <div className="mt-2 flex justify-between font-semibold">
                                <span>Total</span>
                                <span>ETB {priceSummary.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {selectedCustomer && (
                        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                            Booking for {customerLabel(selectedCustomer)}
                        </div>
                    )}
                </div>
            )}

            {step === 'payment_path' && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setPaymentPath('pay_now')}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                            paymentPath === 'pay_now'
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-border hover:bg-muted/40'
                        }`}
                    >
                        <div className="mb-2 flex items-center gap-2 font-semibold text-card-foreground">
                            <CreditCard className="h-5 w-5" />
                            Pay via Chapa now
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Create the booking and open Chapa checkout to collect payment in this session.
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
                        <div className="mb-2 flex items-center gap-2 font-semibold text-card-foreground">
                            <Clock className="h-5 w-5" />
                            Customer pays later
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Create the booking now. The customer pays through the app after provider acceptance.
                        </p>
                    </button>
                </div>
            )}

            {step === 'chapa' && (
                <div className="mt-4 space-y-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Chapa checkout opened in a new tab. Complete payment there, then verify below.
                    </div>
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
                        Reopen Chapa Checkout
                    </Button>
                </div>
            )}

            {step === 'success' && (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    {successMessage}
                </div>
            )}

            {error && (
                <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <DialogFooter className="mt-4">
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
                        <Button onClick={() => void handleCreateBooking(paymentPath)} disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : paymentPath === 'pay_now' ? (
                                'Create & Pay'
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
