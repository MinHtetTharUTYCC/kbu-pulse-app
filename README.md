# KBU PULSE

University events platform for KBU (Kasem Bundit University). Users can browse, create, upvote, save, and comment on events.

- **Frontend:** Static HTML/CSS/JS — no build step, no framework, no package manager.
- **Backend:** A separate NestJS API hosted on Render (see [API Docs](#api-docs)).

## Live Site

The site is deployed to GitHub Pages: <https://minhtettharutycc.github.io/kbu-pulse-app/>

## Project Structure

```
kbu-pulse-app/
├── *.html            # Pages (index, login, register, profile, saved, create-event, event-detail)
├── js/
│   ├── main.js       # ALL app logic in one ES module (auth, apiClient, page handlers, rendering)
│   ├── navbar.js     # Classic script — renders the bottom navigation (window.navbar)
│   └── util.js       # ES module helpers (capitalize, formatCategory)
├── css/              # reset, variables (design tokens), base, components, pages
├── html/navbar.html  # Static reference for the navbar markup
├── assets/           # Brand/fallback images
└── Example_users
```

### Script-loading patterns

Two script patterns are used in the HTML pages:

1. `js/navbar.js` is loaded as a **classic script** and exposes `window.navbar.renderNavbar()`.
2. `js/main.js` is loaded as an **ES module** (`type="module"`). It imports helpers from `js/util.js` and explicitly exposes anything used by inline `onclick` handlers onto `window` (e.g. `goBack`, `deleteComment`) at the bottom of the file.

## Pages

All pages are plain `.html` files at the repo root. `main.js` routes on load by matching `window.location.pathname` via keywords, dispatching to the matching `init*Page()` handler. Routing is base-path agnostic, so the app works at `/` (root host), `/kbu-pulse-app/` (GitHub Pages), or an extensionless static host.

| Page | Handler in `main.js` | Auth gating |
|------|----------------------|-------------|
| `index.html` (home) | `initHomePage()` | Public |
| `login.html` | `initLoginPage()` | Public |
| `register.html` | `initRegisterPage()` | Public |
| `profile.html` | `initProfilePage()` | Auth-aware (`#profile-guest`) |
| `saved.html` | `initSavedEventsPage()` | Auth-aware (`#saved-guest`) |
| `create-event.html` | `initCreateEventPage()` | Auth-aware (`#create-event-guest`) |
| `event-detail.html` | `initEventDetailPage()` | Public (guest-capable) |

There is no hard redirect to `login.html`. Each auth-aware handler checks `getUser()` and, when logged out, shows a guest state with a login button. `event-detail.html` is public, but its interactive actions (upvote, save, comment) are guarded by `requireAuth()`.

## Authentication

There is no JWT/token auth. The API authenticates requests via an **`x-user-id` request header** containing the user's UUID.

- Login/Register store the returned user object (`{ id, email, fullName, major }`) in `localStorage` under `kbu_pulse_user` (`AUTH_KEY`).
- `apiClient` reads that stored user and attaches the `x-user-id` header on every call. Always use `apiClient` (never raw `fetch`) for API calls.
- Known gap: the register flow skips the designed OTP verification step (`/api/auth/verify-registration`) — see `initRegisterPage()`.

## API Docs

The authoritative API reference is the backend's Swagger UI:

- Swagger UI: <https://kbu-pulse-api-1.onrender.com/api/docs>
- Raw OpenAPI spec: <https://kbu-pulse-api-1.onrender.com/api/docs/swagger-ui-init.js>

Shorthand conventions:

- API base URL: `https://kbu-pulse-api-1.onrender.com` (`API_BASE_URL` in `main.js`).
- Pagination: list responses return `{ data, meta }` (`meta = { total, page, limit, totalPages }`); accept `page` and `limit` (max 50, default 20).
- Enums: Category — `HACKATHON, CAPSTONE, STUDY_GROUP, WORKSHOP, SEMINAR, CLUB_EVENT, COMPETITION, OTHER`; Major — `DTI, BBA, APDI, CIVIL, MECHANICAL, ELECTRICAL, ARCHITECTURE, IT`.
- Auth: endpoints acting on behalf of a user expect the `x-user-id` header.
- Event images: max 4 per event; avatar uploads capped at 10MB; uploaded as `multipart/form-data` (`files` field).

## Running Locally

No build step or package manager is required. Open any `.html` file directly, or serve the folder statically:

**Option 1 — VS Code Live Server (recommended):**

1. Install the **Live Server** extension in VS Code.
2. Right-click on any `.html` file (e.g. `index.html`) → **Open with Live Server**.
3. It serves the folder at <http://localhost:5500> and auto-reloads on save.

**Option 2 — CLI server:**

```bash
python -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

## Deployment

- **GitHub Pages** — deploys from the `main` branch.

## Branching

- **Never push directly to `main` or `dev`.**
- Always work in a dedicated feature branch (e.g.`feature-profile`, `saved`, `navbar`, …).
- Open a Pull Request for your feature branch; **PRs must target `dev`**, not `main`.
- Changes reach `main` (the deployed branch) only after they have been reviewed and merged through `dev`.