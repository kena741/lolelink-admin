# Zemen Service provider app — Internal document delivery

Mobile implementation guide for admin-shared PDFs (agreements, policies, etc.).

**Admin portal:** upload once in **Internal documents** (`/admin/internal-documents`), then send to a provider from their profile → **Documents** tab → **Shared documents**.

---

## Flow

1. Admin uploads a PDF to the internal library.
2. Admin sends that document to a specific provider.
3. Provider receives an FCM push.
4. Provider opens the document in the app, views the PDF, and acknowledges.
5. Admin sees **Pending** → **Acknowledged** on the provider profile.

Each send creates a new `document_deliveries` row (re-sending the same PDF is a new delivery).

---

## Database

### `admin_documents`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `title` | text | Display name |
| `category` | text | `agreement` \| `policy` \| `other` |
| `storage_path` | text | Path in `admin-documents` bucket |
| `file_name` | text | Original filename |
| `mime_type` | text | `application/pdf` |
| `created_at` | timestamptz | |

### `document_deliveries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK — use as `delivery_id` in push/deep link |
| `document_id` | uuid | FK → `admin_documents` |
| `recipient_type` | text | Always `provider` |
| `recipient_id` | uuid | `provider.id` |
| `sent_by` | uuid | Admin auth user id |
| `sent_at` | timestamptz | |
| `acknowledged_at` | timestamptz | `null` until provider acknowledges |

### Provider access (RLS)

- `SELECT` own rows in `document_deliveries` where `recipient_id` matches the signed-in provider profile (`provider.user_id = auth.uid()` or `provider.id = auth.uid()`)
- `UPDATE` own delivery to set `acknowledged_at`
- `SELECT` `admin_documents` only when a delivery exists for that provider
- `SELECT` on `storage.objects` in bucket `admin-documents` only for delivered docs

Migration: `supabase/migrations/20260901120000_admin_internal_documents.sql`

---

## RPCs

All RPCs require an authenticated provider session.

### `list_my_document_deliveries()`

Returns all deliveries for the signed-in provider, newest first.

```sql
select * from list_my_document_deliveries();
```

| Column | Type |
|--------|------|
| `id` | uuid |
| `document_id` | uuid |
| `title` | text |
| `category` | text |
| `file_name` | text |
| `sent_at` | timestamptz |
| `acknowledged_at` | timestamptz |

```dart
final response = await supabase.rpc('list_my_document_deliveries');
```

### `get_my_document_delivery_path(p_delivery_id uuid)`

Returns the storage path for a delivery that belongs to the current provider.

```dart
final storagePath = await supabase.rpc(
  'get_my_document_delivery_path',
  params: {'p_delivery_id': deliveryId},
);
```

Throws / errors if delivery not found or not owned by the provider.

### `acknowledge_document_delivery(p_delivery_id uuid)`

Sets `acknowledged_at` to `now()` if not already set. Safe to call multiple times.

```dart
final delivery = await supabase.rpc(
  'acknowledge_document_delivery',
  params: {'p_delivery_id': deliveryId},
);
```

Returns the updated `document_deliveries` row.

---

## Storage

- **Bucket:** `admin-documents`
- **Private** (not public)
- **PDF only**, max 10 MB
- Paths look like: `library/{uuid}.pdf`

After `get_my_document_delivery_path` returns a path:

```dart
final signedUrl = await supabase.storage
  .from('admin-documents')
  .createSignedUrl(storagePath, 3600);
```

Use the signed URL in a WebView or native PDF viewer. Re-create the signed URL if it expires.

---

## Push notification

When admin sends a document, FCM **data** payload:

```json
{
  "type": "document",
  "route": "/document-delivery",
  "delivery_id": "<uuid>",
  "document_id": "<uuid>"
}
```

**Notification display (examples):**

- **title:** `New document to review`
- **body:** `Dear {firstName}, please review and acknowledge "{documentTitle}" in the Zemen Service provider app.`
- Or a custom message if admin provided one when sending.

A row is also inserted into the `notification` table with `type: document` and `action_url: /document-delivery?deliveryId=...`.

### Push handler

```dart
if (data['type'] == 'document' && data['route'] == '/document-delivery') {
  navigateToDocumentDelivery(
    deliveryId: data['delivery_id'],
    documentId: data['document_id'],
  );
}
```

If the user is not signed in, complete login first, then navigate with the stored `delivery_id`.

---

## Screens to build

### 1. Document delivery detail (`/document-delivery`)

**Input:** `delivery_id` from push or deep link.

**Load:**

```dart
final deliveries = await supabase.rpc('list_my_document_deliveries');
final delivery = deliveries.firstWhere((row) => row['id'] == deliveryId);
```

**Show:**

- Title, category, filename
- Sent date
- Status: pending vs acknowledged (`acknowledged_at`)

**Actions:**

- **View PDF** — `get_my_document_delivery_path` → `createSignedUrl` → open viewer
- **Acknowledge** — `acknowledge_document_delivery(delivery_id)`

Suggested UX: enable acknowledge after the PDF has been opened at least once (client-side only).

### 2. Documents inbox (recommended)

List from `list_my_document_deliveries()`:

- Badge or highlight for rows where `acknowledged_at` is null
- Tap row → delivery detail screen

Can also be linked from profile/settings (“Documents from Zemen”).

---

## Category labels

| `category` value | Display |
|------------------|---------|
| `agreement` | Agreement |
| `policy` | Policy |
| `other` | Other |

---

## Edge cases

| Case | Behavior |
|------|----------|
| Re-acknowledge | RPC is idempotent; existing `acknowledged_at` is kept |
| Expired signed URL | Call `get_my_document_delivery_path` again and create a new signed URL |
| Invalid `delivery_id` | RPC errors; show “Document not found” |
| Another provider’s delivery | RLS blocks access — treat as not found |
| Push missing `delivery_id` | Fall back to documents inbox list |
| Provider has no FCM token | Delivery row still created; provider sees doc in inbox when they open the app |

---

## Test checklist

- [ ] Run migration `20260901120000_admin_internal_documents.sql` on Supabase
- [ ] Admin uploads PDF at `/admin/internal-documents`
- [ ] Admin sends doc from provider profile → Documents → Shared documents
- [ ] Provider receives push on device
- [ ] Tap push opens correct delivery screen
- [ ] PDF loads from private bucket via signed URL
- [ ] Acknowledge updates `acknowledged_at`
- [ ] Admin portal shows **Acknowledged** on provider delivery history
- [ ] Provider cannot open another provider’s `delivery_id` or storage path
- [ ] Inbox lists all deliveries, newest first
- [ ] Re-open acknowledged doc still works (read-only, already acknowledged)

---

## Admin API (portal only)

Mobile app does **not** call these.

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/admin/internal-documents` | Library list + upload |
| `GET /api/admin/internal-documents/[id]` | Single doc + signed preview |
| `GET/POST /api/admin/providers/[id]/document-deliveries` | Delivery history + send + push |

---

## Questions

Contact the admin portal team if RPCs or storage access fail for a valid delivery.
