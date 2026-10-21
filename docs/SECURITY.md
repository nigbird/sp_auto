# Security controls

How this application addresses each item of `Security_Checklist.xlsx`, and what a
deployment must provide on top. Items are grouped by area; the table at the end
gives the status of every checklist ID.

## Required production settings

The application refuses to run some features without these. Set them in the
server's environment (never commit them).

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | yes | Signs and encrypts session tokens. At least 32 characters of random data; production refuses shorter. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `APP_ORIGIN` | yes | Public HTTPS URL, e.g. `https://plan.example.com`. Emailed set-password links are built only from this, never from the request's Host header. |
| `DATABASE_URL`, `SMTP_*` | yes | As before. |
| `SESSION_IDLE_TIMEOUT_MINUTES` | no (30) | Sign-out after inactivity. |
| `SESSION_MAX_LIFETIME_HOURS` | no (12) | Absolute session limit, however active the user is. |
| `INVITE_LINK_TTL_HOURS` | no (24) | How long an invitation link works. Reset links last 1 hour. |
| `TRUSTED_PROXY_COUNT` | no (1) | How many of your own proxies append to `X-Forwarded-For`; used to find the real client IP for lockouts. |
| `SMTP_REQUIRE_TLS` | no (true) | Leave on. Only an internal relay without TLS should set `false`. |
| `ALLOW_MANUAL_INVITE_LINKS` | no (false) | When an invitation email fails, show the administrator the link to pass on by hand. Off in production by default because the link is a credential. |
| `SEED_USER_PASSWORD`, `SEED_ALLOW_PRODUCTION` | no | Seed script only. Without a password it generates a random one; it refuses to seed a production database unless allowed. |

The app must be served over **HTTPS only**: in production the session cookies
are `Secure` and `__Host-`-prefixed, so sign-in does not work over plain HTTP.

## Reverse proxy (TLS, DoS, server banner)

Some checklist items (TLS cipher suites, Slowloris, `Server` header, IIS
defaults) are properties of the web server in front of Node, not of this code.
Run `next start` behind a reverse proxy configured like this (nginx shown; IIS
ARR/Apache need the equivalent):

```nginx
server_tokens off;                      # SEC-035/051/077: no version in Server header
more_clear_headers Server X-Powered-By; # needs headers-more; otherwise accept "Server: nginx"

limit_req_zone  $binary_remote_addr zone=perip:10m rate=20r/s;
limit_conn_zone $binary_remote_addr zone=conn:10m;

server {
  listen 443 ssl http2;
  server_name plan.example.com;

  # SEC-053/088: TLS 1.2 (forward-secret AEAD only) and 1.3
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
  ssl_prefer_server_ciphers on;
  ssl_session_tickets off;

  # SEC-027: Slowloris and request flooding
  client_header_timeout 10s;
  client_body_timeout   15s;
  send_timeout          15s;
  keepalive_timeout     30s;
  client_max_body_size  12m;   # largest upload is a 10 MB plan workbook
  limit_conn conn 30;
  limit_req  zone=perip burst=60 nodelay;

  location / {
    proxy_pass http://127.0.0.1:9003;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}

server { listen 80; server_name plan.example.com; return 301 https://$host$request_uri; }
```

Remove any default site (e.g. the IIS welcome page, SEC-055) so only the app answers.

## What the application does

**Authentication & sessions**
- Passwords: bcrypt (cost 12). Policy: 10+ characters, upper- and lowercase, digit, symbol; rejects common passwords, easy sequences and the user's own name/email (`src/lib/auth/password-policy.ts`).
- Accounts are created by invitation: the user sets their own password through a single-use, hashed, time-limited link. No default or temporary passwords exist. The seed script has no password in source.
- Sign-in: generic error for unknown user / wrong password, constant-time comparison against a dummy hash, lockout after 5 failures per account or 20 per IP in 15 minutes, all attempts audited.
- Sessions: encrypted (AES-GCM) signed JWT in an `HttpOnly; Secure; SameSite=Strict; __Host-` cookie, 5-minute life; refresh tokens are opaque, stored hashed, rotated on every use with reuse detection (a replayed token revokes the whole session). Every request re-checks the session, user status and session version in the database. One active session per user; idle timeout 30 min; absolute limit 12 h; logout, password change/reset and deactivation revoke sessions server-side. Nothing is stored in `localStorage`.
- CSRF: `SameSite=Strict` cookies, Origin checks on every auth endpoint, and Next.js' built-in Origin check on server actions.
- Open redirect: the post-login `next` parameter only accepts paths on this site.

**Authorization**
- Every server action and route handler checks a permission on the server (`requirePermission`/`userCan`); pages and layouts use `guardPage`. Role permissions are read from the database on each request, so changes apply immediately.
- Forced browsing to a page the role can't open is answered with **HTTP 403** by middleware, before rendering (`src/lib/auth/route-permissions.ts`).
- Records are checked for ownership where users see only their own data (evidence files, reports, breakdowns, deliverables).
- No mass assignment: user, activity, rule and reporting-period updates copy validated fields one by one, so a crafted request can't change an email, password hash, status, approval or foreign key. An owner resubmitting a returned activity can change only its content, and it always goes back for approval.
- No privilege escalation: a user manager can only assign roles whose permissions they hold themselves; a role editor can only grant permissions they hold; nobody can change their own role.
- Segregation of duties: nobody approves a report, breakdown or new activity they submitted or are responsible for; bulk report import skips the importer's own activities.

