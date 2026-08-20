# GMS Expense & Khata App — Local Data Architecture & PHP Backend Integration Guide

> **Document Version:** 2.0.0  
> **Target Audience:** Frontend Engineers, PHP Backend/CRM Developers, Database Architects  
> **Mobile Tech Stack:** React Native / Expo SDK 54 / SQLite (`expo-sqlite`)  
> **Backend Tech Stack:** PHP 8.x / MySQL 8.x / RESTful JSON & Multipart APIs  
> **Base Production Domain:** `https://gmsexpense.tplpro.in`  
> **API Root Route:** `https://gmsexpense.tplpro.in/api/v1/`  
> **Source Inspection Completed:** All mobile schemas, queries, sync flows, and PHP API configurations are mapped directly from active source code in `src/`.

---

## Table of Contents
1. [Executive Architecture Overview](#1-executive-architecture-overview)
2. [SQLite Database Documentation](#2-sqlite-database-documentation)
   - [Database Engine & Configuration](#database-engine--configuration)
   - [Table 1: `transactions`](#table-1-transactions)
   - [Table 2: `parties`](#table-2-parties)
   - [Table 3: `categories`](#table-3-categories)
   - [Table 4: `transaction_images`](#table-4-transaction_images)
   - [Table 5: `sync_queue`](#table-5-sync_queue)
   - [Table 6: `backup_activity_logs`](#table-6-backup_activity_logs)
   - [Table 7: `settings`](#table-7-settings)
   - [Database Indexes](#database-indexes)
3. [SQLite Entity Relationship Explanation](#3-sqlite-entity-relationship-explanation)
4. [Transaction Data Structure & Lifecycle](#4-transaction-data-structure--lifecycle)
5. [Balance Calculation Logic](#5-balance-calculation-logic)
6. [Image Storage & Handling](#6-image-storage--handling)
7. [PHP API Architecture](#7-php-api-architecture)
   - [PHP API Root & Versioning](#php-api-root--versioning)
   - [Current PHP APIs vs. Planned PHP APIs](#current-php-apis-vs-planned-php-apis)
   - [PHP Endpoints Specification Table](#php-endpoints-specification-table)
   - [Request & Response Formats](#request--response-formats)
   - [Authentication & Request Headers](#authentication--request-headers)
8. [Backup Architecture & PHP / MySQL Data Flow](#8-backup-architecture--php--mysql-data-flow)
   - [Text & SQLite Data Flow](#text--sqlite-data-flow)
   - [Receipt Image Media Flow](#receipt-image-media-flow)
9. [API-to-Database Mapping Table](#9-api-to-database-mapping-table)
10. [Server Confirmation Process & State Machine](#10-server-confirmation-process--state-machine)
11. [Server & API Health Testing](#11-server--api-health-testing)
12. [API Configuration Rules](#12-api-configuration-rules)
13. [Failure & Retry Behavior](#13-failure--retry-behavior)
14. [Recommended CRM Backend Architecture (PHP/MySQL)](#14-recommended-crm-backend-architecture-phpmysql)
15. [Suggested Future CRM Database Schema (MySQL 8.0+)](#15-suggested-future-crm-database-schema-mysql-80)
16. [Data Flow Diagrams](#16-data-flow-diagrams)
17. [Important Identifiers & Key Management](#17-important-identifiers--key-management)
18. [Data Lifecycle](#18-data-lifecycle)
19. [Actual Code References](#19-actual-code-references)
20. [Current Limitations](#20-current-limitations)
21. [Architecture Summary](#21-architecture-summary)

---

## 1. Executive Architecture Overview

The mobile application operates on an **offline-first** architectural model. All financial records, customer khata entries, custom categories, system preferences, and image references are stored locally on the client device using **`expo-sqlite`** in a single database file named **`expenses_khata.db`**.

- **Primary Storage:** SQLite relational database with WAL (Write-Ahead Logging) enabled.
- **State Management:** React Context API (`AppContext.js`) orchestrating synchronous SQLite transactions and background sync daemons.
- **Physical Media:** Bill photos and receipts are copied to the application's document storage (`FileSystem.documentDirectory + 'transaction_photos/'`).
- **PHP Cloud Backend:** The server layer is built with **PHP 8.x** backed by **MySQL 8.x** hosted on `https://gmsexpense.tplpro.in/api/v1/`.
- **Sync Model:** An event-driven local queue (`sync_queue`) records mutations, automatically syncing text records to PHP endpoints when connected, while receipt images are scheduled for nightly off-peak batch upload (default 2:00 AM).

---

## 2. SQLite Database Documentation

### Database Engine & Configuration
- **Database Name:** `expenses_khata.db`
- **Driver:** `expo-sqlite` (Synchronous API: `openDatabaseSync`, `execSync`, `runSync`, `getAllSync`, `getFirstSync`, `withTransactionSync`)
- **Journal Mode:** `PRAGMA journal_mode = WAL;` (Write-Ahead Logging enabled for concurrency and performance)
- **Initialization File:** `src/database/db.js`

---

### Table 1: `transactions`
- **Purpose:** Primary financial ledger storing every entry (You Gave / You Got).
- **Related To:** `parties` (via `party_id`), `categories` (via `category_id`), `transaction_images` (via `id` and `uuid`), `sync_queue` (via `uuid`).

| Column | SQLite Type | Nullable | Default | Primary Key | Unique | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `INTEGER` | No | Auto | **Yes** | Yes | Auto-incrementing local primary key. |
| `uuid` | `TEXT` | No | None | No | **Yes** | Universally Unique Identifier (v4 UUID). Immutable sync anchor. |
| `party_id` | `INTEGER` | Yes | `NULL` | No | No | Foreign key referencing `parties(id)`. Optional if generic expense. |
| `category_id` | `INTEGER` | Yes | `NULL` | No | No | Foreign key referencing `categories(id)`. |
| `type` | `TEXT` | No | None | No | No | Direction: `'gave'` (Debit / Outflow) or `'got'` (Credit / Inflow). |
| `payment_mode` | `TEXT` | No | None | No | No | Payment channel: `'cash'` or `'online'`. |
| `amount` | `REAL` | No | None | No | No | Monetary value in ₹ (positive decimal). |
| `note` | `TEXT` | Yes | `NULL` | No | No | Optional description or bill notes. |
| `transaction_date` | `TEXT` | No | None | No | No | ISO 8601 timestamp string of the transaction. |
| `created_at` | `TEXT` | No | None | No | No | ISO 8601 creation timestamp. |
| `updated_at` | `TEXT` | No | None | No | No | ISO 8601 update timestamp. |
| `sync_status` | `TEXT` | Yes | `'pending'` | No | No | `'pending'`, `'uploading'`, `'synced'`, `'failed'`. |
| `server_id` | `INTEGER` | Yes | `NULL` | No | No | Confirmed server-side MySQL ID assigned by PHP API. |
| `server_synced_at`| `TEXT` | Yes | `NULL` | No | No | Timestamp when PHP API confirmed successful MySQL save. |

**Constraints & Foreign Keys:**
```sql
CHECK(type IN ('gave', 'got'))
CHECK(payment_mode IN ('cash', 'online'))
FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
```

---

### Table 2: `parties`
- **Purpose:** Customers, suppliers, vendors, and contacts for the **Khata (Ledger)** book.
- **Related To:** `transactions` (1:N parent-to-child relationship).

| Column | SQLite Type | Nullable | Default | Primary Key | Unique | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `INTEGER` | No | Auto | **Yes** | Yes | Auto-incrementing local primary key. |
| `name` | `TEXT` | No | None | No | No | Contact or business name. |
| `phone` | `TEXT` | Yes | `NULL` | No | No | Optional contact phone number. |
| `created_at` | `TEXT` | No | None | No | No | ISO 8601 timestamp of registration. |
| `updated_at` | `TEXT` | No | None | No | No | ISO 8601 timestamp of last profile update. |

---

### Table 3: `categories`
- **Purpose:** Classification categories (e.g. Food, Salary, Rent, Travel, Shopping).
- **Related To:** `transactions` (1:N relationship).

| Column | SQLite Type | Nullable | Default | Primary Key | Unique | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `INTEGER` | No | Auto | **Yes** | Yes | Primary key. 1–11 are default system categories. |
| `name` | `TEXT` | No | None | No | **Yes** | Category name (unique). |
| `icon` | `TEXT` | Yes | `'grid-outline'` | No | No | Ionicons icon glyph name. |
| `color` | `TEXT` | Yes | `'#64748B'` | No | No | Hex color badge string. |
| `is_custom` | `INTEGER` | Yes | `0` | No | No | `0` = system default, `1` = user custom category. |
| `is_deleted` | `INTEGER` | Yes | `0` | No | No | Soft deletion flag: `0` = active, `1` = soft-deleted. |
| `created_at` | `TEXT` | No | None | No | No | ISO 8601 creation timestamp. |

---

### Table 4: `transaction_images`
- **Purpose:** Receipt photos and invoice images attached to transactions.
- **Related To:** `transactions` (N:1 child-to-parent relationship).

| Column | SQLite Type | Nullable | Default | Primary Key | Unique | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `INTEGER` | No | Auto | **Yes** | Yes | Auto-incrementing primary key. |
| `transaction_id` | `INTEGER` | Yes | `NULL` | No | No | Foreign key referencing `transactions(id)`. |
| `transaction_uuid` | `TEXT` | No | None | No | No | UUID of the parent transaction (used by PHP API for association). |
| `local_uri` | `TEXT` | No | None | No | No | Absolute local filesystem path on the device. |
| `file_name` | `TEXT` | Yes | `NULL` | No | No | Normalized filename (e.g. `img_1724174000_abc123.jpg`). |
| `upload_status` | `TEXT` | Yes | `'pending'` | No | No | `'pending'`, `'uploading'`, `'uploaded'`, `'failed'`. |
| `server_id` | `INTEGER` | Yes | `NULL` | No | No | Confirmed server MySQL record ID. |
| `server_synced_at`| `TEXT` | Yes | `NULL` | No | No | Timestamp of server confirmation. |
| `created_at` | `TEXT` | No | None | No | No | ISO 8601 attachment timestamp. |

---

### Table 5: `sync_queue`
- **Purpose:** Audit log and sync mutation queue tracking every local change for PHP sync.

| Column | SQLite Type | Nullable | Default | Primary Key | Unique | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `INTEGER` | No | Auto | **Yes** | Yes | Auto-incrementing queue item ID. |
| `entity_type` | `TEXT` | No | None | No | No | `'transaction'`, `'party'`, `'category'`. |
| `entity_uuid` | `TEXT` | No | None | No | No | Unique UUID of the affected entity. |
| `action` | `TEXT` | No | None | No | No | `'create'`, `'update'`, `'delete'`. |
| `payload` | `TEXT` | Yes | `NULL` | No | No | JSON snapshot of entity data at mutation time. |
| `created_at` | `TEXT` | No | None | No | No | Timestamp when mutation occurred. |
| `status` | `TEXT` | Yes | `'pending'` | No | No | `'pending'` or `'synced'`. |

---

### Table 6: `backup_activity_logs`
- **Purpose:** Chronological audit log of all sync events, health checks, and server responses displayed on the Backup Dashboard.

| Column | SQLite Type | Nullable | Default | Primary Key | Unique | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `INTEGER` | No | Auto | **Yes** | Yes | Auto-incrementing log ID. |
| `timestamp` | `TEXT` | No | None | No | No | ISO 8601 timestamp of the event. |
| `action_type` | `TEXT` | No | None | No | No | `'text_sync'`, `'image_upload'`, `'health_check'`, `'error'`. |
| `status` | `TEXT` | No | None | No | No | `'success'`, `'failed'`, `'pending'`, `'info'`. |
| `message` | `TEXT` | No | None | No | No | Human-readable event description (e.g., *"25 transactions synchronized ✓"*). |
| `details` | `TEXT` | Yes | `NULL` | No | No | Optional debug or error details. |

---

### Table 7: `settings`
- **Purpose:** Key-value configuration store for app preferences and sync timestamps.

| Key | Default Value | Description |
| :--- | :--- | :--- |
| `currency` | `'₹'` | Active currency symbol. |
| `app_version` | `'1.0.0'` | Application build version. |
| `last_sync` | `''` | Timestamp of last successful text data sync. |
| `last_failed_sync`| `''` | Timestamp of last failed sync attempt. |
| `last_image_sync` | `''` | Timestamp of last successful image upload. |
| `image_backup_time`| `'02:00'` | Daily scheduled time for image upload (24h format). |
| `image_backup_enabled`| `'1'` | Flag (`'1'` or `'0'`) for auto image upload schedule. |
| `auto_sync_enabled` | `'1'` | Flag (`'1'` or `'0'`) for background automatic text sync. |

---

### Database Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_tx_uuid ON transactions(uuid);
CREATE INDEX IF NOT EXISTS idx_tx_party ON transactions(party_id);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_mode ON transactions(payment_mode);
CREATE INDEX IF NOT EXISTS idx_tx_images_tx ON transaction_images(transaction_uuid);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_backup_logs ON backup_activity_logs(timestamp);
```

---

## 3. SQLite Entity Relationship Explanation

```text
 ┌──────────────┐                 ┌────────────────┐
 │   parties    │ 1             N │   categories   │
 └──────┬───────┘                 └───────┬────────┘
        │                                 │
        │ (1:N)                           │ (1:N)
        │ ON DELETE SET NULL              │ ON DELETE SET NULL
        ▼                                 ▼
 ┌─────────────────────────────────────────────────┐
 │                  transactions                   │
 └──────────────┬─────────────────────────┬────────┘
                │                         │
                │ (1:N)                   │ (1:N via entity_uuid)
                │ ON DELETE CASCADE       │
                ▼                         ▼
 ┌──────────────────────────────┐  ┌───────────────┐
 │      transaction_images      │  │  sync_queue   │
 └──────────────┬───────────────┘  └───────────────┘
                │
                ▼ (Local Path)
 ┌──────────────────────────────┐
 │    Local Device Filesystem   │
 │   (transaction_photos/*.jpg) │
 └──────────────────────────────┘
```

---

## 4. Transaction Data Structure & Lifecycle

### Concrete Example from Mobile Database

```json
{
  "id": 42,
  "uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "partyId": 3,
  "partyName": "Sharma Traders",
  "categoryId": 9,
  "categoryName": "Business",
  "type": "gave",
  "paymentMode": "cash",
  "amount": 4500.00,
  "note": "Raw material batch #104",
  "transactionDate": "2026-08-20T14:30:00.000Z",
  "createdAt": "2026-08-20T14:32:10.500Z",
  "updatedAt": "2026-08-20T14:32:10.500Z",
  "syncStatus": "synced",
  "serverId": 10842,
  "serverSyncedAt": "2026-08-20T14:35:00.000Z",
  "imageCount": 1,
  "runningBalance": 12500.00,
  "images": [
    {
      "id": 14,
      "transactionUuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "localUri": "file:///data/user/0/com.gms.expense/files/transaction_photos/img_1724174000_a1b2c3.jpg",
      "fileName": "receipt_104.jpg",
      "uploadStatus": "uploaded",
      "serverId": 5012
    }
  ]
}
```

---

## 5. Balance Calculation Logic

> **IMPORTANT ARCHITECTURAL RULE:**  
> Balances are **never** stored as static, hardcoded numbers in SQLite tables. All balances are computed **dynamically in real time** using SQL aggregate and window functions.

### Overall Balances:
$$\text{Cash Balance} = \text{Cash Got} - \text{Cash Gave}$$
$$\text{Online Balance} = \text{Online Got} - \text{Online Gave}$$
$$\text{Total Balance} = \text{Cash Balance} + \text{Online Balance} = \text{Total Got} - \text{Total Gave}$$

### Khata (Customer) Net Balance:
$$\text{Customer Net Balance} = \text{Total Gave to Party} - \text{Total Got from Party}$$
- **$\text{Net Balance} > 0$:** **"You Will Get"** (Customer owes business) &rarr; **Green** (`#059669`).
- **$\text{Net Balance} < 0$:** **"You Will Give"** (Business owes customer) &rarr; **Red** (`#DC2626`).
- **$\text{Net Balance} = 0$:** **"All Settled"** &rarr; **Neutral Slate** (`#64748B`).

### Running Balance (Window Function):
```sql
SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE -t.amount END)
  OVER (
    ORDER BY datetime(t.transaction_date) ASC, 
             datetime(t.created_at) ASC, 
             t.id ASC
  ) AS runningBalance
```

---

## 6. Image Storage & Handling

- **Physical Path:** `FileSystem.documentDirectory + 'transaction_photos/'`
- **Naming Format:** `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`
- **SQLite Storage:** Stores only the absolute file URI string in `transaction_images.local_uri` and filename in `transaction_images.file_name`.
- **Safe Cleanup:** Transaction deletion triggers `FileSystem.deleteAsync` to free device storage.

---

## 7. PHP API Architecture

The backend API is implemented in **PHP 8.x** running on an Apache/Nginx web server with MySQL 8.x.

- **Base Production Domain:** `https://gmsexpense.tplpro.in`
- **PHP API Directory Route:** `/api/v1/`
- **Full Base URL:** `https://gmsexpense.tplpro.in/api/v1/`
- **Configuration File:** [`src/constants/api_config.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/constants/api_config.js) / [`src/config/api_config.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/config/api_config.js)

---

### Current PHP APIs vs. Planned PHP APIs

| Status | Category | Endpoint File | Description |
| :--- | :--- | :--- | :--- |
| **CURRENT** | Health & Monitor | `health.php` | Tests server reachability, PHP version & MySQL connection. |
| **CURRENT** | Sync | `transactions_sync.php` | Upserts transaction batches from mobile SQLite into MySQL. |
| **CURRENT** | Sync | `batch_sync.php` | Multi-entity sync (transactions, parties, categories). |
| **CURRENT** | Media Storage | `image_upload.php` | Single receipt image upload via multipart/form-data. |
| **CURRENT** | Media Storage | `image_upload_batch.php` | Batch multipart upload of multiple receipt photos. |
| **CURRENT** | Backup Status | `backup_status.php` | Returns server backup statistics and device sync timestamps. |
| **CURRENT** | Auth | `login.php` | User login with mobile number and password. |
| **CURRENT** | Auth | `register.php` | User registration for new mobile accounts. |
| **CURRENT** | Auth | `logout.php` | User logout and session clearing. |
| *PLANNED* | Restore | `restore.php` | Full cloud backup restore to recreate local SQLite ledger. |
| *PLANNED* | Archive | `download_backup.php` | Generates downloadable SQL/JSON server backup archive. |
| *PLANNED* | Auth | `verify_token.php` | Token validation. |
| *PLANNED* | Khata Master | `parties_sync.php` | Standalone customer & vendor list synchronization. |
| *PLANNED* | Category Master | `categories_sync.php` | Standalone custom categories sync. |

---

### PHP Endpoints Specification Table

| API Name | PHP Endpoint File | HTTP Method | Request Content-Type | Payload Format | Response Format | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Server Health** | `health.php` | `GET` | `None` | Query params: `?device_uuid=...` | JSON | **CURRENT** |
| **User Login** | `login.php` | `POST` | `application/json` | `{ phone, password }` | JSON | **CURRENT** |
| **User Register** | `register.php` | `POST` | `application/json` | `{ name, phone, password, email }` | JSON | **CURRENT** |
| **User Logout** | `logout.php` | `POST` | `application/json` | `None` | JSON | **CURRENT** |
| **Transaction Sync** | `transactions_sync.php` | `POST` | `application/json` | JSON Batch array of transaction objects | JSON | **CURRENT** |
| **Batch Sync** | `batch_sync.php` | `POST` | `application/json` | JSON Multi-entity batch payload | JSON | **CURRENT** |
| **Image Upload** | `image_upload.php` | `POST` | `multipart/form-data` | `file`, `transaction_uuid`, `file_name` | JSON | **CURRENT** |
| **Image Batch Upload** | `image_upload_batch.php` | `POST` | `multipart/form-data` | Array of image files + UUID metadata | JSON | **CURRENT** |
| **Backup Status** | `backup_status.php` | `GET` | `None` | Query params: `?device_uuid=...` | JSON | **CURRENT** |
| **Cloud Restore** | `restore.php` | `POST` | `application/json` | `{ user_id, device_uuid }` | JSON | *PLANNED* |
| **Download Backup** | `download_backup.php` | `GET` | `None` | Query params: `?token=...` | JSON/Zip | *PLANNED* |

---

### Request & Response Formats

#### 1. `health.php` (Server Health Test)
- **Method:** `GET`
- **Response (200 OK):**
```json
{
  "success": true,
  "status": "healthy",
  "php_version": "8.2.14",
  "mysql_connected": true,
  "server_time": "2026-08-20T23:30:00Z",
  "message": "PHP API and MySQL database are working properly."
}
```

#### 2. `transactions_sync.php` (Transaction Data Upload)
- **Method:** `POST`
- **Request Body (JSON):**
```json
{
  "device_uuid": "dev_987654321",
  "records": [
    {
      "uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "party_id": 3,
      "party_name": "Sharma Traders",
      "category_id": 9,
      "category_name": "Business",
      "type": "gave",
      "payment_mode": "cash",
      "amount": 4500.00,
      "note": "Raw material batch #104",
      "transaction_date": "2026-08-20T14:30:00.000Z",
      "created_at": "2026-08-20T14:32:10.500Z",
      "updated_at": "2026-08-20T14:32:10.500Z"
    }
  ]
}
```
- **Response (200 OK — Confirmed Storage):**
```json
{
  "success": true,
  "saved": true,
  "count": 1,
  "synced_records": [
    {
      "uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "server_id": 10842,
      "status": "saved"
    }
  ],
  "server_timestamp": "2026-08-20T14:35:00.000Z"
}
```
- **Response (Error / Validation Failure):**
```json
{
  "success": false,
  "saved": false,
  "message": "Database validation error: Invalid amount format.",
  "errors": ["records[0].amount must be a positive number"]
}
```

#### 3. `image_upload.php` (Receipt Photo Upload)
- **Method:** `POST` (`multipart/form-data`)
- **Parameters:**
  - `file`: Binary image file (JPEG/PNG)
  - `transaction_uuid`: `7c9e6679-7425-40de-944b-e07fc1f90ae7`
  - `file_name`: `receipt_104.jpg`
- **Response (200 OK):**
```json
{
  "success": true,
  "saved": true,
  "server_id": 5012,
  "transaction_uuid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "storage_url": "https://gmsexpense.tplpro.in/uploads/images/img_1724174000_a1b2c3.jpg",
  "file_size": 245120
}
```

---

### Authentication & Request Headers

```javascript
HEADERS: {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-App-Version': '1.0.0',
  'X-Platform': 'android' // or 'ios'
}
```

---

## 8. Backup Architecture & PHP / MySQL Data Flow

### Text & SQLite Data Flow
```text
React Native / Expo App
        │
        ▼
   SQLite (expenses_khata.db)
   Records saved locally with `sync_status = 'pending'`
        │
        ▼
   Backup / Sync Service (`syncService.js`)
   Checks network connectivity via `expo-network`
        │
        ▼
   Centralized `api_config`
   Retrieves `TRANSACTION_SYNC_URL` (`.../api/v1/transactions_sync.php`)
        │
        ▼ (HTTPS POST JSON)
   PHP API Endpoint (`transactions_sync.php`)
   Validates JSON payload & performs idempotent upsert
        │
        ▼
   MySQL Database (`transactions` table)
   Saves record and assigns auto-increment `id` (server_id)
        │
        ▼ (HTTPS Response JSON `{ success: true, saved: true, server_id: 10842 }`)
   React Native Client
   Updates SQLite: `sync_status = 'synced'`, `server_id = 10842`
```

### Receipt Image Media Flow
```text
React Native / Expo App
        │
        ▼
   Device Document Directory (`transaction_photos/*.jpg`)
        │
        ▼
   Image Upload Scheduler (`syncService.js` / Scheduled 2:00 AM)
        │
        ▼
   Centralized `api_config`
   Retrieves `IMAGE_UPLOAD_URL` (`.../api/v1/image_upload.php`)
        │
        ▼ (HTTPS POST multipart/form-data)
   PHP Image Upload API (`image_upload.php`)
   Saves binary file to server disk directory (`/uploads/images/`)
        │
        ▼
   MySQL Database (`transaction_images` table)
   Inserts storage URL & metadata; returns `server_id`
        │
        ▼ (HTTPS Response JSON `{ success: true, saved: true, server_id: 5012 }`)
   React Native Client
   Updates SQLite `transaction_images`: `upload_status = 'uploaded'`, `server_id = 5012`
```

---

## 9. API-to-Database Mapping Table

| PHP API File | Target MySQL Table | SQL Operation | Key Identifier | Local Mapping Column | Server ID Column | Status Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `transactions_sync.php` | `transactions` | `INSERT ... ON DUPLICATE KEY UPDATE` | `client_uuid` (CHAR 36) | `transactions.uuid` | `transactions.server_id` | `transactions.sync_status` |
| `image_upload.php` | `transaction_images` | `INSERT` | `transaction_uuid` + `file_name` | `transaction_images.local_uri` | `transaction_images.server_id` | `transaction_images.upload_status` |
| `parties_sync.php` | `parties` | `INSERT ... ON DUPLICATE KEY UPDATE` | `client_uuid` | `parties.id` | `parties.server_id` | `parties.sync_status` |
| `categories_sync.php` | `categories` | `INSERT ... ON DUPLICATE KEY UPDATE` | `name` | `categories.id` | `categories.server_id` | N/A |
| `backup_status.php` | `sync_logs` | `SELECT / INSERT` | `device_uuid` | `settings.last_sync` | N/A | N/A |

---

## 10. Server Confirmation Process & State Machine

> **CRITICAL DATA-SAFETY RULE:**  
> A transaction or image is **NEVER** marked as `UPLOADED` simply because an HTTP request was sent or internet connectivity was detected.  
> It is marked as `UPLOADED` **ONLY AFTER** the PHP API confirms that the record was validated and written to MySQL.

```text
 ┌────────────────────────────────────────────────────────┐
 │ 1. PENDING (Record created in local SQLite)            │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 2. UPLOADING (HTTP POST sent to PHP API)               │
 └───────────────────────────┬────────────────────────────┘
                             │
             ┌───────────────┴───────────────┐
             │                               │
    [PHP Returns 200 OK +            [PHP Returns Error /
     saved: true + server_id]         Timeout / Rejection]
             │                               │
             ▼                               ▼
 ┌───────────────────────────┐   ┌───────────────────────────┐
 │ 3. UPLOADED ✓             │   │ 4. FAILED / PENDING       │
 │ - SQLite sync_status='synced'│   │ - sync_status='failed'    │
 │ - server_id stored        │   │ - Stored for auto-retry   │
 │ - server_synced_at stored │   │ - Logged in activity list │
 └───────────────────────────┘   └───────────────────────────┘
```

---

## 11. Server & API Health Testing

The **Backup & Sync Dashboard** ([`src/screens/BackupScreen.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/screens/BackupScreen.js)) features a **Test Server Connection** tool that distinguishes 5 distinct health levels:

```text
Backup Screen ("Test Server Connection")
   │
   ├── Level 1: Internet Connection Check (expo-network)
   │     └─ Checks Wi-Fi / Cellular active & reachable
   │
   ├── Level 2: Base PHP Server Reachability (`health.php`)
   │     └─ Confirms Apache/Nginx web server is online
   │
   ├── Level 3: MySQL Database Connectivity (`health.php`)
   │     └─ Confirms PHP can query MySQL database
   │
   ├── Level 4: Transaction Sync API (`transactions_sync.php`)
   │     └─ Confirms transaction endpoint route responds
   │
   └── Level 5: Image Media API (`image_upload.php`)
         └─ Confirms image multipart upload route is ready
```

---

## 12. API Configuration Rules

1. **Zero Hardcoded URLs:** No screen, modal, component, or database query may hardcode server URLs.
2. **Single Source of Truth:** All URLs must be imported from `src/constants/api_config.js`.
3. **Domain Portability:** Changing the server domain or staging/production environment requires changing only `BASE_DOMAIN` in `api_config.js`.
4. **Feature Organization:** Endpoints are grouped cleanly by feature: Text Sync, Media Upload, Server Health, Restore, and Auth.
5. **Planned Endpoints Isolation:** Planned endpoints must be clearly commented and never called by active client code until deployed on the PHP backend.

---

## 13. Failure & Retry Behavior

| Scenario | Client Behavior | PHP Server Behavior |
| :--- | :--- | :--- |
| **Device Offline** | Skips sync attempt cleanly; records remain safely in SQLite `sync_status = 'pending'`. | No action. |
| **Server 500 / MySQL Down** | Marks records as `'failed'`; auto-retry daemon attempts sync again in next 25-second cycle. | Logs error in PHP error log. |
| **Duplicate Network Request** | Sends same `client_uuid`. | PHP runs `ON DUPLICATE KEY UPDATE` using `client_uuid`, preventing duplicate MySQL records. |
| **Image Upload Interrupted** | Image remains `upload_status = 'pending'` or `'failed'`; retried at next scheduled cycle (2:00 AM) or manual trigger. | Deletes partial temp file if upload incomplete. |

---

## 14. Recommended CRM Backend Architecture (PHP/MySQL)

When developing the future **PHP CRM & Web Admin Panel**:
1. **Canonical UUIDs:** Use `client_uuid` (CHAR(36)) as the primary unique synchronization anchor.
2. **Tenant Isolation:** Include `user_id` and `device_id` on all MySQL tables.
3. **Soft Deletions:** Implement `deleted_at TIMESTAMP NULL` across all MySQL tables.
4. **Dynamic Aggregation:** Compute running balances and party khata summaries using SQL views or window functions matching the mobile math formulas.

---

## 15. Suggested Future CRM Database Schema (MySQL 8.0+)

```sql
-- 1. Users & Devices
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  currency VARCHAR(10) DEFAULT '₹',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE devices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_uuid VARCHAR(100) UNIQUE NOT NULL,
  device_name VARCHAR(100),
  last_synced_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Parties / Khata Customers
CREATE TABLE parties (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  client_uuid CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_party_uuid (user_id, client_uuid),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Categories
CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(100) DEFAULT 'grid-outline',
  color VARCHAR(20) DEFAULT '#64748B',
  is_custom TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- 4. Transactions Ledger
CREATE TABLE transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  client_uuid CHAR(36) NOT NULL,
  party_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  type ENUM('gave', 'got') NOT NULL,
  payment_mode ENUM('cash', 'online') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT,
  transaction_date DATETIME NOT NULL,
  client_created_at DATETIME NOT NULL,
  client_updated_at DATETIME NOT NULL,
  server_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  server_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_tx_uuid (user_id, client_uuid),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 5. Transaction Images
CREATE TABLE transaction_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_uuid CHAR(36) NOT NULL,
  storage_url VARCHAR(1024) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes INT UNSIGNED NULL,
  mime_type VARCHAR(50) DEFAULT 'image/jpeg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Sync Log & Audit
CREATE TABLE sync_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_id BIGINT UNSIGNED NOT NULL,
  batch_count INT UNSIGNED NOT NULL,
  status ENUM('success', 'partial', 'failed') NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 16. Data Flow Diagrams

### Complete System Data Flow
```text
┌─────────────────────────────────────────────────────────────┐
│                       USER INTERFACE                        │
│ (HomeScreen / TransactionsScreen / Khata / Backup Dashboard)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    REACT CONTEXT LAYER                      │
│                  (src/context/AppContext.js)                │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      SQLITE DATABASE         │ │     IMAGE FILE SERVICE     │
│   (src/database/queries.js)  │ │(src/services/imageService) │
└──────────────┬───────────────┘ └─────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│     SQLite Tables in WAL     │ │   App Document Directory   │
│ (transactions, parties, etc) │ │ (transaction_photos/*.jpg) │
└──────────────┬───────────────┘ └─────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│           PHP API BACKEND (https://gmsexpense.tplpro.in)    │
│  - transactions_sync.php (JSON batch processing)            │
│  - image_upload.php (Multipart file saving)                 │
│  - health.php (Server status & latency monitor)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      MYSQL CRM DATABASE                     │
│    (tables: users, parties, transactions, images)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 17. Important Identifiers & Key Management

| Identifier | Scope | Type | Generated Where | Changable? | Role in PHP Backend |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **`transactions.uuid`** | **Global** | `UUID v4` string | `crypto.randomUUID()` | **NO** | **Primary Canonical Key** (`client_uuid`) for MySQL deduplication. |
| `transactions.id` | Local | `INTEGER` | SQLite Auto-increment | Yes | Local mobile row ID only. |
| `transactions.server_id` | **Global** | `INTEGER` | MySQL Auto-increment | No | Assigned by PHP API upon confirmation. |
| `transaction_images.transaction_uuid`| **Global** | `UUID v4` string | Inherited from transaction | **NO** | Links image files to MySQL transactions. |
| `settings.key` | Local | `TEXT` | Static keys | No | Key-value config identifier. |

---

## 18. Data Lifecycle

```text
 ┌────────────────┐
 │ 1. Create Form │ User inputs Amount, Type (Gave/Got), Mode (Cash/Online), Party, Note, Photos
 └───────┬────────┘
         ▼
 ┌────────────────┐
 │ 2. Persist Pic │ `imageService.persistImageLocally` copies photo to permanent documentDirectory
 └───────┬────────┘
         ▼
 ┌────────────────┐
 │ 3. SQLite TX   │ `db.withTransactionSync`: Inserts `transactions`, `transaction_images`, & `sync_queue`
 └───────┬────────┘
         ▼
 ┌────────────────┐
 │ 4. Auto Sync   │ `syncService.js` sends JSON to `transactions_sync.php` when online
 └───────┬────────┘
         ▼
 ┌────────────────┐
 │ 5. Server Save │ PHP writes to MySQL; returns `{ success: true, saved: true, server_id }`
 └───────┬────────┘
         ▼
 ┌────────────────┐
 │ 6. UPLOADED ✓  │ SQLite updates `sync_status = 'synced'` and stores `server_id`
 └────────────────┘
```

---

## 19. Actual Code References

### Mobile Application Codebase
- **Centralized PHP API Configuration:**  
  [`src/constants/api_config.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/constants/api_config.js) / [`src/config/api_config.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/config/api_config.js)
- **Dedicated Full-Screen Backup Dashboard:**  
  [`src/screens/BackupScreen.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/screens/BackupScreen.js)
- **Sync & Endpoint Health Service (Zero Simulation):**  
  [`src/services/syncService.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/services/syncService.js)
- **Database Initialization & Schemas:**  
  [`src/database/db.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/database/db.js)
- **Database Queries & Activity Logging:**  
  [`src/database/queries.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/database/queries.js)
- **Image Persistence & File Management:**  
  [`src/services/imageService.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/services/imageService.js)
- **State Management:**  
  [`src/context/AppContext.js`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/src/context/AppContext.js)

### PHP Backend Server Codebase (Zero-Simulation Production Ready)
- **Database Connection Helper:**  
  [`backend/api/v1/db_connect.php`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/backend/api/v1/db_connect.php)
- **Real Server & MySQL Health API:**  
  [`backend/api/v1/health.php`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/backend/api/v1/health.php)
- **Real Transaction Upsert Sync API:**  
  [`backend/api/v1/transactions_sync.php`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/backend/api/v1/transactions_sync.php)
- **Real Multipart Image Upload API:**  
  [`backend/api/v1/image_upload.php`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/backend/api/v1/image_upload.php)
- **Real Backup Status API:**  
  [`backend/api/v1/backup_status.php`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/backend/api/v1/backup_status.php)
- **MySQL 8.0+ Production Database Schema:**  
  [`backend/database/schema.sql`](file:///c:/MyData/MYPROJECT/myproject/gms_expense_app/backend/database/schema.sql)

---

## 20. Zero-Simulation Verification & Testing Architecture

### Principle of Zero Simulation
The application contains **ZERO** mock responses, hardcoded timeouts, or placeholder success fallbacks.

| Error Scenario | React Native Result | UI Status Display | SQLite Sync State |
| :--- | :--- | :--- | :--- |
| **Domain does not resolve (DNS error)** | `fetch()` throws `TypeError: Network request failed` | 🔴 **Server Offline / DNS Failed** | Stays `pending` |
| **PHP endpoint returns 404 (file missing)** | HTTP 404 response | 🔴 **✕ 404 Not Found** | Stays `pending` / `failed` |
| **PHP script throws 500 (MySQL down)** | HTTP 500 response | 🔴 **✕ 500 Server Error** | Marked `failed` |
| **PHP confirms MySQL commit with `server_id`** | HTTP 200 `{ success: true, saved: true, server_id }` | 🟢 **✓ Working (200 OK · 45ms)** | Marked `synced` + stores `server_id` |

---

## 21. Architecture Summary

1. **Where Data is Stored:**  
   Locally in SQLite database `expenses_khata.db` (WAL mode) and persistent disk photos; backed up remotely via PHP to MySQL.
2. **How Endpoints are Managed:**  
   Centralized in `src/constants/api_config.js` targeting `https://gmsexpense.tplpro.in/api/v1/`.
3. **How Text Data Syncs:**  
   Automatically uploaded via `transactions_sync.php` upon internet connection.
4. **How Images Sync:**  
   Scheduled nightly at 2:00 AM via `image_upload.php` multipart upload.
5. **How Confirmation Works:**  
   Records are marked `UPLOADED` only after PHP returns `{ success: true, saved: true, server_id }`.
6. **How Local Erase Works:**  
   Erase Device Data strictly removes local SQLite tables and cache; server data remains untouched.

