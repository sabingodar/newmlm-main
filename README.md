# Dynamic Life Success — PostgreSQL edition

Node.js 24 + PostgreSQL 17 application. Runtime data, sessions, settings, source archives and import staging live in PostgreSQL. The application has no dependency on Railway or Hostinger APIs. Change `DATABASE_URL` to connect to another PostgreSQL provider.

## Branding and CMS

Open **Brand & CMS** at `/admin/settings` to manage the business name, logo, website hero, About content, contact details, social links, footer and SEO metadata. The supplied Dynamic Life Success logo is bundled unchanged at `public/brand/logo.jpg`. Uploaded JPG/PNG/WebP/GIF logos (maximum 2 MB) are stored in PostgreSQL, so they move with your database backup. Uploaded bytes are checked for supported image signatures; external logo URLs and SVG uploads are not accepted. Uploading previews a logo; **Save website settings** applies it.

The administration dashboard uses the company's blue/green identity with a navy corporate layout, grouped navigation, real summary cards, an all-time deposit/withdrawal comparison, review queues and recent orders. The Refresh button reloads current PostgreSQL aggregates. Design changes do not change balances or business records.

## User management and member dashboard

Open **Members → Details** for the dedicated `/admin/users/detail/{local-id}` management page. It includes profile/address and verification records, manual affiliate rank assignment without bonuses, ban/unban with reasons, exact-decimal balance adjustments, an append-only ledger with idempotent request references, related orders/deposits/withdrawals, network placement, login history, internal notices, member passwords and server-enforced portal menu permissions. Source website member IDs may differ from the local IDs retained during the original import; use the username to identify the person.

Members sign in at `/member` or `/user/dashboard` with their username. Administrator and member cookies are separate. Member APIs derive the account from the session and never trust a caller-supplied member ID. Ban and password changes revoke sessions. Administrator password resets require the member to choose a new password at the next login. Members change their own password using the current password; no password is displayed or returned by the APIs.

The user-requested shared temporary password has been assigned to existing local members. Each member has a separate salted hash. The temporary password is not committed to the source or written to the backup as plaintext. First login is restricted to changing that temporary password; new personal passwords must contain 12–256 characters. This does not modify credentials on the original website.

**Preview member** opens a read-only administrator preview, not an impersonated member login. Internal notifications are portal records only and send no email or SMS. Balances are bookkeeping amounts; adjustments do not move bank funds, and historical deposits are never automatically credited again. Original password hashes, KYC attachments and 2FA secrets were not imported. Two-factor authentication and automatic reward/commission payouts are not implemented. Recorded reward/commission values, where available, are labelled source snapshots rather than live earnings.

## Local setup

1. Install Node.js 24+ and PostgreSQL 17 (or Docker).
2. Run `npm ci`.
3. Copy `.env.example` to `.env`, set an administrator password of at least 12 characters, and set `DATABASE_URL`.
4. For the existing Windows checkout, `npm run db:local` starts the project's isolated PostgreSQL cluster on localhost port 55432. Set `PG_BIN` if your PostgreSQL installation is elsewhere. This command does not operate on an existing PostgreSQL service on port 5432.
5. Alternatively, set `POSTGRES_PASSWORD` and run `docker compose up -d database`; use that password in `DATABASE_URL`.
6. Run `npm run db:migrate`, then `npm start`.
7. Open `http://localhost:3001/admin`. The existing checkout's administrator credentials remain in its ignored `.env`.

Migrations also run safely on application startup. The local database remains running when the web application stops. Its files are under ignored `data/postgres/`; do not move live PostgreSQL data directories between providers.

## Existing SQLite data

The current checkout has already migrated its 533 application records from `data/dynamic.db` to PostgreSQL, preserving IDs and every stored record field. The original SQLite database remains untouched for recovery.

For another untouched SQLite installation, target a **fresh PostgreSQL database**, then run:

```sh
npm run db:migrate:sqlite -- /absolute/path/to/dynamic.db
```

The script uses a consistent SQLite read snapshot and a single PostgreSQL transaction. It preserves records, IDs, timestamps, settings, audit entries, source archives and import receipts; resets identity sequences; and refuses a non-empty or previously migrated destination. Administrator credentials are configured using environment variables; old sessions are not migrated.

## Deploy to Railway

