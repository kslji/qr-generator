# QR & Barcode Document Backend (MongoDB & Decoupled JWT Edition)

This is a Node.js Express backend service that allows users to register physical documents or external links (e.g. Google Drive URLs) and generate trackable QR codes and CODE128 barcodes.

## Features & Flow

- **Two Input Types**:
  - **Physical Files**: Upload a document file (PDF, image, webp, text) which is stored directly as binary data (`file_data`) in MongoDB.
  - **Redirect Links**: Provide an external URL (such as a Google Drive PDF link).
- **Unique Document IDs**: Every document gets an 8-character random ID (e.g. `K7RTQ2XM`).
- **Decoupled JWT Auth Verification**: Protected CRUD routes require a valid JWT token issued by your external Auth microservice, sent via the `Authorization: Bearer <token>` header. Documents and limits are scoped to the user ID decoded from the token.
- **Image Generation & Download**: Serves QR Codes and barcodes as PNG image responses. Supports `?download=true` query parameters to prompt browsers to save files locally.
- **Scan Tracking & Redirection**: Scanning the QR code calls a public tracking route `/scan/:id`, which increments the scan count in MongoDB, then redirects (302) the anonymous user to the target external link or physical file.
- **Per-User Limits**: Users can store a maximum of **5 active documents** at any time.

---

## Setup & Running

1. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in `MONGO_URL` and `JWT_SECRET` variables:
   ```env
   PORT=3000
   BASE_URL=http://localhost:3000
   MONGO_URL='your-mongodb-connection-string'
   MONGO_DB_NAME='qr_barcode'
   JWT_SECRET='your-shared-jwt-secret-from-auth-microservice'
   JWT_EXPIRES_IN='7d'
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Verify Indexes**:
   Runs MongoDB index configurations (`user_id`, `created_at`, `expires_at`):
   ```bash
   npm run migrate
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

## API Reference

All protected CRUD endpoints require the header `Authorization: Bearer <token>`. Errors return standard JSON format:
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Access denied. No token provided." } }
```

### `POST /api/documents` [Protected]
Create a document entry. Accepts either `multipart/form-data` or `application/json`.

| Field | Type | Description |
|---|---|---|
| `file` | File (binary) | (File mode) The physical document |
| `logo` | File (binary) | (Optional logo) An image file (PNG, JPEG, WebP) to embed in the center of the QR code |
| `url` | String (URL) | (Link mode) The external destination redirect link (e.g. Google Drive) |
| `expiresInDays` | Integer | (Optional) Days until document expires (Default: 30, Max: 30) |
| `qrColorDark` | String | (Optional) Hex code for QR code foreground pixels (Default: `#000000`) |
| `qrColorLight` | String | (Optional) Hex code for QR code background pixels (Default: `#FFFFFF`) |

```bash
# Uploading a link via JSON with custom red/white QR code colors
curl -X POST http://localhost:3000/api/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.google.com/document/d/A-DOC/edit", "qrColorDark": "#FF0000", "qrColorLight": "#FFFFFF"}'
```

Response `201`:
```json
{
  "document": {
    "id": "K7RTQ2XM",
    "originalName": null,
    "mimeType": null,
    "sizeBytes": null,
    "scanCount": 0,
    "lastScannedAt": null,
    "expiresAt": "2026-08-11T10:22:00.000Z",
    "createdAt": "2026-07-12T10:22:00.000Z",
    "redirectUrl": "https://docs.google.com/document/d/A-DOC/edit",
    "qrColorDark": "#FF0000",
    "qrColorLight": "#FFFFFF",
    "hasQrLogo": false,
    "scanUrl": "http://localhost:3000/scan/K7RTQ2XM",
    "downloadUrl": "http://localhost:3000/api/documents/K7RTQ2XM/file",
    "qrCodeUrl": "http://localhost:3000/api/documents/K7RTQ2XM/qrcode",
    "barcodeUrl": "http://localhost:3000/api/documents/K7RTQ2XM/barcode"
  }
}
```

### `GET /api/documents` [Protected]
Lists documents created by the authenticated user.
*   **Query Parameters**: `limit` (default: 50), `offset` (default: 0).

### `GET /api/documents/:id` [Protected]
Fetches metadata of the user's document.

### `DELETE /api/documents/:id` [Protected]
Deletes the document. Frees up a storage slot for the user.

### `GET /api/documents/:id/qrcode` [Public]
Returns the QR code PNG image.
*   **Query Parameters**: `size` (optional pixel size), `download=true` (forces direct file download).

### `GET /api/documents/:id/barcode` [Public]
Returns the CODE128 barcode PNG image.
*   **Query Parameters**: `download=true` (forces direct file download).

### `GET /api/documents/:id/file` [Public]
Streams the uploaded file, or redirects (302) to the external redirect link.

### `GET /scan/:id` [Public]
The analytics tracking URL. Increments `scan_count`, updates `last_scanned_at`, and redirects the scanner (302) to the resource.

### `GET /health` [Public]
Status probe for system and MongoDB connections.

---

## Operational notes

- **Limit of 5 Active Documents**: Scoped strictly per user ID. Once the limit is hit, attempts to upload return a `STORAGE_LIMIT_REACHED` error until a document is deleted.
- **24-Hour Creation Rate Limit**: Users are restricted to a maximum of 5 document or link creations within any rolling 24-hour window. Reaching this limit returns a `429 Too Many Requests` status code with a `DAILY_LIMIT_EXCEEDED` error code.
- **BulkWrite Expiry Cleanup**: Run `npm run cleanup:expired` (as a cron or scheduled job) to physically delete expired documents or documents older than 30 days using a fast MongoDB `bulkWrite` operation.
- **Rate limiting**: Upload requests and overall traffic are rate-limited via `UPLOAD_RATE_LIMIT_PER_15MIN` and `GENERAL_RATE_LIMIT_PER_15MIN`.

---

## Future Enhancements
- **Subscription-based Expiration Limits**: Add billing/subscription features (e.g., 6-month or 12-month payments). For paid subscribers, the standard expiration constraints will be automatically lifted, allowing longer-term or indefinite active QR codes and files.

