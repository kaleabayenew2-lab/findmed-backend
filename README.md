# FindMed Backend

This repository contains the Express‑based API server that powers the FindMed
mobile/web applications.  It exposes a RESTful interface for facilities,
users, chat, notifications, content, administrative operations and more.  The
server also manages authentication, session tokens, and integrates with
Telegram when required.

---

## Getting started

1. Copy `.env.example` (if available) to `.env` and fill in values. Required
   variables include:
   - `MONGODB_URIS` &ndash; comma‑separated list of MongoDB URIs (see below).
   - `MONGODB_DB_LABELS` &ndash; optional comma‑separated labels for each URI (e.g. `admin,users,chat`). Logged on startup to identify which connection is which.
   - `JWT_SECRET` &ndash; secret key for signing JWTs.
   - `PORT`, `HOST`, `FRONTEND_ORIGIN`, etc.
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Run the server:
   ```bash
   npm start
   ```

### MongoDB configuration

The backend supports connecting to **multiple MongoDB databases**. Specify
`MONGODB_URIS` in `.env` with one or more connection strings separated by
commas; the first entry is used by default.  Legacy single‑URI variables
(`MONGODB_URI`/`MONGO_URI`) are also recognised when `MONGODB_URIS` is absent.

Connections are created automatically at startup.  The classification logic that
decides which database to use lives in `src/config/db.js` and can be
customised (see `docs/backend/db.md`).

---

## Functionality overview

### Authentication & Users

- Register (`POST /api/users/register`)
- Login (`POST /api/users/login`)
- Logout (`POST /api/users/auth/logout`)
- Password reset (OTP, admin reset)
- Email/Telegram identity checks and login via Telegram codes
- Profile management (`GET|POST /api/users/:id`)
- Save/unsave facilities for users
- Device token management for push notifications
- Admin endpoints to list, update, delete users and reset passwords

### Facilities

- List facilities (`GET /api/facilities`)
- Search/catalog and name availability check
- Facility creation, login, update (admin/agents)
- Reset facility password
- Record views and ratings
- Endpoints are defined in `src/routes/facilities.js` with logic in
  `src/controllers/facilitiesController.js`.

### Chat System

- Send and receive messages: `POST/GET /api/chat/messages`
- Retrieve conversations, statistics, mark messages read
- Moderation: delete/edit messages, flag/clear conversations, block users
- Typing/presence notifications
- Conversation status tracking (`/statuses` and `/conversation/:id/status`)

### Notifications

- Query notifications by email, feedback ID, or IP
- Server‑sent events stream for admin clients
- Mark notifications as read
- Cleanup endpoint to remove stale notifications

### Content & Ads

- Public content list (`GET /api/content`)
- Admin content management via `/api/admin/*`
- On‑demand and scheduled ad generation (executed on startup and interval)

### Administrative Operations

The `/api/admin` namespace supports:

- Fetching statistics, consolidated data and application settings
- Managing emergencies and content
- Running ad generation
- Obtaining reports (most viewed, top rated, etc.)

### Telegram Integration

- Lookup and upsert Telegram contacts used in bot interactions
- Connect user accounts to Telegram chat IDs
- Support for Telegram‑based login and OTP delivery

### Other utilities

- Health check (`GET /health`)
- CSRF token endpoint (`/api/csrf-token`)
- Static file serving for upload directory
- Socket.io support (if installed) for realtime features

---

## Folder structure

```
backend/
  src/
    config/       database and other configuration helpers
    controllers/  request handling logic for each route group
    models/       Mongoose schema definitions (multi-db aware)
    routes/       Express routers
    utils/        miscellaneous utility modules (socket management, etc.)
    scripts/      seed data and ancillary scripts
  logs/           runtime logs
  uploads/        served file uploads
```

## Security notes

- Always secure MongoDB access with proper network rules and credentials.
- Keep `JWT_SECRET` strong and confidential.
- Ensure CORS settings (`FRONTEND_ORIGIN`) match your deployed frontend.
- Input validation is performed using `express-validator`; malformed or
  unexpected data is rejected early.
- API endpoints are protected from abuse via `helmet` and
  `express-rate-limit` middleware.  Adjust the rate‑limit configuration in
  `src/index.js` as needed for your deployment.
- **Field encryption** is enabled for sensitive user/facility data.  Set
  `ENCRYPTION_KEY` in `.env` to a 32-byte secret used for AES-256-GCM;
  changing it will prevent decryption of existing data.
- Run the server behind HTTPS (see `HTTPS_KEY_PATH`/`HTTPS_CERT_PATH` support)
  or deploy behind a TLS-terminating proxy.

## Development tips

- Use `npm run lint` / `npm test` if available.
- Examine `docs/` for architecture decisions and data models.
- Seed sample data with `node src/scripts/seed.js`.

---

This README covers the main responsibilities of the backend; refer to
`docs/backend` for deeper documentation and implementation details.