**Data exposure**
- Password hashes, session counters and tokens never leave the server (`publicUserSelect`); sign-in/invite details are only sent to user administrators. Reset/invite tokens are never returned by an API; in production the fallback "copy invite link" is off unless `ALLOW_MANUAL_INVITE_LINKS=true`.
- Production builds hide server-action error details; route handlers return fixed messages.
- Email bodies (which can contain links) are not written to logs in production.

**Uploads & downloads**
- Evidence: 5 MB, 5 files per report; type decided from the file's content (magic bytes), not its name; SVG/HTML refused; downloaded with `nosniff`, a sandboxing CSP and `attachment` (images inline only). Downloads require sign-in plus ownership or approver rights.
- Workbook imports: 10 MB; must be a real Excel container (zip/OLE signature) before parsing.

**Browser hardening** (`next.config.ts`, `src/middleware.ts`)
- Content-Security-Policy with a fresh nonce per request: `script-src 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, everything else `'self'` only. Fonts and images are served from the app itself (no third-party hosts).
- `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment… disabled), COOP/COEP/CORP, `X-Permitted-Cross-Domain-Policies: none`; `X-Powered-By` removed. No CORS headers are sent, so other sites can't read responses.

**Email**: TLS required (implicit TLS or mandatory STARTTLS), minimum TLS 1.2, certificate verification on.

**Logging**: the audit log records sign-ins and failures, lockouts, session refresh/revocation, password events, refused pages/actions/downloads (`PERMISSION_DENIED`), user and role changes, approvals, imports, exports and configuration changes, with actor, IP, browser and time. Typed passwords are never logged (non-email sign-in identifiers are stored hashed).

**Dependencies**: `npm audit` reports 0 vulnerabilities. Next.js 15.5.28, jsPDF 4, jspdf-autotable 5, SheetJS 0.20.3 (from the SheetJS CDN; the npm `xlsx` package is unmaintained and vulnerable), nodemailer 10, Tailwind CSS 4 (v3 depended on `braces`, which has an unfixed advisory). The unused genkit/Firebase packages were removed. Run `npm audit` before each release.

## Accepted residual items

- **`style-src 'unsafe-inline'`** (SEC-078): the UI libraries (Radix, Recharts) position and colour elements with `style=""` attributes, which nonces cannot cover. Scripts are fully nonce-restricted, so this does not allow script injection.
- **Rate limiting beyond sign-in** (SEC-027/045): sign-in and password-reset are limited in the app; general request rate limits belong in the reverse proxy (see above).
- Existing users whose avatar points at an external placeholder site now show their initials instead.

## Checklist status

`Fixed` = changed in this pass. `In place` = already implemented before. `Proxy` = deployment configuration above. `N/A` = the issue is about a feature or platform this system doesn't have.

