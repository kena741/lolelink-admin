import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/load-env-local';
import { upsertBookingPaymentRecord } from '../src/lib/booking-payment-side-effects';
import { BOOKING_PAYMENT_STATUS } from '../src/lib/booking-status';

async function main() {
  loadEnvLocal();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Use an existing booking with customer to test attach
  const { data: b } = await admin
    .from('booked_service')
    .select('id, customer_id, totalAmount, price, payment_id')
    .not('customer_id', 'is', null)
    .is('payment_id', null)
    .limit(1)
    .maybeSingle();

  console.log('booking', b);
  if (!b) return;

  const paymentId = crypto.randomUUID();
  try {
    const attached = await upsertBookingPaymentRecord(
      admin,
      b as { id: string; customer_id: string; totalAmount?: string | number; price?: string | number },
      {
        paymentId,
        providerRef: paymentId,
        paymentMethod: 'admin',
        provider: 'admin',
        status: BOOKING_PAYMENT_STATUS.COMPLETED,
      }
    );
    console.log('attached', attached);
    const upd = await admin
      .from('booked_service')
      .update({
        payment_status: BOOKING_PAYMENT_STATUS.COMPLETED,
        paymentCompleted: true,
        paymentType: 'admin',
        payment_id: attached,
      })
      .eq('id', b.id)
      .select('id, payment_id');
    console.log('update', upd.error, upd.data);
    // rollback: null payment_id, delete payment
    await admin.from('booked_service').update({ payment_id: null, paymentCompleted: false }).eq('id', b.id);
    await admin.from('payments').delete().eq('id', attached);
    console.log('rolled back');
  } catch (e) {
    console.error('caught', e);
  }

  // simulate insert with empty string payment_id
  const empty = await admin
    .from('booked_service')
    .update({ payment_id: '' as unknown as string })
    .eq('id', b.id)
    .select('id');
  console.log('empty payment_id error:', empty.error?.message, empty.error?.code, empty.error?.details);

  // test mark_paid-like insert of brand new booking without payment_id
  // get service + customer
  const { data: svc } = await admin.from('service').select('id, provider_id').not('provider_id', 'is', null).limit(1).single();
  const { data: cust } = await admin.from('customer').select('id').limit(1).single();
  if (!svc || !cust) return;
  const bid = crypto.randomUUID();
  const ins = await admin.from('booked_service').insert({
    id: bid,
    customer_id: cust.id,
    provider_id: svc.provider_id,
    service_id: svc.id,
    serviceName: 'probe',
    firstName: 'Probe',
    lastName: 'Test',
    email: 'probe@test.local',
    phoneNumber: '0900000000',
    price: '100',
    discount: '',
    subTotal: '100',
    totalAmount: '100',
    quantity: '1',
    bookingDate: new Date().toISOString(),
    status: 'admin_paid',
    paymentCompleted: true,
    payment_status: 'payment_completed',
    paymentType: 'admin',
    createdAt: new Date().toISOString(),
    taxList: [],
  }).select('id, payment_id').single();
  console.log('insert paid without payment_id:', ins.error?.message ?? 'ok', ins.data);
  if (ins.data) {
    try {
      const pid = crypto.randomUUID();
      const att = await upsertBookingPaymentRecord(admin, { id: bid, customer_id: cust.id, totalAmount: 100 }, {
        paymentId: pid,
        providerRef: pid,
        paymentMethod: 'admin',
        provider: 'admin',
        status: 'payment_completed',
      });
      const u2 = await admin.from('booked_service').update({ payment_id: att }).eq('id', bid).select('payment_id');
      console.log('attach after insert:', u2.error?.message ?? 'ok', u2.data);
    } catch (e) {
      console.error('attach fail', e);
    }
    // cleanup
    await admin.from('booked_service').update({ payment_id: null }).eq('id', bid);
    await admin.from('payments').delete().eq('booking_id', bid);
    await admin.from('booked_service').delete().eq('id', bid);
    console.log('cleaned test booking');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
