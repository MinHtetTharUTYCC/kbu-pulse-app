# AGENTS.md

## Project Overview

**KBU PULSE** is a university events platform for KBU (Kasem Bundit University). Users can browse, create, upvote, save, and comment on events.

- **Frontend:** Static HTML/CSS/JS — no build step, no framework, no package manager. Open the `.html` files directly or serve the folder statically.
- **Backend:** A separate NestJS API hosted on Render. The frontend communicates with it via `fetch`.

## Folder Structure

```
kbu-pulse-app/
├── *.html           # 8 pages (see Pages & Routing below)
├── js/
│   ├── main.js      # ALL app logic merged into ONE ES module (auth, apiClient, page handlers, rendering)
│   ├── navbar.js    # Classic script — renders the bottom navigation (exposes window.navbar)
│   └── util.js      # ES module helpers: capitalize, formatCategory
├── css/
│   ├── reset.css    # CSS reset
│   ├── variables.css# design tokens / CSS custom properties
│   ├── base.css     # base element & layout styles
│   ├── components.css
│   └── pages.css    # page-specific styles
├── html/
│   └── navbar.html  # static reference for the navbar markup
├── assets/
│   └── kbu.webp     # fallback/brand image
└── Example_users
```

### Script-loading patterns (important)

There are **two** script patterns in the HTML pages:

1. `js/navbar.js` — loaded as a **classic script** (`<script src="js/navbar.js"></script>`). Defines `window.navbar.renderNavbar()`.
2. `js/main.js` — loaded as an **ES module** (`<script type="module" src="js/main.js"></script>`). Imports helpers from `js/util.js`. This is where essentially all feature logic lives.

Because `main.js` is an ES module, helpers must be imported explicitly (barrel scope), and anything used by inline `onclick` handlers is exposed explicitly onto `window` (see the exports at the bottom of `main.js`).

## Pages & Routing

All pages are plain `.html` files at the repo root. `main.js` routes on page load by matching `window.location.pathname` via `path.includes(...)`, dispatching to the matching `init*Page()` handler.

| Page | Handler in `main.js` | Auth gating |
|------|----------------------|-------------|
| `index.html` (home) | `initHomePage()` | Public |
| `login.html` | `initLoginPage()` | Public |
| `register.html` | `initRegisterPage()` | Public |
| `profile.html` | `initProfilePage()` | Auth-aware (`#profile-guest`) |
| `saved.html` | `initSavedEventsPage()` | Auth-aware (`#saved-guest`) |
| `create-event.html` | `initCreateEventPage()` | Auth-aware (`#create-event-guest`) |
| `event-detail.html` | `initEventDetailPage()` | Public (guest-capable) |

**There is no hard redirect to `login.html` on any page.** Gating is "auth-aware": each handler checks `getUser()` at the top and, when logged out, shows a guest state with a login button (e.g. `#profile-guest`, `#saved-guest`, `#create-event-guest`) while hiding the real content.

- A guest message element is shown when logged out; the authentic content is hidden.
- `event-detail.html` is public — the event renders for guests and logged-in users alike. Its interactive actions (upvote, save, comment) are guarded individually by `requireAuth()`, which redirects to `login.html` only when a logged-out user attempts those actions.

## How Auth Works (UI ↔ API)

> **There is NO JWT / token / Bearer auth.** The API authenticates requests via an **`x-user-id` request header** containing the user's UUID. All sensitive/mutating endpoints require this header to identify the caller.

### Login / Register flow

1. On **login** or **register**, the page calls:
   - `POST /api/auth/login` `{ email, password }` → returns the user object in `data.data`.
   - `POST /api/auth/register` `{ fullName, email, major, password }` → returns user data.
2. The returned user object `{ id, email, fullName, major }` is persisted with `setUser(data.data)` into **`localStorage`** under the key **`kbu_pulse_user`** (constant `AUTH_KEY` in `main.js`).
3. On every subsequent API call, the `apiClient` reads that stored user and automatically attaches the **`x-user-id`** header (see `apiClient._headers()` / `apiClient.post()` in `main.js`).

### Auth helpers (all in `main.js`)

- `getUser()` — reads + parses the `kbu_pulse_user` entry from `localStorage` (returns `null` if absent/invalid).
- `setUser(user)` / `clearUser()` — write / remove the stored user.
- `requireAuth()` — redirects to `login.html` and returns `false` when not logged in; otherwise `true`. Used as a guard on actions like upvote/save/comment.
- `apiClient` — thin `fetch` wrapper (`get/post/patch/delete`) that injects `Content-Type` and the `x-user-id` header, and normalizes errors. **Always use `apiClient`, never raw `fetch`, for API calls.**

### Known auth gap (flag)

The **register flow in the UI is not yet aligned with the API**:
- Per the API docs, `POST /api/auth/register` **returns an OTP** that must then be confirmed with `POST /api/auth/verify-registration`. There is designed email-OTP verification (`/api/auth/verify-registration`).
- The current `initRegisterPage()` in `main.js` skips the OTP/verify step entirely and directly calls `setUser(data.data)` on the register response.

This should be reconciled when implementing full registration (add an OTP step and call `/api/auth/verify-registration`).

## API Docs

The full, authoritative API reference is the **Swagger UI** served by the backend:

- **Swagger UI:** <https://kbu-pulse-api-1.onrender.com/api/docs>
- **Raw OpenAPI spec:** <https://kbu-pulse-api-1.onrender.com/api/docs/swagger-ui-init.js>

Refer to Swagger for exact request/response shapes, DTOs, filters, validation rules, and status codes. A few shared conventions to know up front:

- **API base URL:** `https://kbu-pulse-api-1.onrender.com` (constant `API_BASE_URL` in `main.js`).
- **Pagination:** list responses return `{ data, meta }` where `meta = { total, page, limit, totalPages }`; accept `page` and `limit` query params (limit max 50, default 20).
- **Enums (shared across DTOs):**
  - Category: `HACKATHON, CAPSTONE, STUDY_GROUP, WORKSHOP, SEMINAR, CLUB_EVENT, COMPETITION, OTHER`
  - Major: `DTI, BBA, APDI, CIVIL, MECHANICAL, ELECTRICAL, ARCHITECTURE, IT`
- **Authentication:** endpoints that act on behalf of a user expect the `x-user-id` header (see Auth section). Missing it typically returns `401` / "Unauthorized".
- **Event images:** max 4 per event; avatar uploads capped at 10MB. Images are uploaded as `multipart/form-data` (`files` field).