| ID | Status | Notes |
|---|---|---|
| SEC-001 | In place | Record-level checks on reports, evidence, breakdowns (no memos module). |
| SEC-002 | Fixed | All tokens use Web Crypto; remaining `Math.random()` removed. |
| SEC-003 | Fixed | Permissions-Policy. |
| SEC-004 | Fixed | Email can't be changed by users; the admin update path can no longer set it (mass assignment closed). |
| SEC-005 | Fixed | 403 from middleware; nothing rendered. |
| SEC-006 | N/A / Fixed | No AWS SDK / fast-xml-parser; dependency tree audited. |
| SEC-007 | Fixed | Next.js 15.5.28; image optimizer and remote patterns disabled; no PPR. |
| SEC-008 | Fixed | Not in tree after upgrades. |
| SEC-009 | Fixed | Seed password from env or random; no reset of existing accounts. |
| SEC-010 | Fixed | Refusals, role and user changes audited with actor/IP/time. |
| SEC-011 | In place | Hashes never selected for responses; verified over HTTP. |
| SEC-012 | Fixed | Nonce CSP. |
| SEC-013 | Fixed | HSTS (2 years, subdomains, preload). |
| SEC-014 | Fixed | `frame-ancestors 'none'` + X-Frame-Options. |
| SEC-015 | Fixed | As SEC-005. |
| SEC-016 | Fixed | Token bound to session + user + session version in DB; `__Host-` cookies. |
| SEC-017 | Fixed | X-Frame-Options DENY. |
| SEC-018 | Fixed | nosniff on every response. |
| SEC-019 | In place | Uploads are permission- and ownership-checked server actions. |
| SEC-020 | In place | Evidence download checks sign-in + ownership/approver; no file paths exposed. |
| SEC-021 | Fixed | Content-signature checks on all uploads. |
| SEC-022 | In place | Permissions re-read per request; tokens live 5 min. |
| SEC-023 | In place | Reset tokens never returned; only hashes stored. |
| SEC-024 | Fixed | `next` restricted to same-site paths. |
| SEC-025 | In place | One session per user; older ones revoked. |
| SEC-026 | In place | Password change needs current password; reset needs a single-use, purpose-bound token. |
| SEC-027 | Proxy | Timeouts and connection limits. |
| SEC-028 | Fixed | No self-approval anywhere, including bulk import. |
| SEC-029 | Fixed | Invite link not returned in production unless explicitly enabled. |
| SEC-030 | In place | As SEC-011. |
| SEC-031 | Fixed | Complexity + common-password policy. |
| SEC-032 | Fixed | Origin checks added to refresh/logout; Strict cookies. |
| SEC-033 | In place | No temporary passwords; links expire and are single-use. |
| SEC-034 | In place | Secure cookies in production. |
| SEC-035 | Proxy | `server_tokens off`. |
| SEC-036 | In place | No shared default password; accounts use invitation links. |
| SEC-037 | Fixed | Zod validation and length limits on user input (no phone numbers in this system). |
| SEC-038 | Fixed | No predictable identifiers (DB uses cuid; client ids use Web Crypto). |
| SEC-039 | Fixed | TLS required for SMTP, minimum TLS 1.2. |
| SEC-040 | Fixed | As SEC-039; reset links not logged in production. |
| SEC-041 | Fixed | Idle 30 min + new absolute 12 h limit. |
| SEC-042 | Fixed | Valid, strict CSP. |
| SEC-043 | Fixed / Proxy | X-Powered-By removed in app; proxy hides its own banner. |
| SEC-044 | In place | Generic sign-in error. |
| SEC-045 | In place | Per-account and per-IP lockout; IP now taken from the trusted proxy hop. |
| SEC-046 | N/A | Axios not used. |
| SEC-047 | In place | No tokens in browser storage. |
| SEC-048 | In place | As SEC-036. |
| SEC-049 | Fixed | Own-record checks server-side; ownership added to progress submission and deliverable reads; activity edits field-whitelisted. |
| SEC-050 | Fixed | As SEC-005. |
| SEC-051 | Proxy | Server header. |
| SEC-052 | Fixed | No `https:`/`data:` wildcards in CSP. |
| SEC-053 | Proxy | Cipher suites. |
| SEC-054 | N/A | Single organisation, no tenants. |
| SEC-055 | Proxy | Remove default web-server pages. |
| SEC-056 | N/A | No appointments; all data endpoints require sign-in. |
| SEC-057 | In place | Centralised audit log for admin actions. |
| SEC-058 | Fixed | Invite links 24 h (configurable), single-use. |
| SEC-059 | In place | Menu and buttons follow permissions. |
| SEC-060 | Fixed | Admins can't set other users' passwords at all; mass assignment closed. |
| SEC-061 | In place | Users choose their own password via invitation. |
| SEC-062 | Fixed | As SEC-007. |
| SEC-063 | Fixed | As SEC-032. |
| SEC-064 | N/A | Email is the sign-in identifier and is mandatory. |
| SEC-065 | Fixed | As SEC-031. |
| SEC-066 | Fixed | As SEC-041. |
| SEC-067 | In place | Refresh tokens hashed, bound to session, rotated, reuse-detected. |
| SEC-068 | Fixed | As SEC-041. |
| SEC-069 | In place | Logout revokes session and refresh tokens server-side. |
| SEC-070 | In place | Tokens bound to DB session; role/permissions from DB. |
| SEC-071 | In place | Tampered tokens fail AES-GCM/HMAC checks and are rejected. |
| SEC-072 | In place | Every server action checks permissions; escalation guards added. |
| SEC-073 | Fixed | Both cookies SameSite=Strict. |
| SEC-074 | In place | Generic errors in production. |
| SEC-075 | Fixed | No email bodies or recipients in production logs. |
| SEC-076 | Fixed | Full header set. |
| SEC-077 | Proxy | Server header. |
| SEC-078 | Accepted | See residual items. |
| SEC-079 | Fixed | jsPDF 4.2 / jspdf-autotable 5. |
| SEC-080 | Fixed | Escalation guards; server-side RBAC throughout. |
| SEC-081 | In place | Write actions all check permissions server-side. |
| SEC-082 | In place | All auth cookies HttpOnly. |
| SEC-083 | In place | No tracking identifiers. |
| SEC-084 | In place | No CORS headers at all. |
| SEC-085 | Fixed | COOP/COEP/CORP, X-Permitted-Cross-Domain-Policies, HSTS. |
| SEC-086 | N/A | Not ASP.NET. |
| SEC-087 | Fixed | X-Powered-By removed. |
| SEC-088 | Proxy | As SEC-053. |
| SEC-089 | Fixed | As SEC-002. |
| SEC-090 | In place / Fixed | Secret only in env; production enforces a minimum length. |
| SEC-091 | In place | As SEC-045. |