1. Connect this source repository to a Railway application service. The Dockerfile installs locked dependencies and includes migrations and bundled images.
2. Add a PostgreSQL service to the project.
3. Set the application's `DATABASE_URL` to Railway's PostgreSQL connection reference, usually `${{Postgres.DATABASE_URL}}` (use your actual service name).
4. Set `NODE_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `DB_POOL_MAX=10`. Railway supplies `PORT`.
5. Deploy and generate the web service domain. `/health` returns 200 only when PostgreSQL is reachable.
6. Restore the private PostgreSQL backup into the empty production database using the steps below, then verify counts and balances.

**The web application no longer requires a `/data` volume.** PostgreSQL itself needs durable provider-managed storage and scheduled backups. Images included in `public/media` travel with the source deployment. Future user-uploaded files should use portable S3-compatible object storage.

## Move to another hosting provider

1. Create an empty PostgreSQL database at the destination and deploy the same source/container.
2. Pause writes on the old installation during the final export/cutover. This application does not implement live replication or automatic dual writing.
3. With the old `DATABASE_URL`, create a private portable snapshot:

```sh
npm run db:export -- data/postgresql-backup.json
```

4. Configure `DATABASE_URL` for the destination using its environment/secrets controls, then restore:

```sh
npm run db:restore -- data/postgresql-backup.json
```

5. Verify record counts, amounts, images and login; then point the domain to the new installation. Keep the old database until verification is complete.

Export uses a repeatable-read database snapshot. The v5 portable format includes member profiles, balances, ledger, member password hashes and forced-change flags, internal notices and login history, together with CMS content, uploaded logos, IDs, timestamps, audit history and source archives. Restore also accepts v1/v2 backups and initializes the missing member tables. It refuses non-empty destinations, restores transactionally and repairs identity sequences. Administrator credentials, all sessions and login rate-limit state are excluded; configure administrator environment variables at the new host. Backups include sensitive member/password-hash data; keep them private and never commit them to a public repository. The export command refuses to overwrite an existing file.

For large databases, use the provider's native PostgreSQL backup tooling (`pg_dump` custom format / `pg_restore`) and tested scheduled backups; the JSON transfer script is intended for this application's current datasets and loads its snapshot into memory. Keep a matching application version with each backup. Native backups of the full database can also contain authentication hashes and sessions and must remain private.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Standard PostgreSQL URL; required |
| `DB_POOL_MAX` | Connections per application process; default 10 |
| `DATABASE_CA` | Optional trusted CA certificate PEM; certificate validation stays enabled |
| `ADMIN_USERNAME` | Administrator account; default `admin` |
| `ADMIN_PASSWORD` | At least 12 characters; keep identical across replicas |
| `NODE_ENV` | `production` enables Secure cookies and HSTS |
| `PORT` | Web listener; local `.env` uses 3001 |
| `PG_BIN` | Optional path to PostgreSQL binaries for `db:local` |

Use the provider's TLS settings (for example `sslmode=verify-full` with a trusted certificate). Do not disable certificate verification. Keep pool size × app replica count within the database connection budget.

## Tests and architecture

Run `npm test` against a local PostgreSQL role allowed to create disposable databases. Tests create uniquely named isolated databases, never clear the application database, and clean up their own databases. Use `TEST_DATABASE_URL` to select a separate test server. Coverage includes authentication, origin protection, transaction rollback, concurrent inventory reservations, cancellation idempotency, unique PIN enforcement, pagination, backup/restore, stable sessions and credential rotation.

- `server.mjs`: HTTP routing and response handling.
- `src/database.mjs`: connection pool and checksum-verified, advisory-locked SQL migration runner.
- `src/repository.mjs`: data access and transaction boundaries.
- `src/auth.mjs`: shared sessions and login throttling.
- `src/validation.mjs`: module field validation.
- `src/legacy.mjs`: original administrator-list import mapping.
- `migrations/`: append-only PostgreSQL schema migrations.
- `scripts/`: migration, local setup and portable export/restore commands.

Existing module payloads use indexed JSONB to preserve imported fields. Product/order changes use row locks; record versions reject stale edits from the UI. Dashboard aggregates run in PostgreSQL, and list screens use server-side pagination/search. Shared sessions and throttling support multiple application processes. For future financial payouts, introduce dedicated relational ledger tables, exact numeric money columns, foreign keys and idempotency keys through new migrations before implementing payout logic. PostgreSQL alone does not implement those business rules.

This version still has the source-migration limits recorded in `MIGRATION.md`. Local member authentication and user management have now been added, but customer checkout, payment-gateway integration, automatic MLM payouts and complete original server data are not included. New deposit/withdrawal records are bookkeeping entries and do not move money.
Member panel update (3 November 2026): the local `root` account includes member reports, detailed order reports, referral snapshots, reward history with type/source filters, earnings, KYC status and Earth/Sky summaries. Source snapshots are labelled separately from the local balance ledger. Individual BV logs, two-factor authentication, bank gateway settlement, receipt uploads and automatic payouts are not implemented by these pages. Local member credentials are unchanged by the source data refresh.

Binary tree and registration: `/user/binary-tree` opens Sales Team for the signed-in member. Search, subtree navigation, parent navigation, zoom and node details use PostgreSQL placements scoped to that member. Earth follows the leftmost placement leg and Sky the rightmost. Direct referrals start with zero balance and require a password change; invited members choose their own password. Invitation links are single use and expire after seven days. Invitations and rate limits are excluded from portable backups; regenerate invitation links after restore.

The authorized source tree capture imported 148 observed member nodes across 51 views, with 146 known parent/position links and verified child slots for all 148 members. One member has an independent tree because its exact position in the main source tree was not displayed. One newly added source account was verified in source administration and imported with the previously requested temporary password policy; existing credentials were retained. Source captures in `data/` are private. `scripts/import-binary-tree.mjs` accepts the observed capture and rejects conflicting placements and cycles.

Member commerce (3 November 2026): Earth/Sky lists support search, rank, depth, shopping dates and pagination. Source list metadata and known direct referrers/ranks were imported for 147 team members. Registration Center reuses the working scoped referral and invitation flow. Discount Panel, Wholesale Panel, Products and Quick Order have independent product visibility switches in admin product forms and lists. The initial source mapping contains 35 discount, 29 wholesale, 35 retail/quick products and six dispatch centers.

Product pricing supports channel prices, wholesale minimum quantity, business value and configurable VAT included/excluded prices. Quick Order accepts multiple products and submits one payment-pending order. Quotes and stock checks are enforced on the server, retries are idempotent, and admin cancellation restores all items once. Members can view their own order details; administration verifies payment through the order editor. No bank transfer or payment settlement is performed automatically. Private v5 backups include checkout idempotency records and regional assignments, and still accept v1–v4 backups.
# Nepal addresses and regional partners

Admin → Members → Add member and member/referral registration include Nepal → province → district → city/palika selectors. Member Details → Profile and Member → Profile can update the structured address. Existing free-text addresses are retained; they must be selected before appearing in regional reports.

Admin → Member Details → Coordinator & Area assigns Country, Province, District Coordinators or City Franchise Partners. One assignee per role/area; a member can hold multiple areas. Remove an existing assignment before assigning that area to another member. Assigned members see Coordinator Panel after refreshing their portal. It lists only their areas, with search/date filters, member count, confirmed order count, purchase amount and recorded business value. Overlapping scopes count each member/order once. Current member address determines attribution, including past purchases; Pending/Cancelled orders are excluded. Business value falls back to order amount for historical orders without a recorded business value. Reports do not pay commissions.

Portable backup format v5 also includes coordinator assignments and structured member addresses. Nepal data attribution/corrections are documented in public/geo/README.md.

### Advanced product management

Admin → Products → Categories / Sub-categories creates a main category or a child category. Product Add/Edit selects a matching pair; a sub-category is required when the category has children. Migration 008 maps existing category labels to category IDs without changing prices or stock.

Admin → Brand & CMS → Commission settings stores fixed NPR amounts per unit for Dispatch Center, Country/Province/District/City Coordinator or Franchise, and affiliate ranks. New products copy these defaults. Existing saved product commissions remain unchanged; use “Apply current Settings defaults” to replace them explicitly.

The product editor supports MRP, sales/channel prices, stock tracking, featured visibility, warranty period in Day/Month/Year, optional sales/purchase reward points, weight, unit, color, YouTube URL, short/full descriptions, three gallery images and one featured image. Each image is limited to 2 MB. Frontend cards strike through higher MRP and show the sales price; only active Website products marked Featured enter the featured collection. Product details show the gallery, warranty, specifications and video link.

Manage Stock Off allows up to 10,000 units per order line without changing inventory. Orders retain whether each line originally reserved stock, so cancellation restores only reserved quantities even if product stock settings later change. Commission and reward settings are recorded per unit in the order snapshot. They do not automatically pay money, award points or credit wallets.

Portable backup v6 includes category hierarchy, coordinator assignments, product settings and uploaded media, and restores v1–v5 backups. Restore requires an empty database. Keep the source version and private backup together.

### Ecommerce storefront and delivery tracking

The public homepage has a responsive menu, large photo carousel, category photos/icons, sub-category selection, product search, minimum/maximum prices, Low-to-High / High-to-Low sorting and paginated products. Blog, Franchise Partner, Contact, Testimonial and Track Order have their own pages. Admin → Brand & CMS → Storefront CMS manages up to six slider photos, published/draft blog posts and real customer testimonials. Without custom slides, visible product photos form the slideshow. Category images are uploaded under Products → Categories / Sub-categories. Draft content never enters public APIs.

Contact and franchise inquiries are saved as New CRM leads; they do not send email or SMS. Franchise inquiries include the selected Nepal region. Anonymous submissions are rate-limited and use a honeypot field.

Checkout supports Home delivery or Dispatch center pickup. Admin → Orders → Edit can update Pending, Confirmed, Dispatched, Out for delivery, Delivered or Cancelled status, courier, tracking number, HTTPS courier tracking link, estimated delivery date and customer-facing delivery notes. Status changes are retained as order events. Members can use Track Order or My Orders to see their own delivery timeline and follow the courier link. The public Track Order page requires member sign-in. Tracking follows administrator updates; no live GPS feed or courier API is configured.

Portable backup v7 adds category images and retains storefront content, inquiries, delivery options and status histories. It accepts v1–v6 backups and initializes missing category images to empty strings.


### Cart, checkout and reward benefits

Both storefront purchase buttons lead to `/cart`. Guests register or sign in within checkout without losing their cart. Registration supports Nepal addresses, a valid referring member username and a chosen password of at least six characters; binary placement is assigned separately.

Admin → Brand & CMS manages coupons (fixed/percentage, caps, minimum spend, Nepal dates and usage limits), reward redemption settings and verified member point adjustments. Default conversion is 1 point = Rs. 1. Historical imported point snapshots are not automatically spendable. Reward accounts and their append-only ledger are separate from cash wallets. Discounts reduce the VAT-inclusive total; original VAT and product business values remain in the order snapshot.

Checkout reserves coupon usage and redeemed points atomically with stock. Only orders marked both Paid and Delivered earn configured purchase points for the buyer and sales points for the recorded referrer, once. Cancellation/refund returns redeemed points and reverses earned points. Reversing already-spent earnings can produce a negative points balance, repaid by future earnings. Refunded orders cannot reopen.

Payment currently uses manual Bank Transfer: checkout creates a Pending order, and administrators verify payment. No online payment gateway is configured. Portable backup v8 includes coupons, reward accounts, immutable reward entries and coupon redemptions; it accepts v1–v7 backups.

### CMS tabs and member password recovery

Brand & CMS separates General & Contact, Blog, Slider & Testimonials, Commissions, Coupons & Rewards, and Email Settings. Blog listing supports photo uploads, add/edit, Active/Inactive publishing, optimistic edit checks and deletion. Inactive articles do not enter public APIs. Slider edits preserve blog posts.

Member sign-in and checkout offer Forgot password; password inputs have an accessible show/hide button. Reset requires the member username and registered email. Tokens are random, stored only as SHA-256 hashes, expire in 30 minutes and are single-use. A successful reset revokes all existing member sessions. SMTP request responses do not reveal whether an account exists. Email transport failures log only a generic message.

Configure SMTP in CMS → Email Settings and set the public website origin for reset links. Gmail requires a provider-issued App Password. SMTP uses TLS or required STARTTLS; SMTP secrets are encrypted with MAIL_ENCRYPTION_KEY, never exposed by public/admin settings responses. Set a random key of at least 32 characters in the deployment environment. Keep that same secret when moving databases; source/private ZIPs do not contain the key. Admin login recovery continues through ADMIN_PASSWORD on the server, not member email reset.

Portable backup v9 adds encrypted mail settings, accepts v1–v8 backups, and excludes reset tokens and sessions. Existing passwords are not reset during deployment or migration. Reset email delivery requires working SMTP credentials; no external email was sent during automated tests.
