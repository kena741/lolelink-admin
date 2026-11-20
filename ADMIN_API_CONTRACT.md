# ADMIN_API_CONTRACT.md

> Exhaustive data-access inventory of the **lolelink-admin** dashboard for Supabase → FastAPI migration.  
> Generated from a full scan of `src/`, `type/`, API route handlers, Redux slices, auth/RBAC, storage, and permission gates.  
> **Scope:** every admin UI / API data access point. One-off `scripts/` repair tools are listed in Appendix D only.

---

## Table of Contents

1. [Admin Authentication & RBAC](#1-admin-authentication--rbac)
2. [Providers & Verification Management](#2-providers--verification-management)
3. [Customer Management](#3-customer-management)
4. [Service & Catalog Management](#4-service--catalog-management)
5. [Bookings & Operations Management](#5-bookings--operations-management)
6. [Finance, Payouts & Commission](#6-finance-payouts--commission)
7. [Document Management & Deliveries](#7-document-management--deliveries)
8. [CRM & Opportunities](#8-crm--opportunities)
9. [Content & Blog](#9-content--blog)
10. [Marketing Tracker](#10-marketing-tracker)
11. [Platform Configuration](#11-platform-configuration)
12. [Audit & Activity Logs](#12-audit--activity-logs)
13. [Other Admin Operations](#13-other-admin-operations)
- [Appendix A — Permission Catalog & Route Gates](#appendix-a--permission-catalog--route-gates)
- [Appendix B — Tables / Storage / External Resources](#appendix-b--tables--storage--external-resources)
- [Appendix C — Shared TypeScript Types](#appendix-c--shared-typescript-types)
- [Appendix D — Migration Notes](#appendix-d--migration-notes)

---

## Call-type legend

| Call Type | Meaning |
|---|---|
| `REST HTTP` | Next.js App Router handler under `src/app/api/**` (primary FastAPI candidate) |
| `Supabase Table Query` | Direct `supabase.from(...)` from browser (RTK) or service-role admin client |
| `Supabase RPC` | `supabase.rpc(...)` |
| `Edge Function` | Edge HTTP / `functions.invoke` |
| `Storage` | `supabase.storage.from(...)` |
| `Auth` | Supabase Auth (`signIn`, `getUser`, Admin Auth API) |
| `Realtime` | `postgres_changes` subscription |
| `External HTTP` | Chapa / FCM / SMS upstream |

---

## Gap findings (explicit)

| Expected capability | Status in codebase |
|---|---|
| Dedicated **dispute** entity / module | **None** — handled via booking status (`rejected`) + payout reject + follow-up `admin_note` |
| Dedicated **wallet balance adjustment** admin API | **None** — wallets change via booking pay/refund, completion payout/clawback, activation credit, admin-booker float top-up, withdrawal deduct |
| CRM **opportunity / lead** tables | **None** — leads = `marketing_tracker_row`; demand CRM = `job_request` |
| Dual table `service` / `services` | Client code falls back to `services` when `service` fails |

---

# 1. Admin Authentication & RBAC

### Admin Operation: `Auth - Middleware session refresh`
- **Call Type**: `Auth` (Next.js middleware)
- **Target Route / Resource**: `/admin/:path*` → Supabase Auth cookies
- **Required Admin Permission**: Authenticated user only (no `admin` row check here)
- **Source Code Location**: `src/middleware.ts:9-49`
- **UI Screen / Component**: Any `/admin/**` page load
- **HTTP Method / SQL Action**: `supabase.auth.getUser()` (cookie JWT refresh)
- **Request Parameters / Payload**: `NextRequest` (cookies)
- **Filters & Clauses Applied**: `matcher: ['/admin/:path*']`; unauthenticated → `/login?error=auth&next=…`
- **Expected Response**: `NextResponse` next or redirect
- **Side Effects**: May rewrite auth cookies via `setAll`

### Admin Operation: `Auth - Login with password`
- **Call Type**: `Auth`
- **Target Route / Resource**: Supabase Auth `signInWithPassword`
- **Required Admin Permission**: None (pre-admin); `/api/admin/me` validates admin after
- **Source Code Location**: `src/app/login/page.tsx:34-63`
- **UI Screen / Component**: `/login`
- **HTTP Method / SQL Action**: Auth API
- **Request Parameters / Payload**:
  ```ts
  { email: string; password: string } // email trimmed + lowercased
  ```
- **Filters & Clauses Applied**: prior `signOut()`; poll `getSession` up to 20×100ms
- **Expected Response**: session established → `router.replace(next || '/admin/dashboard')`
- **Side Effects**: Session cookies; clears session on `?error=forbidden|auth`

### Admin Operation: `Auth - Resolve admin session context`
- **Call Type**: `Supabase Table Query` + `Auth` (server helper)
- **Target Route / Resource**: tables `admin`, `admin_role`; Auth `getUser`
- **Required Admin Permission**: Active `admin` row (`is_active = true`)
- **Source Code Location**: `src/lib/admin-auth.ts:27-103`
- **UI Screen / Component**: Used by all `requireAdmin*` API routes
- **HTTP Method / SQL Action**: `SELECT`
- **Request Parameters / Payload**: `Request`
  ```ts
  interface AdminRow { id: string; role: string; is_active: boolean }
  export interface AdminAuthContext { adminId: string; role: string; permissions: string[] }
  export type AdminAuthResult =
    | { ok: true; context: AdminAuthContext }
    | { ok: false; status: number; error: string }
  ```
- **Filters & Clauses Applied**: `admin.user_id = auth.uid()`; `admin_role.slug = admin.role`; fallback `DEFAULT_ADMIN_ROLES`; `applyRolePermissionPolicy`
- **Expected Response**: `AdminAuthResult`
- **Side Effects**: None (read-only)

### Admin Operation: `Auth - GET current admin grants`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/me`
- **Required Admin Permission**: Active admin session (`requireAdminSession`)
- **Source Code Location**: `src/app/api/admin/me/route.ts:6-17`
- **UI Screen / Component**: `AdminSessionProvider` (`src/lib/admin-session.tsx`)
- **HTTP Method / SQL Action**: `GET`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: via `requireAdminSession`
- **Expected Response**:
  ```ts
  { data: { adminId: string; role: string; permissions: string[] } }
  ```
- **Side Effects**: None

### Admin Operation: `Auth - Client session bootstrap / refresh`
- **Call Type**: `REST HTTP` + `Auth`
- **Target Route / Resource**: `getSession` + `GET /api/admin/me` + `onAuthStateChange`
- **Required Admin Permission**: Resolved server-side (401→unauthenticated, 403→forbidden)
- **Source Code Location**: `src/lib/admin-session.tsx:30-147`
- **UI Screen / Component**: `AdminSessionProvider`
- **HTTP Method / SQL Action**: Auth + HTTP GET
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: 120ms retry if first session empty; generation counter cancels stale loads
- **Expected Response**:
  ```ts
  type AdminSessionStatus = 'loading' | 'ready' | 'unauthenticated' | 'forbidden'
  interface AdminSessionValue {
    status: AdminSessionStatus; user: User | null; adminId: string | null;
    role: string | null; permissions: string[]; can: (p: string) => boolean; refresh: () => Promise<void>
  }
  ```
- **Side Effects**: Subscribes to auth state changes

### Admin Operation: `Auth - Client route guard`
- **Call Type**: Client permission check + `Auth`
- **Target Route / Resource**: `canAccessAdminRoute` + optional `auth.signOut()`
- **Required Admin Permission**: Path-specific (see Appendix A)
- **Source Code Location**: `src/components/AuthGuard.tsx:9-93`; `src/hooks/use-admin-permissions.ts:51-81`
- **UI Screen / Component**: Admin layout `AuthGuard`
- **HTTP Method / SQL Action**: N/A (may `signOut`)
- **Request Parameters / Payload**: `pathname: string`; `can: (permission: string) => boolean`
- **Filters & Clauses Applied**: Route map in `canAccessAdminRoute`
- **Expected Response**: Render children | null | redirect
- **Side Effects**: Sign-out on unauthenticated/forbidden

### Admin Operation: `Auth - Permission gate UI`
- **Call Type**: Client permission check
- **Target Route / Resource**: In-component feature flags
- **Required Admin Permission**: Prop `permission: string`
- **Source Code Location**: `src/components/PermissionGate.tsx:12-19`; `src/hooks/use-admin-permissions.ts:26-49`
- **UI Screen / Component**: `PermissionGate` / `useAdminPermissions`
- **HTTP Method / SQL Action**: N/A
- **Request Parameters / Payload**: `{ permission: string; children; fallback? }`
- **Filters & Clauses Applied**: `hasPermission` with `*` and `prefix:*` (`admin-permissions.ts:95-106`)
- **Expected Response**: children | fallback | null
- **Side Effects**: None

### Admin Operation: `Auth - Logout`
- **Call Type**: `Auth`
- **Target Route / Resource**: `auth.signOut()`
- **Required Admin Permission**: None
- **Source Code Location**: `src/components/Sidebar.tsx` (~601); also AuthGuard/login
- **UI Screen / Component**: Sidebar logout
- **HTTP Method / SQL Action**: Auth signOut
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: none
- **Expected Response**: navigate `/login`
- **Side Effects**: Clears session cookies

### Admin Operation: `RBAC - List roles`
- **Call Type**: `REST HTTP` → `Supabase Table Query`
- **Target Route / Resource**: `GET /api/admin/roles` → `admin_role`
- **Required Admin Permission**: `roles:read`
- **Source Code Location**: `src/app/api/admin/roles/route.ts:83-104`; `src/features/admin/adminRoleSlice.ts:16-28`
- **UI Screen / Component**: `/admin/roles`
- **HTTP Method / SQL Action**: `GET` / `SELECT *` ORDER BY `name` ASC; seeds defaults first
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: `ensureDefaultRoles` inserts missing `DEFAULT_ADMIN_ROLES`; denylist sync
- **Expected Response**: `{ data: AdminRole[] }`
- **Side Effects**: May INSERT default roles; may UPDATE system role permissions

### Admin Operation: `RBAC - Create role`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/roles` → `admin_role`
- **Required Admin Permission**: `roles:write`
- **Source Code Location**: `src/app/api/admin/roles/route.ts:106-154`; `adminRoleSlice.ts:31-48`
- **UI Screen / Component**: `/admin/roles`
- **HTTP Method / SQL Action**: `POST` / `INSERT`
- **Request Parameters / Payload**:
  ```ts
  interface CreateRolePayload {
    slug: string; name: string; description?: string; permissions: string[]
  }
  ```
- **Filters & Clauses Applied**: slug normalized; `applyRolePermissionPolicy`; ≥1 permission; `is_system: false`
- **Expected Response**: `{ data: AdminRole }`
- **Side Effects**: `logAdminActivity` action `create` resource `role`

### Admin Operation: `RBAC - Update role`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/roles` → `admin_role`
- **Required Admin Permission**: `roles:write`
- **Source Code Location**: `src/app/api/admin/roles/route.ts:156-228`; `adminRoleSlice.ts:51-68`
- **UI Screen / Component**: `/admin/roles`
- **HTTP Method / SQL Action**: `PATCH` / `UPDATE` by `id`
- **Request Parameters / Payload**:
  ```ts
  interface UpdateRolePayload {
    id: string; slug?: string; name?: string; description?: string; permissions?: string[]
  }
  ```
- **Filters & Clauses Applied**: system roles cannot change slug; permissions sanitized; ≥1 if provided
- **Expected Response**: `{ data: AdminRole }`
- **Side Effects**: activity log `update` with `buildChangeMetadata`

### Admin Operation: `RBAC - Delete role`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `DELETE /api/admin/roles` → `admin_role`
- **Required Admin Permission**: `roles:write`
- **Source Code Location**: `src/app/api/admin/roles/route.ts:231-278`; `adminRoleSlice.ts:71-87`
- **UI Screen / Component**: `/admin/roles`
- **HTTP Method / SQL Action**: `DELETE`; COUNT on `admin` where `role = slug`
- **Request Parameters / Payload**: `{ id: string }`
- **Filters & Clauses Applied**: reject if `is_system`; reject if any admin assigned
- **Expected Response**: `{ ok: true }`
- **Side Effects**: activity log `delete`

### Admin Operation: `RBAC - List admins`
- **Call Type**: `REST HTTP` + Auth Admin API
- **Target Route / Resource**: `GET /api/admin/admins` → `admin` + `auth.admin.listUsers`
- **Required Admin Permission**: `admins:read`
- **Source Code Location**: `src/app/api/admin/admins/route.ts:26-68`; `src/features/admin/adminSlice.ts:16-28`
- **UI Screen / Component**: `/admin/admins`
- **HTTP Method / SQL Action**: `SELECT` admin; `listUsers({ page:1, perPage:1000 })`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: ORDER BY `created_at` DESC; emails joined by `user_id`
- **Expected Response**: `{ data: AdminUser[] }` (`AdminUser` + `email`)
- **Side Effects**: None

### Admin Operation: `RBAC - Create admin`
- **Call Type**: `REST HTTP` + `Auth`
- **Target Route / Resource**: `POST /api/admin/admins` → Auth user + `admin`
- **Required Admin Permission**: `admins:write`
- **Source Code Location**: `src/app/api/admin/admins/route.ts:71-149`; `adminSlice.ts:31-48`
- **UI Screen / Component**: `/admin/admins`
- **HTTP Method / SQL Action**: `auth.admin.createUser`; `INSERT admin`
- **Request Parameters / Payload**:
  ```ts
  interface CreateAdminPayload {
    email: string; password: string; full_name: string; role: string; is_active?: boolean
  }
  ```
- **Filters & Clauses Applied**: password ≥6; role must exist in `admin_role`; `email_confirm: true`
- **Expected Response**: `{ data: AdminUser & { email } }`
- **Side Effects**: Creates Auth user; rollback Auth delete on insert fail; activity log

### Admin Operation: `RBAC - Update admin`
- **Call Type**: `REST HTTP` + `Auth`
- **Target Route / Resource**: `PATCH /api/admin/admins/[id]` → `admin` + optional password
- **Required Admin Permission**: `admins:write`
- **Source Code Location**: `src/app/api/admin/admins/[id]/route.ts:24-138`; `adminSlice.ts:51-72`
- **UI Screen / Component**: `/admin/admins`
- **HTTP Method / SQL Action**: `UPDATE admin`; optional `auth.admin.updateUserById`
- **Request Parameters / Payload**:
  ```ts
  { full_name?: string; role?: string; is_active?: boolean; password?: string }
  ```
- **Filters & Clauses Applied**: role validated; password only if length ≥6
- **Expected Response**: `{ data: AdminUser fields }`
- **Side Effects**: activity log (password redacted)

### Admin Operation: `RBAC - Delete admin`
- **Call Type**: `REST HTTP` + `Auth`
- **Target Route / Resource**: `DELETE /api/admin/admins/[id]`
- **Required Admin Permission**: `admins:write`
- **Source Code Location**: `src/app/api/admin/admins/[id]/route.ts:140-179`; `adminSlice.ts:75-89`
- **UI Screen / Component**: `/admin/admins`
- **HTTP Method / SQL Action**: `DELETE admin`; `auth.admin.deleteUser`
- **Request Parameters / Payload**: path `id: string`
- **Filters & Clauses Applied**: cannot delete self (`adminId === id`)
- **Expected Response**: `{ ok: true }`
- **Side Effects**: Deletes Auth user; activity log

# 2. Providers & Verification Management

### Admin Operation: `Providers - List providers (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: table `provider`
- **Required Admin Permission**: UI `providers:read` (RLS on client)
- **Source Code Location**: `src/features/provider/providerSlice.ts:119-138`
- **UI Screen / Component**: `/admin/providers`; `RealtimeDataSync`
- **HTTP Method / SQL Action**: `SELECT *`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: none (full table); normalizes `created_at` → `createdAt`, `archived_at`
- **Expected Response**: `Provider[]` / `ProviderSchema` (`type/provider.ts`)
- **Side Effects**: None

### Admin Operation: `Providers - Get provider by id (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `provider`
- **Required Admin Permission**: `providers:read`
- **Source Code Location**: `src/features/provider/providerSlice.ts:141-150`
- **UI Screen / Component**: `/admin/providers/[id]`
- **HTTP Method / SQL Action**: `SELECT *` `.eq('id', id).single()`
- **Request Parameters / Payload**: `id: string`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `Provider`
- **Side Effects**: None

### Admin Operation: `Providers - Count services by provider (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service` (fallback `services`)
- **Required Admin Permission**: `providers:read`
- **Source Code Location**: `src/features/provider/providerSlice.ts:262-305`
- **UI Screen / Component**: `/admin/providers`
- **HTTP Method / SQL Action**: `SELECT provider_id` paginated
- **Request Parameters / Payload**: none → `Record<string, number>`
- **Filters & Clauses Applied**: `.neq('isArchived', true)`; page size 1000; fallback table `services`
- **Expected Response**: `Record<string, number>`
- **Side Effects**: None

### Admin Operation: `Providers - Create provider`
- **Call Type**: `REST HTTP` + `Auth` + External SMS
- **Target Route / Resource**: `POST /api/admin/providers` → Auth + `provider`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/admin/providers/route.ts:31-163`; `CreateAppUserModal.tsx`
- **UI Screen / Component**: `CreateAppUserModal` (kind=`provider`)
- **HTTP Method / SQL Action**: `auth.admin.createUser`; `INSERT provider`
- **Request Parameters / Payload**:
  ```ts
  { first_name?: string; last_name?: string; email?: string; phone?: string; country_code?: string; password?: string }
  ```
- **Filters & Clauses Applied**: email uniqueness `ilike`; slug uniqueness retry ≤25; defaults `active:true`, `activation_paid:false`, `service_tier_max:0`, `signupSource:'admin'`
- **Expected Response**: `{ data: providerRow; temporaryPassword: string; sms: { sent: boolean; recipient?: string; error?: string } }`
- **Side Effects**: Auth user; SMS credentials; activity log; Auth delete on provider insert fail

### Admin Operation: `Providers - Update provider profile`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PUT /api/admin/providers/[id]` → `provider`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/route.ts:44-109`; `providerSlice.ts:332-360`
- **UI Screen / Component**: `/admin/providers`, `/admin/providers/[id]`
- **HTTP Method / SQL Action**: `UPDATE` allowlisted keys
- **Request Parameters / Payload**: Partial of `PROVIDER_UPDATE_KEYS`: `firstName|lastName|phoneNumber|address|location|banner|profileImage|profileBio|companyName|countryCode|admin_note`
- **Filters & Clauses Applied**: only allowlisted keys; `.eq('id', id)`
- **Expected Response**: `{ ok: true; data: ProviderRow }`
- **Side Effects**: activity log field changes

### Admin Operation: `Providers - Archive / restore provider`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/providers/[id]` → `provider.archived_at`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/route.ts:111-162`; `providerSlice.ts:467-505`
- **UI Screen / Component**: `/admin/providers`
- **HTTP Method / SQL Action**: `UPDATE { archived_at }`
- **Request Parameters / Payload**: `{ action: 'archive' | 'restore' }`
- **Filters & Clauses Applied**: archive = ISO now; restore = null
- **Expected Response**: `{ ok: true; archived_at: string | null }`
- **Side Effects**: activity log archive/restore

### Admin Operation: `Providers - Delete provider`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `DELETE /api/admin/providers/[id]`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/route.ts:164-203`; `providerSlice.ts:507-521`
- **UI Screen / Component**: `/admin/providers`
- **HTTP Method / SQL Action**: `DELETE` WHERE `id`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `{ ok: true }`
- **Side Effects**: activity log; **Auth user not deleted here**

### Admin Operation: `Providers - Get bank details`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/providers/[id]/bank-details` → `provider_payment_methods`
- **Required Admin Permission**: `providers:read` **OR** `finance:read`
- **Source Code Location**: `src/app/api/admin/providers/[id]/bank-details/route.ts:46-89`; `ProviderBankInfo.tsx`
- **UI Screen / Component**: `ProviderBankInfo`
- **HTTP Method / SQL Action**: `SELECT`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `providerID = id`, `method_type = 'bank'`; ORDER `is_default` DESC, `updated_at` DESC
- **Expected Response**: `{ data: BankMethodRow | null; methods: BankMethodRow[] }`
- **Side Effects**: None

### Admin Operation: `Providers - Upsert bank details`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PUT /api/admin/providers/[id]/bank-details`
- **Required Admin Permission**: `providers:write` **OR** `finance:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/bank-details/route.ts:91-217`; `ProviderBankInfo.tsx`
- **UI Screen / Component**: `ProviderBankInfo`
- **HTTP Method / SQL Action**: UPDATE clear defaults; UPDATE/INSERT bank row
- **Request Parameters / Payload**:
  ```ts
  { id?: string; holderName?: string; accountNumber?: string; bankName?: string;
    swiftCode?: string; branchCity?: string; branchCountry?: string; method_code?: string }
  ```
- **Filters & Clauses Applied**: account digits-only; match by accountNumber; force `is_default:true`, `is_active:true`, `currency:'ETB'`
- **Expected Response**: `{ status: 'ok'; id: string }`
- **Side Effects**: Default exclusivity among bank methods

### Admin Operation: `Providers - Get company profile`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/providers/[id]/company` → `provider` + `companies`
- **Required Admin Permission**: `providers:read`
- **Source Code Location**: `src/app/api/admin/providers/[id]/company/route.ts:46-101`; `ProviderCompanyProfile.tsx`
- **UI Screen / Component**: `ProviderCompanyProfile`
- **HTTP Method / SQL Action**: `SELECT`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `provider.id`; `companies.provider_id`
- **Expected Response**: `{ data: { company: ProviderCompany | null; verification: ProviderCompanyVerification } }`
- **Side Effects**: None

### Admin Operation: `Providers - Patch company profile / verification`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/providers/[id]/company`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/company/route.ts:103-273`; `ProviderCompanyProfile.tsx`
- **UI Screen / Component**: `ProviderCompanyProfile`
- **HTTP Method / SQL Action**: UPDATE provider verification fields; UPDATE/INSERT `companies`
- **Request Parameters / Payload**:
  ```ts
  { name?; companyName?; website?; industry?; companySize?; headquarters?; founded?;
    profileBio?; bannerImage?; companyVerificationStatus?; companyLicenseUrl?; companyRejectionReason? }
  ```
- **Filters & Clauses Applied**: empty strings → null
- **Expected Response**: `{ data: { company; verification } }`
- **Side Effects**: activity log update on provider

### Admin Operation: `Providers - List service / hire history`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/providers/[id]/bookings` → `booked_service` + `customer`
- **Required Admin Permission**: `providers:read`
- **Source Code Location**: `src/app/api/admin/providers/[id]/bookings/route.ts:72-200`; `ProviderServiceHistory.tsx`
- **UI Screen / Component**: `ProviderServiceHistory`
- **HTTP Method / SQL Action**: `SELECT`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `provider_id = id`; `is_archived IS NULL OR false`; ORDER `createdAt` DESC
- **Expected Response**:
  ```ts
  { data: Array<{ id; serviceName; status; paymentStatus; paymentCompleted; amount; createdAt;
      bookingDate; customerId; customerName; hiredBefore; priorCompletedCount; isPastHire; note; followUp }>;
    stats: ServiceHistoryStats; repeatCustomers: Array<… & { customerName }> }
  ```
- **Side Effects**: None

### Admin Operation: `Providers - Log past hire`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/providers/[id]/bookings`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/bookings/route.ts:203-318`; `ProviderServiceHistory.tsx`
- **UI Screen / Component**: `ProviderServiceHistory`
- **HTTP Method / SQL Action**: UPSERT booking; upsert payment; UPDATE `payment_id`
- **Request Parameters / Payload**: `{ customer_id?; service_id?; bookingDate?; amount?; note?; admin_note? }`
- **Filters & Clauses Applied**: past date not future; status forced `completed`; payment completed; description prefixed `[Past hire]`
- **Expected Response**: `{ data: { id: string; amount: number } }`
- **Side Effects**: Creates completed booking + payment; **no** wallet credit/SMS/push; activity `provider.past_hire.create`

### Admin Operation: `Providers - Update hire follow-up note`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/providers/[id]/bookings`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/bookings/route.ts:321-411`; `ProviderServiceHistory.tsx`
- **UI Screen / Component**: `ProviderServiceHistory`
- **HTTP Method / SQL Action**: `UPDATE admin_note`
- **Request Parameters / Payload**: `{ booking_id?; admin_note?: string | null }`
- **Filters & Clauses Applied**: booking must belong to provider
- **Expected Response**: `{ data: { id: string; followUp: string } }`
- **Side Effects**: activity `provider.hire_history.follow_up`

### Admin Operation: `Providers - Wallet transaction history`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/providers/[id]/wallet-transactions`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `src/app/api/admin/providers/[id]/wallet-transactions/route.ts:30-130`; `ProviderWalletHistory.tsx`
- **UI Screen / Component**: `ProviderWalletHistory`
- **HTTP Method / SQL Action**: `SELECT`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: OR `provider_id.eq.id`, `userId.eq.id`, optional auth user id; ORDER `createdDate` DESC
- **Expected Response**: `{ data: enriched rows; stats: { count; ledgerNet; storedWalletAmount; ledgerMatchesStored } }`
- **Side Effects**: None

### Admin Operation: `Providers - List document deliveries`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/providers/[id]/document-deliveries`
- **Required Admin Permission**: `providers:read`
- **Source Code Location**: `src/app/api/admin/providers/[id]/document-deliveries/route.ts:38-87`; `ProviderSharedDocuments.tsx`
- **UI Screen / Component**: `ProviderSharedDocuments`
- **HTTP Method / SQL Action**: `SELECT` + join `admin_documents`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `recipient_type='provider'`, `recipient_id=providerId`; ORDER `sent_at` DESC
- **Expected Response**: `{ deliveries: Array<{ id; document_id; recipient_type; recipient_id; sent_by; sent_at; acknowledged_at; document_title; document_category; file_name }> }`
- **Side Effects**: None

### Admin Operation: `Providers - Send document delivery`
- **Call Type**: `REST HTTP` + FCM + `notification` insert
- **Target Route / Resource**: `POST /api/admin/providers/[id]/document-deliveries`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/admin/providers/[id]/document-deliveries/route.ts:89-205`; `ProviderSharedDocuments.tsx`
- **UI Screen / Component**: `ProviderSharedDocuments`
- **HTTP Method / SQL Action**: `INSERT document_deliveries`; `INSERT notification`; FCM
- **Request Parameters / Payload**: `{ documentId?: string; note?: string }`
- **Filters & Clauses Applied**: validates provider + `admin_documents` exist
- **Expected Response**: `{ delivery; push }`
- **Side Effects**: push; in-app notification; activity log

### Admin Operation: `Providers - List / Create / Update provider services (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service` / `services`
- **Required Admin Permission**: read `providers:read`; mutations `services:write`
- **Source Code Location**: `providerSlice.ts:231-259` (list), `523-568` (create), `571-636` (update)
- **UI Screen / Component**: `/admin/providers/[id]`, `EditServiceModal`
- **HTTP Method / SQL Action**: `SELECT` / `INSERT` / `UPDATE`
- **Request Parameters / Payload**:
  ```ts
  // list: { providerId: string; includeArchived?: boolean }
  // create: { provider_id: string; values: Partial<Service> }
  // update: { id: string; values: Partial<Service> }
  ```
- **Filters & Clauses Applied**: list `.neq('isArchived', true)` unless includeArchived; fallback table `services`
- **Expected Response**: `Service` / `Service[]`
- **Side Effects**: client activity logs on create/update

### Admin Operation: `Providers - Initiate / mark activation payment`
- **Call Type**: `REST HTTP` (+ Chapa External HTTP)
- **Target Route / Resource**: `POST /api/provider/activate-payment`
- **Required Admin Permission**: chapa → `providers:write`; manual → `providers:write` OR `finance:write`
- **Source Code Location**: `src/app/api/provider/activate-payment/route.ts`; `providerSlice.ts:376-465`; `ActivationPaymentModal.tsx`
- **UI Screen / Component**: `ActivationPaymentModal`
- **HTTP Method / SQL Action**: UPDATE `provider` activation fields; may create Chapa checkout / wallet tx
- **Request Parameters / Payload**: `{ providerId: string; mode: 'chapa' | 'manual'; feeAmount: number; txRef?: string; note?: string }`
- **Filters & Clauses Applied**: rejects if already paid (409)
- **Expected Response**: `{ status; mode?; checkout_url?; provider_id; provider_name; activation_paid_at?; tx_ref; fee_amount; note?; error? }`
- **Side Effects**: Sets activation/tier fields; Chapa session; activity logs

### Admin Operation: `Providers - Verify activation payment`
- **Call Type**: `REST HTTP` + External HTTP (Chapa)
- **Target Route / Resource**: `POST /api/provider/activate-payment/verify`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `src/app/api/provider/activate-payment/verify/route.ts`; `providerSlice.ts:406-435`
- **UI Screen / Component**: `ActivationPaymentModal`
- **HTTP Method / SQL Action**: Chapa verify + UPDATE `provider` (+ wallet / tier / notification)
- **Request Parameters / Payload**: `{ providerId: string }`
- **Filters & Clauses Applied**: by provider id / tx_ref settlement rules
- **Expected Response**: `{ status; already_paid?; chapa_status?; message?; provider_id; activation_paid_at?; error? }`
- **Side Effects**: Marks paid/active; wallet transaction; may set `service_tier_max`

### Admin Operation: `Providers - Reconcile activation payment`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/provider/activate-payment/reconcile`
- **Required Admin Permission**: `providers:write` OR `finance:write`
- **Source Code Location**: `src/app/api/provider/activate-payment/reconcile/route.ts`; `ActivationPaymentModal.tsx`
- **UI Screen / Component**: `ActivationPaymentModal`
- **HTTP Method / SQL Action**: UPDATE `provider`; INSERT `wallet_transaction` / `service_tier_payment` / `notification`
- **Request Parameters / Payload**: provider id + reconciliation fields (route-local)
- **Filters & Clauses Applied**: session + permission OR
- **Expected Response**: JSON status payload with wallet amounts
- **Side Effects**: Forces activation paid; wallet credit; activity log

### Admin Operation: `Providers - Activation payment webhook`
- **Call Type**: Webhook → Supabase Admin
- **Target Route / Resource**: `POST /api/provider/activate-payment/webhook`
- **Required Admin Permission**: Chapa signature (no admin JWT)
- **Source Code Location**: `src/app/api/provider/activate-payment/webhook/route.ts`
- **UI Screen / Component**: none (Chapa callback)
- **HTTP Method / SQL Action**: UPDATE `provider`; INSERT `service_tier_payment` / `notification`
- **Request Parameters / Payload**: Chapa webhook payload
- **Filters & Clauses Applied**: success statuses; match activation tx_ref
- **Expected Response**: status JSON
- **Side Effects**: Activates provider; notifications

### Admin Operation: `Providers - Push readiness / send (single)`
- **Call Type**: `REST HTTP` + FCM
- **Target Route / Resource**: `GET|POST /api/admin/push/providers/[id]`
- **Required Admin Permission**: `notifications:write`
- **Source Code Location**: `src/app/api/admin/push/providers/[id]/route.ts:13-90`; `SendProviderPushForm`
- **UI Screen / Component**: Provider detail push panel
- **HTTP Method / SQL Action**: SELECT provider FCM/phone; FCM send
- **Request Parameters / Payload**: GET path `id`; POST `{ title?; body?; route? }`
- **Filters & Clauses Applied**: `id.eq OR user_id.eq`; title/body required on POST
- **Expected Response**: readiness `{ fcmRegistered; canSend; reason; name; smsReady; smsRecipient; debug }` / push result
- **Side Effects**: FCM delivery; may clear stale token

### Admin Operation: `Verification - List verify documents (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `verify_documents` + `documents` + `sub_category_documents` + `sub_category`
- **Required Admin Permission**: UI `providers:verify`
- **Source Code Location**: `src/features/verifyDocuments/verifyDocumentsSlice.ts:167-250`
- **UI Screen / Component**: `/admin/verify-documents`
- **HTTP Method / SQL Action**: `SELECT *` ORDER `createdAt` DESC; join names
- **Request Parameters / Payload**: none → `VerifyDocument[]`
- **Filters & Clauses Applied**: enrich via document / subcategory ids
- **Expected Response**: `VerifyDocument[]` (+ `documentName`, `subCategoryName`) — `type/verify_documents.ts`
- **Side Effects**: None

### Admin Operation: `Verification - Approve document`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `verify_documents` + `provider.verified_subcategory_ids`
- **Required Admin Permission**: UI `providers:verify`
- **Source Code Location**: `verifyDocumentsSlice.ts:253-313`
- **UI Screen / Component**: `/admin/verify-documents`
- **HTTP Method / SQL Action**: `UPDATE isVerify=true`; merge provider verified subcategory ids
- **Request Parameters / Payload**: `id: string`
- **Filters & Clauses Applied**: `.eq('id', id)`; rollback `isVerify=null` if provider update fails
- **Expected Response**: `VerifyDocument`
- **Side Effects**: merges `verified_subcategory_ids`; client activity log `verify`

### Admin Operation: `Verification - Reject document`
- **Call Type**: `Supabase Table Query` + push notify
- **Target Route / Resource**: `verify_documents` + provider subcategory cleanup
- **Required Admin Permission**: UI `providers:verify`
- **Source Code Location**: `verifyDocumentsSlice.ts:316-397`
- **UI Screen / Component**: `/admin/verify-documents`
- **HTTP Method / SQL Action**: `UPDATE isVerify=false`; may remove orphaned subcategory ids
- **Request Parameters / Payload**: `{ id: string; rejectionReason: string; providerName?; documentName? }`
- **Filters & Clauses Applied**: reason required; if was approved, orphan cleanup
- **Expected Response**: `VerifyDocument`
- **Side Effects**: `requestPushNotify` event `document_rejected`; activity log

### Admin Operation: `Verification - Approve all pending for provider`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `verify_documents` WHERE pending
- **Required Admin Permission**: UI `providers:verify`
- **Source Code Location**: `verifyDocumentsSlice.ts:400-449`
- **UI Screen / Component**: `/admin/verify-documents`
- **HTTP Method / SQL Action**: `UPDATE isVerify=true` WHERE `providerId` AND `isVerify IS NULL`
- **Request Parameters / Payload**: `providerId: string`
- **Filters & Clauses Applied**: `.eq('providerId').is('isVerify', null)`
- **Expected Response**: `VerifyDocument[]`
- **Side Effects**: merge subcategory ids; activity log

### Admin Operation: `Verification - Re-approve all rejected for provider`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `verify_documents` WHERE rejected
- **Required Admin Permission**: UI `providers:verify`
- **Source Code Location**: `verifyDocumentsSlice.ts:452-501`
- **UI Screen / Component**: `/admin/verify-documents`
- **HTTP Method / SQL Action**: `UPDATE isVerify=true` WHERE `providerId` AND `isVerify=false`
- **Request Parameters / Payload**: `providerId: string`
- **Filters & Clauses Applied**: `.eq('isVerify', false)`
- **Expected Response**: `VerifyDocument[]`
- **Side Effects**: merge subcategory ids; activity log

### Admin Operation: `Verification - Admin upload verification document`
- **Call Type**: `Storage` + `REST HTTP`
- **Target Route / Resource**: Storage `betegnabucket` + `POST /api/admin/providers/[id]/verify-documents`
- **Required Admin Permission**: `providers:write`
- **Source Code Location**: `ProviderVerificationUpload.tsx:75-114`; API `verify-documents/route.ts:21-123`; `src/lib/upload.ts`
- **UI Screen / Component**: `ProviderVerificationUpload`
- **HTTP Method / SQL Action**: Storage UPLOAD; DELETE existing same doc type; INSERT `verify_documents`
- **Request Parameters / Payload**: `{ documentId: string; documentImage: string }` (after upload URL)
- **Filters & Clauses Applied**: delete where `providerId` + `documentId`; insert `isVerify: null`
- **Expected Response**: `{ data: inserted & { documentName } }`
- **Side Effects**: storage file; replaces prior row; activity log

### Admin Operation: `Verification - Nav pending count`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/nav-action-counts` → count `verify_documents`
- **Required Admin Permission**: session; count only if `providers:verify`
- **Source Code Location**: `src/app/api/admin/nav-action-counts/route.ts:56-66`
- **UI Screen / Component**: Sidebar badge
- **HTTP Method / SQL Action**: SELECT count head `.is('isVerify', null)`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: pending only
- **Expected Response**: `counts['/admin/verify-documents']`
- **Side Effects**: None

---
# 3. Customer Management

### Admin Operation: `Customers - List all customers (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `customer` + `provider` + `booked_service`
- **Required Admin Permission**: UI `customers:read`
- **Source Code Location**: `src/features/customer/customerSlice.ts:195-256`
- **UI Screen / Component**: `/admin/customers`; `RealtimeDataSync`
- **HTTP Method / SQL Action**: `SELECT *`; enrich with provider id set + last booking
- **Request Parameters / Payload**: none → `Customer[]`
- **Filters & Clauses Applied**: bookings `.in('customer_id', customerIds)`; parse `default_address` JSON
- **Expected Response**: `Customer[]` with `last_request_at`, `provider_id?`, `archived_at`, `wallet_amount`, address fields (`type/customer.ts`)
- **Side Effects**: None

### Admin Operation: `Customers - List by provider_id (client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `customer` WHERE `provider_id`
- **Required Admin Permission**: UI customers/providers context
- **Source Code Location**: `src/features/customer/customerSlice.ts:126-192`
- **UI Screen / Component**: provider-linked customer views
- **HTTP Method / SQL Action**: `SELECT`
- **Request Parameters / Payload**: `provider_id: string`
- **Filters & Clauses Applied**: `.eq('provider_id', provider_id)`
- **Expected Response**: `Customer[]` enriched
- **Side Effects**: None

### Admin Operation: `Customers - Create customer (admin API)`
- **Call Type**: `REST HTTP` + `Auth` + SMS
- **Target Route / Resource**: `POST /api/admin/customers` → Auth + `customer`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/admin/customers/route.ts:21-145`; `CreateAppUserModal.tsx`
- **UI Screen / Component**: `CreateAppUserModal` (kind=`customer`)
- **HTTP Method / SQL Action**: `auth.admin.createUser`; `INSERT customer`
- **Request Parameters / Payload**: `{ first_name?; last_name?; email?; phone?; country_code?; password? }`
- **Filters & Clauses Applied**: `resolveCustomerLoginEmail`; uniqueness email/phone; phone required; `wallet_amount: 0`
- **Expected Response**: `{ data: customerRow; temporaryPassword; sms }`
- **Side Effects**: Auth user; SMS; activity log; Auth delete on profile fail

### Admin Operation: `Customers - Bulk create leads (no Auth)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/customers/bulk-leads` → `customer`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/admin/customers/bulk-leads/route.ts`; `BulkLeadCustomersModal.tsx`; parser `src/lib/customer-lead-paste.ts`
- **UI Screen / Component**: `/admin/customers` → **Add leads** (separate from Add customer)
- **HTTP Method / SQL Action**: `INSERT customer` (no Auth, no SMS)
- **Request Parameters / Payload**: `{ leads: Array<{ first_name; last_name?; phone; signup_source?; address?; admin_note? }> }` (max 100)
- **Filters & Clauses Applied**: Ethiopian phone normalize; phone uniqueness; `user_id: null`; `wallet_amount: 0`; full name split = first token → `first_name`, remainder → `last_name`
- **Expected Response**: `{ created: Customer[]; failed: Array<{ index; phone?; error }>; ok: boolean }`
- **Side Effects**: activity log `customers.bulk_leads_create` when any created; partial success allowed

### Admin Operation: `Customers - Register lead (Auth + SMS)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/customers/[id]/register` → Auth + `customer`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/admin/customers/[id]/register/route.ts`; `RegisterCustomerAuthModal.tsx`
- **UI Screen / Component**: `/admin/customers` row actions; `/admin/customers/[id]` header **Register & send SMS**
- **HTTP Method / SQL Action**: `auth.admin.createUser`; `UPDATE customer` (`user_id`, `email`, `login_type`)
- **Request Parameters / Payload**: `{ password? }` (optional; server generates temp password if omitted)
- **Filters & Clauses Applied**: customer must exist with `user_id` null; Ethiopian phone required; keeps `customer.id` stable
- **Expected Response**: `{ data: customerRow; temporaryPassword; sms }`
- **Side Effects**: Auth user; SMS (same Amharic template as create customer); activity log `customers.register`; Auth delete if profile update fails

### Admin Operation: `Customers - Create via Edge Function (legacy)`
- **Call Type**: `Edge Function`
- **Target Route / Resource**: `{edgeBase}/add_customer`
- **Required Admin Permission**: session bearer (UI customers write)
- **Source Code Location**: `src/features/customer/customerSlice.ts:72-123`
- **UI Screen / Component**: legacy add-customer flows still wired to thunk
- **HTTP Method / SQL Action**: POST Edge Function
- **Request Parameters / Payload**: `{ first_name, last_name, email?, phone, provider_id?, address? }` (+ generated password)
- **Filters & Clauses Applied**: requires access_token
- **Expected Response**: Edge JSON `result`
- **Side Effects**: Creates customer via edge (may create Auth)

### Admin Operation: `Customers - Direct insert (legacy client)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `customer` INSERT
- **Required Admin Permission**: RLS / UI
- **Source Code Location**: `src/features/customer/customerSlice.ts:63-69`
- **UI Screen / Component**: legacy `addCustomer` thunk
- **HTTP Method / SQL Action**: `INSERT`
- **Request Parameters / Payload**: `Customer`
- **Filters & Clauses Applied**: none
- **Expected Response**: `true` on success
- **Side Effects**: Row insert only (no Auth)

### Admin Operation: `Customers - Get customer detail + stats`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/customers/[id]` → `customer` + bookings + job_request + provider existence
- **Required Admin Permission**: `customers:read`
- **Source Code Location**: `src/app/api/admin/customers/[id]/route.ts:45-124`; UI `customers/[id]/page.tsx`
- **UI Screen / Component**: `/admin/customers/[id]`
- **HTTP Method / SQL Action**: `SELECT *`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: bookings by `customer_id`; job_request OR over `customerId` ∈ {id,user_id}; provider id check
- **Expected Response**: `{ customer: Record & { provider_id, wallet_amount, default_address }; stats: { bookingCount, totalSpent, jobRequestCount, lastBookingAt } }`
- **Side Effects**: None

> **Address view:** customer address is read from `customer.default_address` (JSON / string) and related address fields — no separate address table API.

### Admin Operation: `Customers - Update admin note`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/customers/[id]` with `admin_note`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/admin/customers/[id]/route.ts:126-183`
- **UI Screen / Component**: `/admin/customers`, `/admin/customers/[id]`
- **HTTP Method / SQL Action**: `UPDATE admin_note`
- **Request Parameters / Payload**: `{ admin_note: string | null }`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `{ ok: true; customer: { id, admin_note } }`
- **Side Effects**: activity log; Redux `setCustomerAdminNote`

### Admin Operation: `Customers - Archive / restore`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/customers/[id]` with `action`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/admin/customers/[id]/route.ts:185-225`; `customerSlice.ts:283-320`
- **UI Screen / Component**: `/admin/customers`
- **HTTP Method / SQL Action**: `UPDATE archived_at`
- **Request Parameters / Payload**: `{ action: 'archive' | 'restore' }`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `{ ok: true; archived_at: string | null }`
- **Side Effects**: activity log

### Admin Operation: `Customers - Delete customer`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `DELETE /api/admin/customers/[id]`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/admin/customers/[id]/route.ts:228-282`; `src/lib/customer-delete-cleanup.ts:7-87`
- **UI Screen / Component**: `/admin/customers`
- **HTTP Method / SQL Action**: DELETE job_requests; clear blockers; DELETE customer
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: job_request by customerId refs; `clearCustomerDeleteBlockers` nulls payment_ids, deletes payments, detaches bookings, nulls wallet customer_id, deletes related notification/provider_customer/etc.
- **Expected Response**: `{ ok: true }`
- **Side Effects**: Cascading cleanup; activity log; **Auth user not deleted**

### Admin Operation: `Customers - Convert to provider`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/convert-to-provider`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `src/app/api/convert-to-provider/route.ts:31-200`; `customerSlice.ts:259-280`
- **UI Screen / Component**: `/admin/customers`
- **HTTP Method / SQL Action**: INSERT `provider`; UPDATE wallet_transaction type; DELETE `customer`
- **Request Parameters / Payload**: `{ customerId: string }`
- **Filters & Clauses Applied**: must have `user_id`; no existing provider; slug uniqueness retries; retag wallets `type='provider'`
- **Expected Response**: `{ data: provider }`
- **Side Effects**: Migrates identity; deletes customer after cleanup; activity log; rollback provider on failure

### Admin Operation: `Customers - List bookings`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/customers/[id]/bookings`
- **Required Admin Permission**: `customers:read`
- **Source Code Location**: `src/app/api/admin/customers/[id]/bookings/route.ts:24-102`
- **UI Screen / Component**: `/admin/customers/[id]`
- **HTTP Method / SQL Action**: `SELECT` bookings + provider enrich
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `customer_id`; not archived; ORDER `createdAt` DESC
- **Expected Response**: `{ data: Array<{ id, serviceName, status, paymentStatus, paymentCompleted, amount, createdAt, providerId, providerName }> }`
- **Side Effects**: None

### Admin Operation: `Customers - List job requests (per customer)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/customers/[id]/job-requests` → `job_request`
- **Required Admin Permission**: `customers:read`
- **Source Code Location**: `src/app/api/admin/customers/[id]/job-requests/route.ts:15-91`
- **UI Screen / Component**: `/admin/customers/[id]`
- **HTTP Method / SQL Action**: `SELECT *`
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: OR `customerId.eq` for id and user_id; ORDER `createdAt` DESC
- **Expected Response**: `{ data: Array<{ id, createdAt, title, description, status, accepted, isPaid, price, serviceName, bidCount }> }`
- **Side Effects**: None

### Admin Operation: `Customers - Wallet history (read)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/customers/[id]/wallet-transactions`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `src/app/api/admin/customers/[id]/wallet-transactions/route.ts:30-163`; `CustomerWalletHistory.tsx`
- **UI Screen / Component**: `CustomerWalletHistory`
- **HTTP Method / SQL Action**: `SELECT` wallet + enrich bookings/providers
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: OR `customer_id` / `userId` / auth user id
- **Expected Response**: `{ data: rows; stats: { count, ledgerNet, storedWalletAmount, ledgerMatchesStored } }`
- **Side Effects**: None

> **Wallet balance adjustments:** There is **no** dedicated admin “adjust wallet” endpoint. Balance display uses `customer.wallet_amount` / `provider.walletAmount`. Mutations occur as side effects of: booking wallet pay/refund (`booking-payment-side-effects.ts`), completion payout/clawback (`booking-completion-payout.ts`), activation reconcile, admin-booker float top-up (`admin-booker-customer.ts`, floor ETB 20,000), withdrawal deduct.

### Admin Operation: `Customers - Resolve admin booker customer`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/customers/admin-booker` → `customer` (+ wallet top-up)
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `src/app/api/admin/customers/admin-booker/route.ts:9-24`; `src/lib/admin-booker-customer.ts:142-213`
- **UI Screen / Component**: `CreateBookingModal`
- **HTTP Method / SQL Action**: SELECT by email/phone; may UPDATE unarchive; INSERT wallet_transaction; UPDATE wallet_amount
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: email `251951175959@phone.zemen.app` / alts; phone tail; name Zemen Admin; wallet floor 20000
- **Expected Response**: `{ data: customerRow & { id } }`
- **Side Effects**: May unarchive; may credit wallet to floor

### Admin Operation: `Customers - Push readiness (single)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/push/customers/[id]`
- **Required Admin Permission**: `notifications:write`
- **Source Code Location**: `src/app/api/admin/push/customers/[id]/route.ts:12-51`
- **UI Screen / Component**: `/admin/customers/[id]`
- **HTTP Method / SQL Action**: SELECT customer FCM/phone
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `{ fcmRegistered, canSend, reason, name, smsReady, smsRecipient, debug }`
- **Side Effects**: None

---

# 4. Service & Catalog Management

### Admin Operation: `Service - List / Fetch Services`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service` (+ enrich `provider`, `wallet_transaction`)
- **Required Admin Permission**: `services:read`
- **Source Code Location**: `src/features/service/approveServicesSlice.ts:52-173`
- **UI Screen / Component**: `/admin/services/approve`
- **HTTP Method / SQL Action**: `SELECT *` on `service`; enrich providers + featured wallet notes
- **Request Parameters / Payload**: `{ includeArchived?: boolean } | undefined`
- **Filters & Clauses Applied**: if not archived: `.eq('status', true).neq('isArchived', true)`; featured wallet notes `.or('note.ilike.%featured…%').order('createdDate', { ascending: false }).limit(500)`
- **Expected Response**: enriched service rows (`ServiceSchema` / `ServiceModel`)
- **Side Effects**: none

### Admin Operation: `Service - Approve By Provider`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service`
- **Required Admin Permission**: `services:write`
- **Source Code Location**: `approveServicesSlice.ts:177-223`
- **UI Screen / Component**: `/admin/providers/[id]`
- **HTTP Method / SQL Action**: `SELECT id, approved` then `UPDATE approved=true`
- **Request Parameters / Payload**: `providerId: string`
- **Filters & Clauses Applied**: `.eq('provider_id', providerId).neq('isArchived', true)`; update `.in('id', ids)` where `approved !== true`
- **Expected Response**: `number` (count updated)
- **Side Effects**: admin activity log `approve` / `service`

### Admin Operation: `Service - Approve By Id`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service`
- **Required Admin Permission**: `services:write` (thunk exists; no current UI dispatch)
- **Source Code Location**: `approveServicesSlice.ts:226-253`
- **UI Screen / Component**: none wired
- **HTTP Method / SQL Action**: `UPDATE approved=true` `.eq('id', serviceId)`
- **Request Parameters / Payload**: `serviceId: string`
- **Filters & Clauses Applied**: `.eq('id', serviceId)`
- **Expected Response**: `number` (`1`)
- **Side Effects**: admin activity log

### Admin Operation: `Service - Approve / Reject Featured Request / Unfeature`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service` (fallback `services`)
- **Required Admin Permission**: `services:write`
- **Source Code Location**: `approveServicesSlice.ts:255-376`
- **UI Screen / Component**: `/admin/services/approve`
- **HTTP Method / SQL Action**: `UPDATE`
- **Request Parameters / Payload**:
  ```ts
  // approve featured: { feature: true, feature_requested_status: 'accepted' }
  // reject: { feature: false, feature_requested_status: 'rejected' }
  // unfeature: { feature: false, feature_requested_status: 'none' }
  ```
- **Filters & Clauses Applied**: `.eq('id', serviceId)`
- **Expected Response**: `number` (`1`)
- **Side Effects**: activity log approve/reject/unfeature

### Admin Operation: `Service - Create`
- **Call Type**: `Supabase Table Query` + `Storage`
- **Target Route / Resource**: `service`; Storage public media paths
- **Required Admin Permission**: `services:write`
- **Source Code Location**: `src/features/service/addServiceSlice.ts:51-146`
- **UI Screen / Component**: `/admin/providers/[id]` add-service modal
- **HTTP Method / SQL Action**: `INSERT` + `.select('id, serviceName').single()`
- **Request Parameters / Payload**: `{ service: AddServiceModel; imageFiles?: File[]; videoFile?: File; markAdminUnpaid?: boolean }`
- **Filters & Clauses Applied**: none (insert)
- **Expected Response**: `AddServiceModel & { id?: string }`
- **Side Effects**: storage uploads; optional admin-unpaid description tag; activity log

### Admin Operation: `Service - Update / Edit`
- **Call Type**: `Supabase Table Query` + `Storage`
- **Target Route / Resource**: `service`
- **Required Admin Permission**: `services:write`
- **Source Code Location**: `src/features/service/editServiceSlice.ts:192-328`
- **UI Screen / Component**: `EditServiceModal`
- **HTTP Method / SQL Action**: `SELECT *` then `UPDATE` + `.select().single()`
- **Request Parameters / Payload**: `Partial<ServiceModel> & { id: string; videoFile?: File; removeVideo?: boolean }`
- **Filters & Clauses Applied**: `.eq('id', id)`; only changed fields written
- **Expected Response**: `ServiceModel`
- **Side Effects**: storage upload/delete; activity log with change metadata

### Admin Operation: `Service - Soft Archive / Unarchive`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `service`
- **Required Admin Permission**: `services:write`
- **Source Code Location**: `src/features/service/deleteServiceSlice.ts:18-117`
- **UI Screen / Component**: `/admin/services/approve`, `/admin/providers/[id]`
- **HTTP Method / SQL Action**: `UPDATE` (never hard-delete)
- **Request Parameters / Payload**: `serviceId: string`
- **Filters & Clauses Applied**: archive → `{ isArchived: true, status: false, active: false }`; unarchive → opposite
- **Expected Response**: `string` (service id)
- **Side Effects**: activity log archive/unarchive

### Admin Operation: `Service - Nav Badge Counts`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/nav-action-counts` → `service`
- **Required Admin Permission**: session + `services:read`
- **Source Code Location**: `nav-action-counts/route.ts:69-92`
- **UI Screen / Component**: Sidebar badge `/admin/services/approve`
- **HTTP Method / SQL Action**: SELECT count head
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: unapproved: `status=true`, `isArchived≠true`, `approved is null|false`; featured pending: `feature_requested_status ilike pending`
- **Expected Response**: `NavActionCounts['/admin/services/approve']: number`
- **Side Effects**: none

### Admin Operation: `Category - List / Create / Update / Delete`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `category`
- **Required Admin Permission**: read `catalog:read`; write `catalog:write`
- **Source Code Location**: `src/features/category/categorySlice.ts:44-166`
- **UI Screen / Component**: `/admin/categories`, `/admin/categories/[id]`, service forms
- **HTTP Method / SQL Action**: `SELECT *` `.order('categoryName')` / `INSERT` / `UPDATE` / `DELETE`
- **Request Parameters / Payload**:
  ```ts
  // create: { categoryName: string; image?: string; active?: boolean; description?: string }
  // update: { id: string; categoryName?; image?; active?; description? }
  // delete: id: string
  ```
- **Filters & Clauses Applied**: order by name; update/delete by id
- **Expected Response**: `Category` / `Category[]` / id (`type/category.ts`)
- **Side Effects**: activity logs (`resource_type: 'settings'` on create)

### Admin Operation: `SubCategory - List / Document Ids / CRUD`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `sub_category` joined `category`; `sub_category_documents`
- **Required Admin Permission**: read `catalog:read`; write `catalog:write`
- **Source Code Location**: `src/features/subcategory/subcategorySlice.ts:48-269`
- **UI Screen / Component**: `/admin/subcategories`, `/admin/categories/[id]`, service forms
- **HTTP Method / SQL Action**: `SELECT *, category:categoryId(categoryName)`; junction SELECT/DELETE/INSERT; subcategory INSERT/UPDATE/DELETE
- **Request Parameters / Payload**:
  ```ts
  // create: { subCategoryName; categoryId; isFree?; documentIds?: string[] }
  // update: { id; subCategoryName?; categoryId?; isFree?; documentIds? }
  // delete: id
  ```
- **Filters & Clauses Applied**: order `subCategoryName` asc; junction `.eq('subCategoryId', id)` replace-all on update
- **Expected Response**: `SubCategory[]` / `Record<string, string[]>` document map / id
- **Side Effects**: junction rows; activity logs

---
# 5. Bookings & Operations Management

> **Disputes:** No dedicated dispute table. Operational disputes are handled via booking status transitions (`rejected`, etc.), follow-up `admin_note`, and payout reject flows.

### Admin Operation: `Booking - List All`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `booked_service` (+ enrich `provider`, `customer`, `service`, `wallet_transaction`)
- **Required Admin Permission**: `bookings:read`
- **Source Code Location**: `src/features/bookedService/bookedServiceSlice.ts:349-373` (+ enrich `157-309`)
- **UI Screen / Component**: `/admin/bookings` (`BookingsTable`)
- **HTTP Method / SQL Action**: `SELECT *`
- **Request Parameters / Payload**: `{ statuses?: string[]; includeArchived?: boolean } | undefined`
- **Filters & Clauses Applied**: unless archived: `.or('is_archived.is.null,is_archived.eq.false')`; optional `.in('status', statuses)`; `.order('createdAt', { ascending: false })`
- **Expected Response**: `BookedService[]` (`type/booked_service.ts`)
- **Side Effects**: none (enrichment reads)

### Admin Operation: `Booking - List (Provider-scoped thunk alias)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: same as list-all (**no** `provider_id` filter despite arg name)
- **Required Admin Permission**: `bookings:read`
- **Source Code Location**: `bookedServiceSlice.ts:323-347`
- **UI Screen / Component**: legacy/alternate list path
- **HTTP Method / SQL Action**: `SELECT *`
- **Request Parameters / Payload**: `{ provider_id?: string; statuses?: string[]; includeArchived?: boolean }` (`provider_id` unused)
- **Filters & Clauses Applied**: same archive/status/order as list-all
- **Expected Response**: `BookedService[]`
- **Side Effects**: none

### Admin Operation: `Booking - Get By Id`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `booked_service`
- **Required Admin Permission**: `bookings:read`
- **Source Code Location**: `bookedServiceSlice.ts:375-393`
- **UI Screen / Component**: `/admin/bookings` detail flow
- **HTTP Method / SQL Action**: `SELECT *` `.eq('id', id).single()`
- **Request Parameters / Payload**: `id: string`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `BookedService`
- **Side Effects**: none

### Admin Operation: `Booking - Create`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/bookings` → `booked_service`, `payments`, `customer`, `service`, `wallet_transaction`, `notification`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookedServiceSlice.ts:443-465`; `src/app/api/admin/bookings/route.ts:137-353`
- **UI Screen / Component**: `CreateBookingModal`
- **HTTP Method / SQL Action**: UPSERT booking; conditional wallet debit / mark-paid; payments upsert; notifications/SMS
- **Request Parameters / Payload**:
  ```ts
  interface CreateBookingInput {
    provider_id: string; service_id: string; customer_id: string;
    bookingDate?: string; quantity?: string; description?: string;
    payment_path?: 'pay_now'|'pay_later'|'wallet'|'mark_paid';
    payment_mode?: PaymentPath; bookingAddress?: BookingAddressInput;
    coupon_id?: number; coupon_code?: string; unit_price?: number;
  }
  ```
- **Filters & Clauses Applied**: lookups by service/customer; wallet balance check; admin-booker forces wallet
- **Expected Response**: `{ data: BookedService }`
- **Side Effects**: wallet debit; payments row; notifications; SMS; activity log; rollback delete on payment failure

### Admin Operation: `Booking - Update Status (manual transitions)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/bookings/[id]`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookedServiceSlice.ts:577-641`; `bookings/[id]/route.ts:24-262`
- **UI Screen / Component**: `BookingDetailModal`
- **HTTP Method / SQL Action**: `UPDATE booked_service.status`; may credit/clawback provider wallet; refund customer
- **Request Parameters / Payload**:
  ```ts
  { status: BookedServiceStatus; apply_commission?: boolean; commission_percent?: number;
    notifyProvider?: boolean; notifyCustomer?: boolean }
  // statuses: pending|accepted|rejected|on_the_way|in_progress|hold|completed|pending_extra_payment|pending_approval|admin_paid
  ```
- **Filters & Clauses Applied**: `.eq('id', id)`; completion commission clamp 0–100 (default 10)
- **Expected Response**: `{ ok: true; status; unchanged?; provider_payout?; provider_clawback?; customer_refund? }`
- **Side Effects**: `creditProviderForCompletedBooking` / `clawbackProviderCompletionPayout` / `refundCustomerForRejectedBooking`; notifications; activity log; may set `adminCommission`

### Admin Operation: `Booking - Update Follow-up Note`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/admin/bookings/[id]` (note-only branch)
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookings/[id]/route.ts:49-104`
- **UI Screen / Component**: bookings detail / provider history follow-up
- **HTTP Method / SQL Action**: `UPDATE admin_note`
- **Request Parameters / Payload**: `{ admin_note: string | null }` (no `status`)
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `{ data: { id, admin_note } }`
- **Side Effects**: activity log `booking.follow_up`

### Admin Operation: `Booking - Delete`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `DELETE /api/admin/bookings/[id]`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookedServiceSlice.ts:556-575`; `bookings/[id]/route.ts:264-341`
- **UI Screen / Component**: `/admin/bookings`
- **HTTP Method / SQL Action**: `DELETE notification` → `DELETE payments` → `DELETE booked_service`
- **Request Parameters / Payload**: booking id path param
- **Filters & Clauses Applied**: `.eq('booking_id', id)` / `.eq('id', id)`
- **Expected Response**: `{ ok: true }`
- **Side Effects**: cascade cleanup; activity log

### Admin Operation: `Booking - Initiate Chapa Payment`
- **Call Type**: `REST HTTP` + External HTTP (Chapa)
- **Target Route / Resource**: `POST /api/admin/bookings/payment`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookedServiceSlice.ts:467-488`; `payment/route.ts:58-233`
- **UI Screen / Component**: booking create/payment flows
- **HTTP Method / SQL Action**: read booking + `app_settings(id=payment)`; insert/update `payments`; POST Chapa initialize
- **Request Parameters / Payload**: `{ bookingId?: string; phone_number?: string }`
- **Filters & Clauses Applied**: reject if already paid
- **Expected Response**: `{ status:'success'; checkout_url?; tx_ref; booking_id; amount }`
- **Side Effects**: pending payment record; activity log; Chapa checkout

### Admin Operation: `Booking - Verify Chapa Payment`
- **Call Type**: `REST HTTP` + External HTTP (Chapa)
- **Target Route / Resource**: `POST /api/admin/bookings/payment/verify`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookedServiceSlice.ts:490-517`; `payment/verify/route.ts:24-136`
- **UI Screen / Component**: bookings page (incl. `?chapa_verify=`)
- **HTTP Method / SQL Action**: verify Chapa; `markBookingPaymentCompleted`
- **Request Parameters / Payload**: `{ bookingId: string }`
- **Filters & Clauses Applied**: booking by id; tx_ref from payment record
- **Expected Response**: `{ status:'success'|'pending'; booking_id?; message?; already_paid?; tx_ref?; amount?; chapa_reference? }`
- **Side Effects**: payment completion pipeline; activity log

### Admin Operation: `Booking - Chapa Payment Webhook`
- **Call Type**: Webhook
- **Target Route / Resource**: `POST /api/admin/bookings/payment/webhook`
- **Required Admin Permission**: Chapa signature (no admin JWT)
- **Source Code Location**: `payment/webhook/route.ts:16-63`
- **UI Screen / Component**: none
- **HTTP Method / SQL Action**: `markBookingPaymentCompleted`
- **Request Parameters / Payload**: `{ event?; tx_ref?; status?; reference? }`
- **Filters & Clauses Applied**: only `tx_ref` starting `bkg-`; success statuses only
- **Expected Response**: `{ status:'success'|'ignored'|'error', booking_id? }`
- **Side Effects**: same as verify completion

### Admin Operation: `Booking - Re-collect Payment`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/bookings/[id]/recollect-payment`
- **Required Admin Permission**: `bookings:write`
- **Source Code Location**: `bookedServiceSlice.ts:519-554`; `recollect-payment/route.ts:17-60`
- **UI Screen / Component**: `BookingDetailModal`
- **HTTP Method / SQL Action**: wallet debit or mark-paid via `recollectBookingPayment`
- **Request Parameters / Payload**: `{ mode: 'wallet' | 'mark_paid' }`
- **Filters & Clauses Applied**: booking id path
- **Expected Response**: `{ ok: true; mode; amount }`
- **Side Effects**: payments/wallet updates; activity log

### Admin Operation: `Booking - Debug Reload (Detail Panel)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `booked_service`, `payments`
- **Required Admin Permission**: `bookings:read`
- **Source Code Location**: `src/app/admin/bookings/page.tsx:118-195`
- **UI Screen / Component**: bookings debug / Chapa verify panel
- **HTTP Method / SQL Action**: `SELECT *` both tables
- **Request Parameters / Payload**: `bookingId`
- **Filters & Clauses Applied**: `.eq('id', bookingId)` / `.eq('booking_id', bookingId)`
- **Expected Response**: `{ booked_service, payments, errors, fetchedAt }`
- **Side Effects**: none

### Admin Operation: `Booking - Load Commission Config (Detail Modal)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `app_settings` id=`admin_commission`
- **Required Admin Permission**: `bookings:read`
- **Source Code Location**: `BookingDetailModal.tsx:356-375`
- **UI Screen / Component**: `BookingDetailModal`
- **HTTP Method / SQL Action**: `SELECT data` `.eq('id', 'admin_commission')`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: by settings id
- **Expected Response**: parsed `AdminCommissionConfig`
- **Side Effects**: none

### Admin Operation: `Booking - Load Wallet Ledger For Booking`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `wallet_transaction`
- **Required Admin Permission**: `bookings:read`
- **Source Code Location**: `BookingDetailModal.tsx:377-410`
- **UI Screen / Component**: `BookingDetailModal`
- **HTTP Method / SQL Action**: `SELECT id, amount, isCredit, note, type, paymentType, createdDate`
- **Request Parameters / Payload**: booking id
- **Filters & Clauses Applied**: `.eq('transactionId', bookingId).order('createdDate')`
- **Expected Response**: `WalletLedgerRow[]`
- **Side Effects**: none

### Admin Operation: `Booking - Nav Badge Counts`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/nav-action-counts` → `booked_service`
- **Required Admin Permission**: session + `bookings:read`
- **Source Code Location**: `nav-action-counts/route.ts:95-105`
- **UI Screen / Component**: Sidebar
- **HTTP Method / SQL Action**: count head `.in('status', ['pending','pending_approval'])`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: pending statuses only
- **Expected Response**: count number
- **Side Effects**: none

### Admin Operation: `Payments List (Finance UI; source = booked_service)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `booked_service` (normalized as `Payment`)
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `src/features/payments/paymentsSlice.ts:132-150`
- **UI Screen / Component**: `/admin/finance/payment`
- **HTTP Method / SQL Action**: `SELECT *` non-archived `.order('createdAt desc')`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: `.or('is_archived.is.null,is_archived.eq.false')`
- **Expected Response**: `Payment[]`
- **Side Effects**: none

### Admin Operation: `Payments - Update Payment Status (thunk; unused in UI)`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `booked_service`
- **Required Admin Permission**: intended `finance:write` / `bookings:write`
- **Source Code Location**: `paymentsSlice.ts:152-200`
- **UI Screen / Component**: none currently dispatching
- **HTTP Method / SQL Action**: `UPDATE payment_status / payment_id / paid_at / escrow_released_at / paymentCompleted`
- **Request Parameters / Payload**: `UpdatePaymentPayload`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `Payment`
- **Side Effects**: activity log

---

# 6. Finance, Payouts & Commission

### Admin Operation: `Payout - List Withdrawal Requests`
- **Call Type**: `Supabase Table Query` + `REST HTTP` for payment methods
- **Target Route / Resource**: `withdrawal_history`, `provider`; `POST /api/payout/provider-payment-methods`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `src/features/payout/payoutSlice.ts:233-283`
- **UI Screen / Component**: `/admin/finance/payout-request`
- **HTTP Method / SQL Action**: `SELECT *` withdrawals ORDER `createdDate` DESC
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: providers `.in('id', providerIds)`
- **Expected Response**: `PayoutRequest[]` (`type/withdrawal_history.ts`)
- **Side Effects**: none

### Admin Operation: `Payout - Approve / Reject`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/payout/review` → `withdrawal_history`
- **Required Admin Permission**: `finance:write`
- **Source Code Location**: `payoutSlice.ts:285-443`; `review/route.ts:24-149`
- **UI Screen / Component**: payout-request page / `PayoutRejectModal`
- **HTTP Method / SQL Action**: `UPDATE` → `approved` or `rejected` + `rejectionReason`
- **Request Parameters / Payload**:
  ```ts
  { withdrawalId: string; action: 'approve' | 'reject'; adminNote?: string; rejectionReason?: string }
  ```
- **Filters & Clauses Applied**: must be currently `pending`
- **Expected Response**: `{ status:'success'; data: WithdrawalHistoryRow }`
- **Side Effects**: in-app notification; push; activity log

### Admin Operation: `Payout - Mark Complete (manual thunk)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/payout/complete`
- **Required Admin Permission**: `finance:write`
- **Source Code Location**: `payoutSlice.ts:445-521`; `complete/route.ts:19-102`
- **UI Screen / Component**: **no UI dispatch** (live UI uses Chapa verify)
- **HTTP Method / SQL Action**: `UPDATE` completed + `paymentDate`; wallet deduct
- **Request Parameters / Payload**: `{ withdrawalId: string; adminNote?: string }`
- **Filters & Clauses Applied**: `.eq('id', withdrawalId)`
- **Expected Response**: `{ status:'success'; data; wallet }`
- **Side Effects**: `deductProviderWalletForWithdrawal`; notifications; activity log

### Admin Operation: `Payout - Send Via Chapa Transfer`
- **Call Type**: `REST HTTP` + External HTTP (Chapa)
- **Target Route / Resource**: `POST /api/payout/chapa-transfer`
- **Required Admin Permission**: `finance:write`
- **Source Code Location**: `payoutSlice.ts:523-602`; `chapa-transfer/route.ts:182-415`
- **UI Screen / Component**: payout-request confirm modal
- **HTTP Method / SQL Action**: read settings/withdrawal/methods; POST Chapa `/v1/transfers`; update note + status approved
- **Request Parameters / Payload**: `{ withdrawalId: string }`
- **Filters & Clauses Applied**: status in `approved|pending`; requires default payment method
- **Expected Response**: `{ tx_ref; transfer_id; message; source; destination; amount; chapa_fee?; net_transfer_amount? }`
- **Side Effects**: notification; push; activity log; fee breakdown note

### Admin Operation: `Payout - Verify Chapa Transfer`
- **Call Type**: `REST HTTP` + External HTTP (Chapa)
- **Target Route / Resource**: `POST /api/payout/chapa-verify-transfer`
- **Required Admin Permission**: `finance:write`
- **Source Code Location**: `payout-request/page.tsx:297-317`; `chapa-verify-transfer/route.ts:112-271`
- **UI Screen / Component**: `PayoutRequestActions` verify button
- **HTTP Method / SQL Action**: GET Chapa transfer verify; on success UPDATE completed + wallet deduct
- **Request Parameters / Payload**: `{ withdrawalId: string }`
- **Filters & Clauses Applied**: reference parsed from `adminNote`
- **Expected Response**: verify payload + `updatedPaymentStatus?`
- **Side Effects**: wallet deduction; notifications; push; activity log

### Admin Operation: `Payout - Chapa Transfer Webhook`
- **Call Type**: Webhook
- **Target Route / Resource**: `POST /api/payout/chapa-webhook`
- **Required Admin Permission**: Chapa signature
- **Source Code Location**: `chapa-webhook/route.ts:80-214`
- **UI Screen / Component**: none
- **HTTP Method / SQL Action**: update `withdrawal_history` completed/rejected; wallet deduct on success
- **Request Parameters / Payload**: `ChapaWebhookPayload`
- **Filters & Clauses Applied**: match by transfer reference / tx_ref
- **Expected Response**: status JSON
- **Side Effects**: notifications; activity log; wallet side effects

### Admin Operation: `Payout - Provider Wallet Analysis`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/payout/provider-wallet-analysis`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `provider-wallet-analysis/route.ts:75-259`
- **UI Screen / Component**: `PayoutWalletAnalysisSheet`
- **HTTP Method / SQL Action**: reads `provider`, `service_tier_payment`, `app_settings(constant)`, `wallet_transaction`, `booked_service`, `withdrawal_history`, `customer`
- **Request Parameters / Payload**: query `providerId` (required), `withdrawalId?`
- **Filters & Clauses Applied**: wallet by auth `userId`; bookings by provider
- **Expected Response**: `{ data: ProviderPayoutAnalysis }`
- **Side Effects**: none

### Admin Operation: `Payout - Export Audit CSV`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/payout/export-audit`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `export-audit/route.ts:69-191`
- **UI Screen / Component**: `/admin/finance/payout-request`
- **HTTP Method / SQL Action**: `SELECT` withdrawals (+ payment methods when segment missing)
- **Request Parameters / Payload**: query `segment`, `range`
- **Filters & Clauses Applied**: client-side segment/date filters after fetch
- **Expected Response**: CSV download
- **Side Effects**: none

### Admin Operation: `Payout - Fetch / Upsert Provider Payment Methods`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/payout/provider-payment-methods`; `POST /api/payout/provider-payment-methods-upsert`
- **Required Admin Permission**: read `finance:read`; upsert `finance:write`
- **Source Code Location**: `provider-payment-methods/route.ts:68-108`; `provider-payment-methods-upsert/route.ts:33-123`
- **UI Screen / Component**: used by `fetchPayoutRequests`; upsert API available
- **HTTP Method / SQL Action**: `SELECT *` `.in('providerID', providerIds)` / INSERT or UPDATE with default exclusivity
- **Request Parameters / Payload**: `{ providerIds: string[] }` / upsert bank fields + `providerID`
- **Filters & Clauses Applied**: prefer active + default method
- **Expected Response**: `{ data: Record<string, BankDetailsDto | null> }` / `{ status:'ok'; id }`
- **Side Effects**: may unset other defaults on upsert

### Admin Operation: `Payout - Create Notification`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/payout/create-notification` → `notification`
- **Required Admin Permission**: `finance:write`
- **Source Code Location**: `create-notification/route.ts:25-88`
- **UI Screen / Component**: called from payout slice after approve/reject/complete
- **HTTP Method / SQL Action**: `INSERT` (dedupe optional)
- **Request Parameters / Payload**: `{ title; description; type; provider_id?; …; dedupe_key? }`
- **Filters & Clauses Applied**: dedupe by type+description
- **Expected Response**: `{ status:'ok', deduped?: true }`
- **Side Effects**: activity log

### Admin Operation: `Payout - Process Booking Provider Payout (legacy)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/payout/process-booking`
- **Required Admin Permission**: `finance:write`
- **Source Code Location**: `payoutSlice.ts:632-659`; `process-booking/route.ts:25-148`
- **UI Screen / Component**: **no UI dispatch** (superseded by booking PATCH completion)
- **HTTP Method / SQL Action**: insert `wallet_transaction` type `provider_payout`, tx id `provider-payout:{bookingId}`
- **Request Parameters / Payload**: `{ bookingId: string }`
- **Filters & Clauses Applied**: booking must be completed + paid; idempotent on existing tx
- **Expected Response**: `{ bookingId; processed; alreadyProcessed? }`
- **Side Effects**: wallet credit; activity log

### Admin Operation: `Wallet Transactions - List Enriched`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/wallet-transactions`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `walletTransactionSlice.ts:138-154`; `wallet-transactions/route.ts:71-215`
- **UI Screen / Component**: `/admin/finance/wallet-transactions`
- **HTTP Method / SQL Action**: `SELECT *` wallet_transaction + profile/booking enrichment ORDER `createdDate` DESC
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: full ledger order by date
- **Expected Response**: `{ data: enriched WalletTransaction[] }`
- **Side Effects**: none

### Admin Operation: `Tax - CRUD Country Tax`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `country_tax`
- **Required Admin Permission**: UI under finance/settings (`finance:read` / `settings:write`)
- **Source Code Location**: `src/features/tax/taxSlice.ts:58-198`
- **UI Screen / Component**: `/admin/finance/taxes`; `CountryTaxSettingsPanel`
- **HTTP Method / SQL Action**: `SELECT *` / `INSERT` / `UPDATE` / `DELETE`
- **Request Parameters / Payload**: create `{ country?; name?; value?; active?; type? }`; update `{ id: number; … }`; delete `id`
- **Filters & Clauses Applied**: order `created_at` DESC; `type` drives `isFix`
- **Expected Response**: `CountryTax` / `CountryTax[]` / id (`type/country_tax.ts`)
- **Side Effects**: activity logs

### Admin Operation: `Payment / Commission Settings - Read/Write`
- **Call Type**: `Supabase Table Query` (read) + `REST HTTP` (write)
- **Target Route / Resource**: `app_settings` (`payment`, `admin_commission`); `POST /api/admin/settings`
- **Required Admin Permission**: write `finance:write` **or** `settings:write`
- **Source Code Location**: `settingsSlice.ts:429-519`; `api/admin/settings/route.ts`; `booking-admin-commission.ts`
- **UI Screen / Component**: `/admin/finance/payment-settings`; `/admin/settings`
- **HTTP Method / SQL Action**: `SELECT id,data` / upsert section JSON
- **Request Parameters / Payload**: `PaymentSettings` / `AdminCommissionSettings { isFix?; value?; active? }`
- **Filters & Clauses Applied**: settings rows by id
- **Expected Response**: `Settings` blob / upserted rows
- **Side Effects**: activity log; affects Chapa enablement + booking commission

### Admin Operation: `Commission - Apply On Booking Completion`
- **Call Type**: `Supabase Table Query` (library from booking PATCH)
- **Target Route / Resource**: `booked_service`, `wallet_transaction`, `provider`, `payments`, `app_settings`
- **Required Admin Permission**: via `bookings:write` on PATCH
- **Source Code Location**: `booking-completion-payout.ts`; `booking-admin-commission.ts`
- **UI Screen / Component**: booking status → completed in `BookingDetailModal`
- **HTTP Method / SQL Action**: compute fee; insert provider credit; update `adminCommission`; clawback on un-complete
- **Request Parameters / Payload**: `{ applyCommission?: boolean; commissionPercent?: number }`
- **Filters & Clauses Applied**: paid booking checks; idempotent wallet notes/tx ids
- **Expected Response**: `{ skipped, reason? } | { amount, walletAmount }`
- **Side Effects**: provider wallet balance update; ledger rows

### Admin Operation: `Chapa Balance`
- **Call Type**: `REST HTTP` + External HTTP (Chapa)
- **Target Route / Resource**: `GET /api/admin/chapa/balance`
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `chapa/balance/route.ts:8-33`
- **UI Screen / Component**: `/admin/dashboard`
- **HTTP Method / SQL Action**: load secret from settings/env; Chapa balance API
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: none
- **Expected Response**: `{ data: { currency; available_balance; ledger_balance } }`
- **Side Effects**: none

### Admin Operation: `Finance - Nav Pending Payout Badge`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `withdrawal_history` count
- **Required Admin Permission**: `finance:read`
- **Source Code Location**: `nav-action-counts/route.ts:43-53`
- **UI Screen / Component**: Sidebar
- **HTTP Method / SQL Action**: count head `.ilike('paymentStatus','pending')`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: pending status
- **Expected Response**: number
- **Side Effects**: none

---
# 7. Document Management & Deliveries

### Admin Operation: `Documents - List / Create / Update / Delete document types`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET|POST|PATCH|DELETE /api/admin/documents` → `documents`
- **Required Admin Permission**: read `documents:read`; write `documents:write`
- **Source Code Location**: `src/app/api/admin/documents/route.ts:23-196`; `documentSlice.ts:48-141`
- **UI Screen / Component**: `/admin/documents`; catalog pickers; `ProviderVerificationUpload`
- **HTTP Method / SQL Action**: `SELECT * ORDER BY name ASC` / `INSERT` / `UPDATE` / `DELETE`
- **Request Parameters / Payload**:
  ```ts
  // create: { name: string; active?: boolean; description?: string }
  // update: { id: string; name?; active?; description? }
  // delete: { id: string }
  ```
- **Filters & Clauses Applied**: name required on create; ≥1 field on update
- **Expected Response**: `{ data: DocumentRow }` / `{ ok: true }` — `DocumentRow: { id; name?; active?; description? }`
- **Side Effects**: activity logs

### Admin Operation: `Internal Documents - List library`
- **Call Type**: `REST HTTP` + `Storage` signed URL
- **Target Route / Resource**: `GET /api/admin/internal-documents` → `admin_documents` + bucket `admin-documents`
- **Required Admin Permission**: `documents:read` (preview URLs only if `*` or `super_admin`)
- **Source Code Location**: `internal-documents/route.ts:24-59`; `internal-documents/page.tsx`; `ProviderSharedDocuments.tsx`
- **UI Screen / Component**: `/admin/internal-documents`; provider shared-docs panel
- **HTTP Method / SQL Action**: `SELECT` ORDER `created_at` DESC; optional `createSignedUrl(..., 3600)`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: none; `preview_url` gated by role
- **Expected Response**: `{ documents: Array<AdminDocument & { preview_url: string | null }> }`
- **Side Effects**: none (signed URLs ephemeral)

### Admin Operation: `Internal Documents - Upload PDF`
- **Call Type**: `REST HTTP` + `Storage`
- **Target Route / Resource**: `POST /api/admin/internal-documents` → storage `admin-documents` + `admin_documents`
- **Required Admin Permission**: `documents:write`
- **Source Code Location**: `internal-documents/route.ts:61-126`; `src/lib/admin-documents/storage.ts:20-48`
- **UI Screen / Component**: `/admin/internal-documents`
- **HTTP Method / SQL Action**: multipart POST / `storage.upload` + `INSERT`
- **Request Parameters / Payload**: `FormData`: `title: string`, `category: 'agreement'|'policy'|'other'`, `file: File` (PDF, ≤10MB)
- **Filters & Clauses Applied**: PDF mime only; max `ADMIN_DOCUMENT_MAX_BYTES`; category default `other`
- **Expected Response**: `{ document: AdminDocument & { preview_url: string | null } }`
- **Side Effects**: storage object at `library/{uuid}.pdf`; activity log; `uploaded_by` = auth user id

### Admin Operation: `Internal Documents - Get by id`
- **Call Type**: `REST HTTP` + `Storage`
- **Target Route / Resource**: `GET /api/admin/internal-documents/[id]`
- **Required Admin Permission**: `documents:read`
- **Source Code Location**: `internal-documents/[id]/route.ts:17-55`
- **UI Screen / Component**: API available (no dedicated page caller found)
- **HTTP Method / SQL Action**: `SELECT … eq('id').maybeSingle()` + signed URL
- **Request Parameters / Payload**: path `id`
- **Filters & Clauses Applied**: `.eq('id', id)`
- **Expected Response**: `{ document: AdminDocument & { preview_url } }` or 404
- **Side Effects**: none

### Admin Operation: `Document Deliveries - List / Send to provider`
- **Call Type**: `REST HTTP` (+ FCM on send)
- **Target Route / Resource**: `GET|POST /api/admin/providers/[id]/document-deliveries`
- **Required Admin Permission**: GET `providers:read`; POST `providers:write`
- **Source Code Location**: See §2 `Providers - List/Send document deliveries`
- **UI Screen / Component**: `ProviderSharedDocuments`
- **HTTP Method / SQL Action**: SELECT / INSERT + FCM + notification
- **Request Parameters / Payload**: POST `{ documentId?; note? }`
- **Filters & Clauses Applied**: `recipient_type='provider'`
- **Expected Response**: deliveries list / `{ delivery; push }`
- **Side Effects**: FCM (`type:'document'`); in-app notification; activity log

> Receipt tracking uses `document_deliveries.acknowledged_at` (provider-side acknowledge; admin reads it on list).

---

# 8. CRM & Opportunities

> **Finding:** no `opportunity` / `lead` tables. Demand CRM = `job_request`. Sales leads = `marketing_tracker_row` (§10).

### Admin Operation: `Job Requests - List all`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/job-requests` → `job_request` + `customer`
- **Required Admin Permission**: `customers:read`
- **Source Code Location**: `src/app/api/job-requests/route.ts:63-129`; UI `customers/job-requests/page.tsx`
- **UI Screen / Component**: `/admin/customers/job-requests`
- **HTTP Method / SQL Action**: `SELECT * ORDER BY createdAt DESC` + customer enrich
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: customer lookup by `id` then unresolved refs via `user_id`
- **Expected Response**: `{ data: Array<job_request & { customerDisplayName; customerDisplayPhone }> }`
- **Side Effects**: none

### Admin Operation: `Job Requests - Update status / fields`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `PATCH /api/job-requests`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `job-requests/route.ts:145-224`
- **UI Screen / Component**: job-requests page; customer detail
- **HTTP Method / SQL Action**: `UPDATE eq('id')`
- **Request Parameters / Payload**:
  ```ts
  { id?: string; action?: 'accept' | 'reject' | 'pending'; title?: string; description?: string; price?: string }
  ```
- **Filters & Clauses Applied**: action maps to `accepted`/`status`
- **Expected Response**: `{ ok: true }`
- **Side Effects**: activity log (`approve`|`reject`|`update`)

### Admin Operation: `Job Requests - Delete one / Delete all for customer`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `DELETE /api/job-requests`
- **Required Admin Permission**: `customers:write`
- **Source Code Location**: `job-requests/route.ts:226-300`
- **UI Screen / Component**: job-requests / customer pages
- **HTTP Method / SQL Action**: `DELETE` by `id` OR loop by customer refs
- **Request Parameters / Payload**: `{ id?: string; customerId?: string }`
- **Filters & Clauses Applied**: if `customerId`, delete for id + user_id
- **Expected Response**: `{ ok: true; deleted: number }`
- **Side Effects**: activity log

### Admin Operation: `Job Requests - List for customer / Nav pending count / Dashboard read`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/customers/[id]/job-requests`; nav counts; dashboard analytics
- **Required Admin Permission**: `customers:read` (nav); session (dashboard)
- **Source Code Location**: `customers/[id]/job-requests/route.ts`; `nav-action-counts/route.ts:108-122`; `dashboard/analytics/route.ts:47`
- **UI Screen / Component**: customer detail; Sidebar; `/admin/dashboard`
- **HTTP Method / SQL Action**: SELECT / filter pending (`accepted !== true` and status pending/empty)
- **Request Parameters / Payload**: path customer id / none
- **Filters & Clauses Applied**: see above
- **Expected Response**: projected job rows / nav count / folded into analytics
- **Side Effects**: none

---

# 9. Content & Blog

### Admin Operation: `Blog - List / Create / Update / Delete posts`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET|POST|PATCH|DELETE /api/blog-posts` → `blog_post` (+ `blog_comment(count)` on list)
- **Required Admin Permission**: read `catalog:read`; write `catalog:write`
- **Source Code Location**: `blog-posts/route.ts:104-278`; `blogSlice.ts:80-154`; UI `blog/page.tsx`
- **UI Screen / Component**: `/admin/blog`
- **HTTP Method / SQL Action**: SELECT with comment count ORDER `updated_at` DESC / INSERT / UPDATE / DELETE
- **Request Parameters / Payload**:
  ```ts
  type BlogPostInput = {
    title: string; slug: string; excerpt?: string; contentHtml: string;
    coverImage?: string; authorName?: string; status: 'draft'|'published';
    publishedAt?: string | null;
  }
  // update: { id: string } & Partial<BlogPostInput>
  // delete: { id: string }
  ```
- **Filters & Clauses Applied**: slugify on create; published_at rules on status
- **Expected Response**: `{ data: BlogPostRow }` / `{ ok: true }`
- **Side Effects**: activity logs

### Admin Operation: `Blog Comments - List / Update status / Delete`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET|PATCH|DELETE /api/blog-posts/[id]/comments` → `blog_comment`
- **Required Admin Permission**: read `catalog:read`; write `catalog:write`
- **Source Code Location**: `comments/route.ts:22-121`; UI `blog/page.tsx` comments modal
- **UI Screen / Component**: `/admin/blog` comments modal
- **HTTP Method / SQL Action**: SELECT by `post_id` ORDER `created_at` DESC / UPDATE status / DELETE
- **Request Parameters / Payload**:
  ```ts
  // patch: { commentId?: string; status?: 'approved' | 'hidden' | 'pending' }
  // delete: { commentId?: string }
  ```
- **Filters & Clauses Applied**: status whitelist; scoped to post
- **Expected Response**: `{ data: CommentRow[] | CommentRow }` / `{ ok: true }`
- **Side Effects**: activity logs on mutate

### Admin Operation: `Banners - List / Create / Update / Delete`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET|POST|PATCH|DELETE /api/banners` → `banner`
- **Required Admin Permission**: read `catalog:read`; write `catalog:write`
- **Source Code Location**: `banners/route.ts:26-182`; `bannerSlice.ts:44-139`; UI `banners/page.tsx`
- **UI Screen / Component**: `/admin/banners`
- **HTTP Method / SQL Action**: SELECT ORDER `created_at` DESC / INSERT / UPDATE / DELETE
- **Request Parameters / Payload**:
  ```ts
  // create: { bannerName: string; image: string; link?: string; active?: boolean }
  // update: { id: number; bannerName?; image?; link?; active? }
  // delete: { id: number }
  ```
- **Filters & Clauses Applied**: bannerName+image required on create
- **Expected Response**: `{ data: BannerRow }` / `{ ok: true }` (`type/banner.ts`)
- **Side Effects**: activity logs

---

# 10. Marketing Tracker

Types: `src/lib/marketing-tracker.ts` (`MarketingTrackerSheet|Column|Row`, cell values).

### Admin Operation: `Marketing Tracker - Load sheet workspace`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/marketing-tracker` → sheets/columns/rows
- **Required Admin Permission**: `catalog:read`
- **Source Code Location**: `marketing-tracker/route.ts:12-67`; UI `marketing-tracker/page.tsx`
- **UI Screen / Component**: `/admin/marketing-tracker`
- **HTTP Method / SQL Action**: three SELECTs
- **Request Parameters / Payload**: query `?sheet_id=`
- **Filters & Clauses Applied**: sheets by `position ASC`; active sheet = requested or first; columns/rows `eq('sheet_id')` by position
- **Expected Response**: `{ sheets; active_sheet_id; columns; rows }`
- **Side Effects**: none

### Admin Operation: `Marketing Tracker - Create / Rename / Delete sheet`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/marketing-tracker/sheets`; `PATCH|DELETE …/sheets/[id]`
- **Required Admin Permission**: `catalog:write`
- **Source Code Location**: `sheets/route.ts`; `sheets/[id]/route.ts`
- **UI Screen / Component**: marketing tracker
- **HTTP Method / SQL Action**: INSERT `{ name, position }` / UPDATE name / DELETE (cannot delete last sheet)
- **Request Parameters / Payload**: create `{ name? }`; rename `{ name }`; delete path id
- **Filters & Clauses Applied**: name default `Sheet N`; position = count+1; count ≤1 → 400 on delete
- **Expected Response**: `{ sheet, columns: [], rows: [] }` / `{ sheet }` / `{ ok: true; deleted_sheet_name }`
- **Side Effects**: activity log on create; cascade depends on FK

### Admin Operation: `Marketing Tracker - Add / Patch / Delete column`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST …/columns`; `PATCH|DELETE …/columns/[id]`
- **Required Admin Permission**: `catalog:write`
- **Source Code Location**: `columns/route.ts`; `columns/[id]/route.ts`
- **UI Screen / Component**: marketing tracker
- **HTTP Method / SQL Action**: INSERT unique key; UPDATE `label|width_px`; DELETE after stripping key from all row `values`
- **Request Parameters / Payload**:
  ```ts
  // add: { sheet_id?; label?; column_type?: 'text'|'yes-no'|'boolean'|'date' }
  // patch: { label?; width_px?: number | null } // width clamped 80–800
  ```
- **Filters & Clauses Applied**: unique `key` per sheet; `is_system: false` for custom
- **Expected Response**: `{ column }` / `{ ok: true }`
- **Side Effects**: mutates all rows’ `values` on delete; activity logs on add/delete

### Admin Operation: `Marketing Tracker - Add / Patch / Delete row (lead)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST …/rows`; `PATCH|DELETE …/rows/[id]`
- **Required Admin Permission**: `catalog:write`
- **Source Code Location**: `rows/route.ts`; `rows/[id]/route.ts`; `mobile-add-lead.tsx`
- **UI Screen / Component**: marketing tracker / mobile add lead
- **HTTP Method / SQL Action**: INSERT `{ values: {} }` with position shift; merge `values` + `updated_at`; DELETE
- **Request Parameters / Payload**:
  ```ts
  // add: { sheet_id?; after_row_id?; at_start?: boolean }
  // patch: { values?: Record<string, string | boolean | null> }
  ```
- **Filters & Clauses Applied**: insert at end, start, or after row; shallow merge values
- **Expected Response**: `{ row }` / `{ ok: true }`
- **Side Effects**: may update many row positions; activity log on create/delete (not on cell patch)

---

# 11. Platform Configuration

### Admin Operation: `Settings - Fetch app settings + languages`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: tables `app_settings`, `languages`
- **Required Admin Permission**: UI gate `settings:read` (no API permission check on read)
- **Source Code Location**: `settingsSlice.ts:449-476`
- **UI Screen / Component**: `/admin/settings`, payment-settings, provider pages
- **HTTP Method / SQL Action**: `SELECT id,data` + `SELECT id,code,name,active`
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: none
- **Expected Response**: `Settings` (sections: settings/payment/policy/contact_us/admin_commission/status/constant + languages)
- **Side Effects**: none

### Admin Operation: `Settings - Update (multi-section)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/admin/settings` → `app_settings` + `languages`
- **Required Admin Permission**: `settings:write`; **or** (`finance:write` if payment-only payload)
- **Source Code Location**: `settings/route.ts:146-256`; `settingsSlice.ts:478-519`
- **UI Screen / Component**: `/admin/settings`; `/admin/finance/payment-settings`
- **HTTP Method / SQL Action**: upsert sections + language upsert/insert/delete
- **Request Parameters / Payload**:
  ```ts
  interface SettingsPayload {
    appSettings?: AppSettings; generalSettings?: GeneralSettings; policySettings?: PolicySettings;
    paymentSettings?: PaymentSettings; contactUs?: ContactUsSettings;
    adminCommission?: AdminCommissionSettings; statusOptions?: BookingStatusOption[];
    constants?: ConstantSettings; languageSettings?: LanguageSetting[]; languageDeletedIds?: string[];
  }
  ```
- **Filters & Clauses Applied**: merge-patch per section id; languages filtered non-empty code/name
- **Expected Response**: `{ data: { appRows, languageRows } }`
- **Side Effects**: client `logClientAdminActivity`

### Admin Operation: `Languages - Bulk mutate (alternate API)`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `POST /api/settings/languages` → `languages`
- **Required Admin Permission**: `settings:write`
- **Source Code Location**: `settings/languages/route.ts:27-86`
- **UI Screen / Component**: primarily via settings POST; this route still exists
- **HTTP Method / SQL Action**: upsert + insert + delete.in
- **Request Parameters / Payload**: `{ upserts?; inserts?; deleteIds?: string[] }`
- **Filters & Clauses Applied**: deleteIds trimmed
- **Expected Response**: `{ ok: true }`
- **Side Effects**: activity log

### Admin Operation: `Taxes - CRUD` / `Coupons - CRUD`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `country_tax`; `coupon`
- **Required Admin Permission**: taxes → settings/finance UI; coupons → `catalog:read`/`catalog:write` (`/admin/coupon`)
- **Source Code Location**: `taxSlice.ts:58-198`; `couponSlice.ts:59-217`
- **UI Screen / Component**: `/admin/finance/taxes`; `/admin/coupon`; `CreateBookingModal` reads coupons
- **HTTP Method / SQL Action**: SELECT ORDER `created_at` DESC / INSERT / UPDATE / DELETE
- **Request Parameters / Payload**: tax `{ country?; name?; value?; active?; type? }`; coupon `{ title; code; amount?; minAmount?; active?; isPrivate?; isFix?; expiredAt? }`
- **Filters & Clauses Applied**: by id on update/delete
- **Expected Response**: entity / list / id
- **Side Effects**: client activity logs

### Admin Operation: `Mobile App Config - List / Update`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET|PATCH /api/admin/mobile-app-config` → `mobile_app_config`
- **Required Admin Permission**: GET `settings:read` **or** `contact:read`; PATCH `settings:write` **or** `contact:write`
- **Source Code Location**: `mobile-app-config/route.ts:79-160`; UI `mobile-app-config/page.tsx`
- **UI Screen / Component**: `/admin/mobile-app-config`
- **HTTP Method / SQL Action**: SELECT ORDER `app_key ASC` / UPDATE `.eq('app_key')`
- **Request Parameters / Payload**:
  ```ts
  { appKey?; maintenanceMode?; maintenanceMessage?; maintenanceAffectedVersions?: { version; build }[];
    updateNeeded?; updateMessage?; updateAffectedVersions?: { version; build }[] }
  ```
- **Filters & Clauses Applied**: appKey required on PATCH; row must exist
- **Expected Response**: `{ data: normalizedRow[] | normalizedRow }`
- **Side Effects**: activity log (maintenance / version update rules)

---

# 12. Audit & Activity Logs

### Admin Operation: `Activity Logs - List`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/activity-logs` → `admin_activity_log`
- **Required Admin Permission**: `logs:read`
- **Source Code Location**: `activity-logs/route.ts:26-69`; `activityLogSlice.ts:26-58`; UI `activity-logs/page.tsx`
- **UI Screen / Component**: `/admin/activity-logs`
- **HTTP Method / SQL Action**: `SELECT *, count exact` + enrich
- **Request Parameters / Payload**: query `admin_id?`, `action?`, `resource_type?`, `limit?` (1–200, default 50), `offset?` (default 0)
- **Filters & Clauses Applied**: optional eq filters; `ORDER BY created_at DESC`; range pagination
- **Expected Response**: `{ data: AdminActivityLog[]; total: number; limit: number; offset: number }`
- **Side Effects**: enrichment lookups via `enrichActivityLogs`

### Admin Operation: `Activity Logs - Create`
- **Call Type**: `REST HTTP` or server helper `logAdminActivity`
- **Target Route / Resource**: `POST /api/admin/activity-logs` → `admin_activity_log`
- **Required Admin Permission**: authenticated admin session (`requireAdminSession`)
- **Source Code Location**: `activity-logs/route.ts:71-99`; `admin-activity-log.ts:64-96`; `record-admin-activity.ts`
- **UI Screen / Component**: many slices/pages via `logClientAdminActivity`; most APIs call `logAdminActivity` directly
- **HTTP Method / SQL Action**: `INSERT`
- **Request Parameters / Payload**:
  ```ts
  interface CreateActivityLogPayload {
    action: string; resource_type: string; resource_id?: string;
    summary: string; metadata?: Record<string, unknown>;
  }
  ```
- **Filters & Clauses Applied**: action/resource_type/summary required; metadata sanitized; actor from session
- **Expected Response**: `{ ok: true }`
- **Side Effects**: inserts audit row with env + route path

---

# 13. Other Admin Operations

### Admin Operation: `Dashboard - Analytics`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/dashboard/analytics`
- **Required Admin Permission**: admin session (`requireAdminSession`)
- **Source Code Location**: `dashboard/analytics/route.ts:37-77`
- **UI Screen / Component**: `/admin/dashboard`
- **HTTP Method / SQL Action**: SELECT `wallet_transaction` `*`; `booked_service` non-archived; `job_request` subset
- **Request Parameters / Payload**: query `range=today|7d|30d|all` (default `30d`)
- **Filters & Clauses Applied**: date filter applied in-memory after fetch
- **Expected Response**: `{ data: { range; revenueBreakdown; totals: { walletRows; bookings; jobRequests } } }`
- **Side Effects**: none

### Admin Operation: `Dashboard - Client supplemental queries`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `booked_service`, `customer`, `job_request`, `withdrawal_history`
- **Required Admin Permission**: authenticated admin UI
- **Source Code Location**: `src/app/admin/dashboard/page.tsx` (~599–861)
- **UI Screen / Component**: `/admin/dashboard`
- **HTTP Method / SQL Action**: SELECT subsets for charts/stats
- **Request Parameters / Payload**: none (client-side range filters)
- **Filters & Clauses Applied**: page-local
- **Expected Response**: rows used for dashboard widgets
- **Side Effects**: none

### Admin Operation: `Push/SMS - Broadcast providers / customers`
- **Call Type**: `REST HTTP` + FCM/SMS
- **Target Route / Resource**: `POST /api/admin/push/providers`; `POST /api/admin/push/customers`
- **Required Admin Permission**: `notifications:write`
- **Source Code Location**: `push/providers/route.ts:44-134`; `push/customers/route.ts:45-135`; UI `push/page.tsx`
- **UI Screen / Component**: `/admin/push`
- **HTTP Method / SQL Action**: SELECT audience then loop send
- **Request Parameters / Payload**: `{ title; body; route?; activeOnly?: boolean; channel: 'push'|'sms'|'both' }`
- **Filters & Clauses Applied**: default `activeOnly=true` → `eq('active', true)`
- **Expected Response**: `{ ok; channel; attempted; sent; skipped; failed; push; sms }`
- **Side Effects**: FCM/SMS; activity log `broadcast`

### Admin Operation: `Push - Notify single (event/custom)`
- **Call Type**: `REST HTTP` + FCM/SMS
- **Target Route / Resource**: `POST /api/admin/push/notify`
- **Required Admin Permission**: `notifications:write`
- **Source Code Location**: `push/notify/route.ts:125-301`
- **UI Screen / Component**: notify composers; verify-docs; payout flows
- **HTTP Method / SQL Action**: read phone/FCM profiles + send
- **Request Parameters / Payload**:
  ```ts
  { audience?: 'provider'|'customer'; providerId?; customerId?;
    event?: PayoutNotifyEvent | 'document_approved'|'document_rejected'|'account_approved'|'custom';
    amount?; rejectionReason?; providerName?; documentName?; title?; body?; route?; type?; channel? }
  ```
- **Filters & Clauses Applied**: audience-specific id required
- **Expected Response**: `{ ok: true }` or `{ ok: true; push?; sms? }`
- **Side Effects**: FCM/SMS; may clear stale FCM tokens

### Admin Operation: `SMS - Proxy send`
- **Call Type**: `REST HTTP` + External SMS
- **Target Route / Resource**: `POST /api/sms/send`
- **Required Admin Permission**: `providers:verify`
- **Source Code Location**: `sms/send/route.ts:14-52`; verify-documents page
- **UI Screen / Component**: `/admin/verify-documents`
- **HTTP Method / SQL Action**: POST upstream SMS
- **Request Parameters / Payload**: `{ recipient?; message?; callback? }`
- **Filters & Clauses Applied**: recipient+message required
- **Expected Response**: `{ success: true }` or error
- **Side Effects**: activity log; external SMS

### Admin Operation: `In-app Notifications - CRUD`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: table `notification`
- **Required Admin Permission**: UI `notifications:read` / write
- **Source Code Location**: `notificationSlice.ts:57-199`; `notifications/page.tsx`; `NotificationBell.tsx`
- **UI Screen / Component**: `/admin/notifications`; header bell
- **HTTP Method / SQL Action**: `SELECT * ORDER BY created_at DESC LIMIT 100`; update read flags; delete
- **Request Parameters / Payload**: mark read `{ id }` | bulk `{ ids }` | all unread; delete `{ id }` | `{ ids }`
- **Filters & Clauses Applied**: mark-all `eq('is_read', false)`; bulk `.in('id', ids)`
- **Expected Response**: `NotificationItem[]` / read timestamps / deleted ids
- **Side Effects**: client activity logs; ops inbox derives categories client-side

### Admin Operation: `Ops Inbox Alerts - Optional SMS`
- **Call Type**: `REST HTTP` + External SMS
- **Target Route / Resource**: `POST /api/admin/ops-alert`
- **Required Admin Permission**: admin session
- **Source Code Location**: `ops-alert/route.ts:14-42`; `ops-inbox-alerts.ts:150-164`
- **UI Screen / Component**: ops desk prefs (SMS currently forced off in prefs loader)
- **HTTP Method / SQL Action**: POST / `sendOpsAlertSms`
- **Request Parameters / Payload**: `{ title?; body?; count?; message? }`
- **Filters & Clauses Applied**: builds message from title/body/count if message empty
- **Expected Response**: `{ ok: true }` | `{ ok: true; skipped }` | error
- **Side Effects**: SMS to ops number when configured

### Admin Operation: `Nav Action Counts - Aggregate badges`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/admin/nav-action-counts`
- **Required Admin Permission**: admin session; per-bucket permission gates
- **Source Code Location**: `nav-action-counts/route.ts:24-131`; `use-nav-action-counts.ts`; Sidebar
- **UI Screen / Component**: Sidebar action badges
- **HTTP Method / SQL Action**: count queries (see filters)
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**:
  - payouts: `withdrawal_history` `paymentStatus ilike pending` (`finance:read`)
  - verify-docs: `verify_documents` `isVerify is null` (`providers:verify`)
  - approve services: unapproved + featured pending (`services:read`)
  - bookings: status in pending/pending_approval (`bookings:read`)
  - job requests: pending filter (`customers:read`)
- **Expected Response**: `{ counts: NavActionCounts }`
- **Side Effects**: none

### Admin Operation: `Handyman - List / Create / Update / Delete`
- **Call Type**: `Supabase Table Query`
- **Target Route / Resource**: `handyman`
- **Required Admin Permission**: UI `providers:read` (`/admin/handyman`); mutations not separately ACL’d on API
- **Source Code Location**: `handymanSlice.ts:92-266`; UI `handyman/page.tsx`
- **UI Screen / Component**: `/admin/handyman`; provider detail
- **HTTP Method / SQL Action**: SELECT ORDER `createdAt` DESC / insert / update / delete
- **Request Parameters / Payload**: `Partial<Handyman>` (+ id for update/delete)
- **Filters & Clauses Applied**: field map camelCase↔DB
- **Expected Response**: `Handyman[]` / `Handyman` / id (`type/handyman.ts`)
- **Side Effects**: client activity logs

### Admin Operation: `Contact Messages - List`
- **Call Type**: `REST HTTP`
- **Target Route / Resource**: `GET /api/contact-messages` → `contact_messages`
- **Required Admin Permission**: `contact:read`
- **Source Code Location**: `contact-messages/route.ts:7-28`; UI `contact-messages/page.tsx`
- **UI Screen / Component**: `/admin/contact-messages`
- **HTTP Method / SQL Action**: SELECT `id,name,email,subject,message,created_at` ORDER `created_at` DESC
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: none
- **Expected Response**: `{ data: Array<{ id, name, email, subject, message, created_at }> }`
- **Side Effects**: none

### Admin Operation: `Realtime - Postgres changes fan-out refetch`
- **Call Type**: `Realtime`
- **Target Route / Resource**: `postgres_changes` schema `public` event `*`
- **Required Admin Permission**: authenticated admin client session
- **Source Code Location**: `RealtimeDataSync.tsx:72-95`
- **UI Screen / Component**: app-wide
- **HTTP Method / SQL Action**: subscribe → debounced refetch of many slices
- **Request Parameters / Payload**: none
- **Filters & Clauses Applied**: all public table changes; 2s debounce
- **Expected Response**: N/A (triggers Redux refetches)
- **Side Effects**: broad list refreshes

---
# Appendix A — Permission Catalog & Route Gates

## Permission keys (`src/lib/admin-permissions.ts`)

| Key | Label | Group |
|---|---|---|
| `providers:read` | View providers | Providers |
| `providers:write` | Manage providers | Providers |
| `providers:verify` | Verify provider documents | Providers |
| `services:read` | View services | Services |
| `services:write` | Manage services | Services |
| `catalog:read` | View catalog | Catalog |
| `catalog:write` | Manage catalog | Catalog |
| `bookings:read` | View bookings | Bookings |
| `bookings:write` | Manage bookings | Bookings |
| `customers:read` | View customers | Customers |
| `customers:write` | Manage customers | Customers |
| `notifications:read` | View notifications | Notifications |
| `notifications:write` | Manage notifications | Notifications |
| `finance:read` | View finance | Finance |
| `finance:write` | Manage finance | Finance |
| `contact:read` | View contact messages | Contact |
| `contact:write` | Manage contact messages | Contact |
| `documents:read` | View documents | Documents |
| `documents:write` | Manage documents | Documents |
| `settings:read` | View settings | Settings |
| `settings:write` | Manage settings | Settings |
| `admins:read` | View admins | Administration |
| `admins:write` | Manage admins | Administration |
| `roles:read` | View roles | Administration |
| `roles:write` | Manage roles | Administration |
| `logs:read` | View activity logs | Administration |
| `*` | Wildcard (super admin) | — |

Matching: exact key, `*` wildcard, or `prefix:*` via `permissionMatches`.

## Default system roles

| Slug | Permissions (summary) |
|---|---|
| `super_admin` | `['*']` |
| `operations_admin` | providers/services/catalog/bookings/customers/notifications read+write (+ verify) |
| `finance_admin` | `finance:read`, `finance:write` |
| `support_admin` | customers/bookings/contact/providers/services/catalog/notifications/settings write + finance read; **denylist** documents |
| `viewer` | broad read-only; **denylist** `services:write` |

## Route gates (`canAccessAdminRoute`)

| Path prefix | Required permission |
|---|---|
| `/admin/dashboard`, `/admin` | always (authenticated admin) |
| `/admin/providers` | `providers:read` |
| `/admin/verify-documents` | `providers:verify` |
| `/admin/services` | `services:read` |
| `/admin/categories`, `/admin/subcategories` | `catalog:read` |
| `/admin/documents`, `/admin/internal-documents` | `documents:read` |
| `/admin/banners`, `/admin/coupon`, `/admin/blog` | `catalog:read` |
| `/admin/bookings` | `bookings:read` |
| `/admin/handyman` | `providers:read` |
| `/admin/customers/job-requests`, `/admin/customers` | `customers:read` |
| `/admin/finance` | `finance:read` |
| `/admin/notifications` | `notifications:read` |
| `/admin/settings` | `settings:read` |
| `/admin/mobile-app-config` | `settings:read` OR `contact:read` |
| `/admin/admins` | `admins:read` |
| `/admin/roles` | `roles:read` |
| `/admin/activity-logs` | `logs:read` |
| `/admin/contact-messages` | `contact:read` |
| `/admin/push` | `notifications:write` |
| `/admin/marketing-tracker` | `catalog:read` |
| `/admin/product-scorecard` | always |

---

# Appendix B — Tables / Storage / External Resources

## Postgres tables touched by admin dashboard

| Table | Modules |
|---|---|
| `admin`, `admin_role` | Auth/RBAC |
| `admin_activity_log` | Audit (+ side effect everywhere) |
| `provider`, `companies`, `provider_payment_methods` | Providers / Finance |
| `verify_documents`, `documents`, `sub_category_documents` | Verification / Catalog |
| `customer` | Customers |
| `job_request` | CRM |
| `service` / `services` | Services |
| `category`, `sub_category` | Catalog |
| `booked_service`, `payments` | Bookings / Finance |
| `wallet_transaction` | Finance / Bookings / Activation |
| `withdrawal_history` | Payouts |
| `service_tier_payment` | Activation / Payout analysis |
| `app_settings`, `languages` | Settings |
| `country_tax`, `coupon` | Config |
| `mobile_app_config` | Mobile version / maintenance |
| `admin_documents`, `document_deliveries` | Internal docs |
| `blog_post`, `blog_comment` | Blog |
| `banner` | Banners |
| `marketing_tracker_sheet`, `marketing_tracker_column`, `marketing_tracker_row` | Marketing |
| `notification` | Inbox / push side effects |
| `handyman` | Handyman |
| `contact_messages` | Contact |

## Storage buckets

| Bucket | Usage |
|---|---|
| `betegnabucket` | Provider verification document image uploads |
| `admin-documents` | Internal compliance PDFs (`library/{uuid}.pdf`) |
| Service media paths | Service images/videos under public provider folders |

## Auth / External

| Resource | Usage |
|---|---|
| Supabase Auth (user + Admin API) | Login, session, create/update/delete admin/provider/customer users |
| Supabase Realtime | `RealtimeDataSync` refetch |
| Edge `add_customer` | Legacy customer create |
| Chapa HTTP | Booking pay, activation, payout transfer/verify/webhook, balance |
| FCM | Push notify / broadcasts / document delivery |
| SMS upstream | Credential SMS, verify-docs SMS, broadcasts, ops alert |

## Supabase RPC (admin UI path)

No admin UI path invokes `supabase.rpc(...)`. RPC `get_deletable_storage_paths` appears only in `scripts/cleanup-storage-orphans.ts` (ops tooling).

---

# Appendix C — Shared TypeScript Types

```ts
// type/admin.ts
export interface AdminUser {
  id: string; user_id: string; full_name: string | null; role: string;
  is_active: boolean; created_at: string; updated_at: string; email?: string | null;
}
export interface AdminRole {
  id: string; slug: string; name: string; description: string | null;
  permissions: string[]; is_system: boolean; created_at: string; updated_at: string;
}

// type/activity-log.ts
export interface AdminActivityLog {
  id: string; created_at: string; admin_id: string | null; admin_email: string | null;
  admin_name: string | null; admin_role: string | null; action: string; resource_type: string;
  resource_id: string | null; resource_name?: string | null; route: string | null;
  summary: string; display_summary?: string; metadata: Record<string, unknown>; env: string;
}
export interface CreateActivityLogPayload {
  action: string; resource_type: string; resource_id?: string;
  summary: string; metadata?: Record<string, unknown>;
}

// type/provider.ts — ProviderSchema (key fields)
export interface ProviderSchema {
  id: string; user_id?: string; firstName?: string; lastName?: string; email?: string;
  phone?: string; phoneNumber?: string; companyName?: string; address?: string;
  countryCode?: string; location?: Record<string, unknown> | null; walletAmount?: string;
  active?: boolean; fcmToken?: string; activation_paid?: boolean; activation_paid_at?: string;
  activation_tx_ref?: string; archived_at?: string | null; signupSource?: string | null;
  // … plus company/profile/banner fields (see type/provider.ts)
}

// type/customer.ts
export interface CustomerAddressSchema {
  city?: string; state?: string; country?: string; postal_code?: string;
}
export interface CustomerSchema {
  id?: string; first_name?: string; last_name?: string; email?: string;
  country_code?: string; phone?: string; phoneNumber?: string; wallet_amount?: number;
  default_address?: CustomerAddressSchema | null | string; provider_id?: string;
  archived_at?: string | null; signup_source?: string | null;
  // … see type/customer.ts
}

// type/booked_service.ts
export interface BookedServiceSchema {
  id: string; provider_id: string; customer_id?: string | null; service_id?: string;
  serviceName?: string; price?: number; totalAmount?: number; quantity?: string;
  bookingDate?: string; createdAt?: string;
  status?: 'pending'|'accepted'|'rejected'|'on_the_way'|'in_progress'|'hold'
    |'completed'|'pending_extra_payment'|'pending_approval'|'admin_paid';
  paymentCompleted?: boolean; description?: string;
}

// type/verify_documents.ts
export interface VerifyDocumentsSchema {
  id: string; providerId: string; providerName?: string; documentId?: string;
  documentName?: string; documentImage?: string; isVerify?: boolean | null; createdAt?: string;
}

// type/withdrawal_history.ts
export interface WithdrawalHistorySchema {
  id: string; providerId: string; note?: string; adminNote?: string;
  amount: string | number;
  paymentStatus?: 'pending'|'approved'|'rejected'|'completed';
  createdDate?: string; paymentDate?: string;
}

// src/lib/admin-documents/types.ts
export type AdminDocumentCategory = 'agreement' | 'policy' | 'other';
export interface AdminDocument {
  id: string; title: string; category: AdminDocumentCategory; storage_path: string;
  file_name: string; mime_type: string; uploaded_by: string | null;
  created_at: string; updated_at: string;
}
export interface DocumentDelivery {
  id: string; document_id: string; recipient_type: string; recipient_id: string;
  sent_by: string | null; sent_at: string; acknowledged_at: string | null;
  document_title?: string | null; document_category?: string | null; file_name?: string | null;
}

// src/lib/marketing-tracker.ts
export type MarketingTrackerColumnType = 'text' | 'boolean' | 'date';
export interface MarketingTrackerSheet { id: string; name: string; position: number; created_at: string }
export interface MarketingTrackerColumn {
  id: string; sheet_id: string; key: string; label: string;
  column_type: MarketingTrackerColumnType; position: number; is_system: boolean;
  width_px: number | null; created_at: string;
}
export interface MarketingTrackerRow {
  id: string; sheet_id: string; position: number;
  values: Record<string, string | boolean | null>;
  created_at: string; updated_at: string;
}

// settingsSlice.ts (selected)
export interface AppSettings { appColor?; appName?; appVersion?; extraCharge_GST?; googleMapKey?; minimum_amount_deposit?; minimum_amount_withdraw? }
export interface PaymentSettings { chapa?; telebirr?; wallet?; flutterWave? }
export interface AdminCommissionSettings { isFix?: boolean; value?: string; active?: boolean }
export interface ConstantSettings {
  minimum_wallet_balance_to_keep?; minimum_amount_withdraw?; maximum_amount_withdraw?;
  provider_service_featured_request_fee_amount?; provider_activation_account_activation_fee_amount?;
  service_posting_tiers?; recurring_payments?;
}
export interface Settings {
  appSettings: AppSettings; generalSettings: GeneralSettings; policySettings: PolicySettings;
  paymentSettings: PaymentSettings; languageSettings?: LanguageSettings; contactUs?: ContactUsSettings;
  adminCommission?: AdminCommissionSettings; statusOptions?: BookingStatusOption[]; constants?: ConstantSettings;
}

// NavActionCounts
export interface NavActionCounts {
  '/admin/finance/payout-request': number;
  '/admin/verify-documents': number;
  '/admin/services/approve': number;
  '/admin/bookings': number;
  '/admin/customers/job-requests': number;
}
```

Also see: `type/service.ts`, `type/services.ts`, `type/category.ts`, `type/sub_category.ts`, `type/coupon.ts`, `type/country_tax.ts`, `type/banner.ts`, `type/handyman.ts`, `type/payments.ts`, `type/documents.ts`.

---

# Appendix D — Migration Notes

1. **Dual access paths:** Many list/mutations still hit Supabase **from the browser** (providers list, verify approve/reject, services, categories, taxes, coupons, notifications, handyman, settings read). FastAPI must expose equivalents or keep temporary dual-write carefully.

2. **Auth context:** Every protected admin API does JWT → `admin` row → `admin_role.permissions` (+ denylist). FastAPI should mirror `requireAdminSession` / `requireAdminPermission`.

3. **Service-role privilege:** Server routes use `getSupabaseAdminFromRequest` (bypass RLS). Client routes depend on RLS — FastAPI should assume privileged DB access behind admin auth.

4. **Side effects to preserve:** SMS on create, activity logs, push on reject/doc delivery/payout, Chapa activation/booking/payout, wallet retag on convert, delete cleanup order for FK cycles, commission credit/clawback, admin-booker float.

5. **No dedicated dispute / wallet-adjust APIs** — encode booking reject + note + payout reject as dispute workflow; encode wallet mutations as explicit finance endpoints if product needs them.

6. **Orphan / unused-by-UI data paths (still migrate):** `approveServiceById`, `updatePayment`, `completePayoutRequest` thunk (UI uses Chapa verify), `fetchBookingPayoutStatus`, `processBookingPayout` (superseded by booking completion payout), legacy `add_customer` edge, `POST /api/settings/languages`.

7. **Ops scripts** under `scripts/` (wallet repairs, Fayda SMS, storage orphan cleanup, Chapa activation fixes) are **not** admin UI contracts but share the same tables — inventory separately for backend cutover.

8. **Suggested FastAPI surface grouping:** `/v1/admin/auth|me`, `/v1/admin/roles`, `/v1/admin/admins`, `/v1/admin/providers`, `/v1/admin/customers`, `/v1/admin/services`, `/v1/admin/catalog`, `/v1/admin/bookings`, `/v1/admin/finance`, `/v1/admin/documents`, `/v1/admin/blog`, `/v1/admin/banners`, `/v1/admin/marketing-tracker`, `/v1/admin/settings`, `/v1/admin/mobile-app-config`, `/v1/admin/activity-logs`, `/v1/admin/push`, `/v1/admin/notifications`.

---

*End of ADMIN_API_CONTRACT.md*
