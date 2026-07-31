# Lolelink Admin

Admin console for operating the Zemen marketplace: providers, services, customers, bookings, and related platform controls.

## Language

**Operations Admin**:
A marketplace operator who keeps providers, services, catalog, bookings, customers, and notifications running day to day. They do not handle money or platform configuration.
_Avoid_: Super admin, finance admin, support admin, viewer

**Finance domain**:
Money movement and money config: payouts, payments, wallets, taxes, payment settings, Chapa balances.
_Avoid_: Billing (unless referring to customer invoices specifically)

**Job Request**:
A customer's posted request for work that providers can bid on, managed as part of customer operations.
_Avoid_: Contact message, support ticket, booking (a Booking is an accepted/scheduled job)

**Document verification**:
Reviewing a provider's uploaded identity/business documents (approve/reject). Owned by Operations Admin via provider verify access.
_Avoid_: Documents catalog, document types

**Provider/customer lifecycle**:
Operational moves on marketplace actors: create/edit, archive/restore, delete, convert customer→provider, and activation payment. Owned by Operations Admin via customers/providers write access.
_Avoid_: Finance payout approval, role/admin management
