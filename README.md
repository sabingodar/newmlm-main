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

Export uses a repeatable-read snapshot. Portable v13 includes application records, member and managed administrator password hashes, admin roles and personal permission overrides, center assignments, balances and immutable ledgers, CMS, uploaded media, coupons/rewards, IDs, timestamps and audit history. Restore accepts v1–v12 and initializes missing tables. It restores transactionally, repairs sequences and refuses existing application data, managed accounts or customized role policies. Unchanged bootstrap role defaults and the environment-managed primary administrator may already exist. Primary administrator credentials, all sessions and rate-limit state are excluded; configure ADMIN_USERNAME/ADMIN_PASSWORD on the new host. Backups contain private personal data and credential hashes; never commit or publish them. Export refuses to overwrite an existing file.

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

Homepage hero: Admin → CMS → Slider & Testimonials supports full viewport photo slides, uploaded MP4/WebM (25 MB) or a YouTube link, with headings, description and button. Videos request muted autoplay; browser settings can prevent autoplay. Uploaded videos include Play/Pause and sound controls; YouTube uses player controls. Use browser-compatible H.264 MP4/WebM and YouTube videos that allow embedding. Migration 012 stores uploaded video in PostgreSQL. Portable backup v10 includes video files and accepts earlier backup formats. HTTP byte ranges support seeking.

CMS content controls: Slider and Testimonial cards have Edit, Active/Inactive and Delete controls; use Save storefront content to publish changes. Coupon Edit and Delete use version checks. Deleted coupons are hidden and disabled while historical redemptions remain intact. Manual reward adjustments support Edit and Delete through compensating ledger entries and audited revisions; earned, redeemed and refund entries remain managed by their orders. Revisions cannot overdraw available points. Portable backup v11 includes coupon deletion state and reward revision history.

Homepage media editor now shows a preview and Edit, Active/Inactive and Delete controls for the selected single video or YouTube link. Choose Photo Slideshow to add/manage slide photos with thumbnail previews. Only the selected enabled mode plays; other video/link values remain saved. Inactive media remains editable in CMS. Three mode switches are mutually exclusive, and switching the active mode Off hides the homepage hero. Video headings and description appear at the bottom centre, above playback controls.

Admin member directory includes affiliate rank and status filters, search, reset, and server-side sorting by newest/oldest, name, affiliate rank threshold (minimum purchase), or status. Unassigned ranks sort last. Pagination and CSV export use the same filters and sort.

## Administrator team and center access

Use `/admin/manage-admins` to create, edit, activate/deactivate or delete team accounts. Roles: Admin, Admin Staff, Dispatch Center Manager and Service Center Manager. Admin always has full access; the environment-managed primary administrator cannot be disabled, deleted, demoted or reset from the UI. New managed passwords require at least 6 characters and use individual scrypt salts.

Role permissions define shared menu/work access. Personal overrides use Inherit, Allow or Deny; personal Deny wins. Admin alone manages team accounts and role policies. Role, permission, status, password and center assignment changes revoke affected administrator sessions. API checks enforce permissions independently of the visible menus.

Create a Dispatch Center at `/admin/dispatch-center` or a Service Center at `/admin/service-centers`. Existing imported centers remain dispatch centers for checkout compatibility. Save a center, then use Create manager or Assign manager. Managers require an active center of the matching type. Dispatch access updates delivery status, courier and tracking only; it cannot change payment or order totals. Service managers manage tasks linked through centerId. Center managers list and modify only their assigned center orders/tasks, including exports and dashboard counts. Unassigned historical tasks need an Admin to choose a service center before a manager sees them.

Administrator reference import is one-time and transactional (`scripts/import-admin-reference.mjs`). It reads a verified private snapshot and takes the temporary password from IMPORTED_ADMIN_PASSWORD, never from a source file. Existing primary admin credentials, member records and financial ledgers are preserved. Source Super Admin maps to local Admin; Unknown accounts map to Admin Staff with all permissions denied pending owner review. Managers keep verified source center IDs; missing referenced historical centers are created with their original status. New imported accounts must change the temporary password before any private workspace API is available. Managed administrators can also change their own password from the header. Password changes revoke all their sessions. Portable v13 preserves forced-change flags and import metadata.

Dispatch inventory and order flow

Admin → Stock Transfers sends multiple SKU quantities from central stock with a reference, remarks and optional private proof (PDF/JPG/PNG/WebP, up to 5 MB). The assigned dispatch center confirms receipt before stock becomes available there. Transfer details provide printable challan and internal transfer bill. These documents do not collect a customer payment.

Dispatch Stock shows received, reserved and available quantities and an immutable movement history. Checkout supports Online / Home delivery or an active Dispatch Center. Order Flow supports full or partial quantity dispatch, reference/proof/remarks, shipment challans and the original customer bill. Changing routing preserves past shipments and bill totals. Cancellation releases only undispatched reservations. An unassigned online order requires its exact Order ID and Member ID/username for a center to look it up and dispatch it.

Orders List keeps courier fields inside Order Flow → Courier & Delivery. Its Actions contain Order Flow, Courier Details and Bill Print. Courier Details is a read-only view with an HTTPS tracking link. Existing historical summaries without verified product lines remain read-only for stock operations.

Portable backup format v14 includes inventory proofs, transfers, stock, allocations, dispatches and movement history. Older supported backups restore with empty inventory tables and central opening balances. Restore checks stock journals, reservations and financial ledgers. Keep private-data backups private.

Dispatch commission withdrawals (migration 017, portable format v15)

Dispatch Center Managers see only received products at their assigned center in Products, with on-hand, reserved and available center quantities. Sending a transfer alone does not list a new SKU. Search, pagination, dashboard counts and CSV exports enforce the same server-side scope.

Dispatch Commissions credits the actual dispatching center for quantity × the per-unit commission saved with the order. Older orders without a commission snapshot use the product's configured rate at dispatch. Replaying a dispatch does not credit twice. Existing shipments are not retrospectively credited. Central warehouse dispatches earn no center commission.

Each center saves Bank (bank name, account name, account number, branch, remarks, optional QR image), Wallet (account name and number, remarks, optional QR) or Cash payout details. QR/payment proof images are private and limited to 2 MB. Admins manage enabled method names such as eSewa or other wallets under Dispatch Commissions → Payment methods. Saved details prefill requests and may be changed; submitted requests preserve a separate snapshot.

A withdrawal reserves available commission at Pending. Admin moves it to Approved, then Paid after completing payment outside the app and entering its payment/receipt reference. Optional payment proof is attached. This records manual payment; it does not invoke a live gateway. Rejection or Pending cancellation releases the reservation. Paid adds one immutable debit. Concurrent requests cannot spend the same available balance. Admin review actions are audited. Role/personal permissions separately control commissions.view, commissions.request and commissions.manage; center managers cannot approve payments or configure global methods.

Portable format v15 includes commission balances, immutable ledgers, withdrawals, payout profiles, methods and private QR/payment images. Restore reconciles balances against ledger entries and reserves against open requests. Keep backups private because payout account details are included.

Transfer corrections (migration 018, portable format v16)

Before receipt, a center with Receive access (or an administrator with Transfer access) can request a complete corrected SKU/quantity list with a reason. The transfer remains Sent and a Pending edit pauses receiving. The Admin reviews the before/after quantities under Details / Print and approves or rejects. Only non-center administrators with inventory.transfer may review.

Send already deducts central available stock into transit. A correction request changes no stock. Approval returns removed quantities to central stock and deducts only added quantities; insufficient stock rolls the whole approval back. Receipt then adds exactly the approved quantities to center stock and does not deduct central stock again. Rejection leaves the last approved quantities in effect. Cancel returns the current approved in-transit quantities and rejects any pending edit. Received transfers cannot be corrected.

Original transfer lines and submitted edit details remain immutable. Each accepted correction is retained with requester, reason, reviewer and review remarks. Challan/bill prints use the latest approved revision and label pending review. Transfer version checks and row locks protect receipt, approval and cancellation races. Portable v16 preserves edit history and the approved revision link.

Products directory: administrators with product management access can delete a product after confirmation. Deletion archives its record, makes it Inactive and disables shopping panels; existing order references, stock quantities and movement history remain intact. Deleted records cannot be edited or republished. Center users retain a read-only directory. Search, stock availability and Active/Inactive filters combine before pagination and apply to CSV exports; center availability uses received on-hand minus reserved quantities.

Rank matching rewards (migration 019, portable format v17)

Admin → BV ranks configures Min Purchase (Rs.), Earth BV (left), Sky BV (right), reward amount and Active/Inactive. Imported rank criteria are recovered from the preserved source row without activating ranks or issuing historical payouts. Manual affiliate-rank assignment remains independent and never pays a bonus.

All three thresholds must be met. Own purchases use actual Paid + Delivered order totals; Earth and Sky sum product BV × quantity across every descendant in the member's corresponding root branch, including grandchildren and deeper members. Branches are determined at the root, regardless of a descendant's internal placement. Self BV is excluded from downline totals. Only local verified orders with explicit member IDs qualify; historical imported summaries are excluded. Orders without a saved BV amount contribute no inferred BV. New checkout and manual orders save product BV snapshots so later product edits cannot change purchased BV.

Paid + Delivered updates evaluate the buyer and recorded ancestors atomically. Each active rank pays once per member into member_accounts with a unique, append-only member_ledger credit, immutable rank award/rule/metrics snapshots and a member notification. Configuration changes alone do not issue payouts. Admin → Check member rewards previews qualification and can settle existing eligible verified purchases, safely skipping previously awarded ranks. Serialized order/network updates and award uniqueness prevent concurrent missed/double payouts.

Awards are one-time earned milestones. If a refund/cancellation later lowers qualification, Check member rewards flags the previous award for Admin review. Previously credited funds are not automatically debited and the same rank cannot pay again. Rank thresholds, awards and ledger links travel with portable v17 backups; restore reconciles award amounts against their wallet credits. Old backup/import rank fields are normalized from preserved source criteria.

Member directory deletion and earnings tabs

A separate users.delete permission controls the Delete button in the member directory and details. Center managers cannot delete members. Confirmation archives the member as Inactive, hides it from directory/search/CSV, revokes member sessions and reset links, and removes current coordinator assignments. User records, wallet balances, orders, immutable ledgers, rank rewards, points and placement links are retained. The original details URL remains a read-only history view; deleted members cannot be edited, unbanned, given points or have their password changed through Admin endpoints.

Member Details → Commission displays recorded wallet commission credits/debits with totals and pagination; product commission settings and unclassified opening balances are not treated as earned commission. Rewards separately shows one-time cash rank awards with qualification snapshots and reward point history with its own balance and pagination. These read-only tabs do not issue any payments or compute additional commissions. PostgreSQL backups preserve deletion metadata and retained history through the existing record/ledger tables.

Step and Affiliate Commission Settings (migration 020, portable format v18)

Admin → Commission Settings provides separate Step and Affiliate On/Off switches, up to 100 ordered Step percentages, BV or VAT-exclusive net sales as the base, rupees per BV, and the Affiliate percentage. Both switches start Off and no live percentages are activated by migration. Permission keys commission-settings.view/manage are separate from dispatch-center commissions; center managers cannot modify the global network policy.

New member-linked orders privately snapshot the saved policy version and full binary parent chain. Step 1 is the buyer's placement parent, Step 2 its parent, etc.; referrer/sponsor links do not determine these payouts. Current inactive/deleted recipients are skipped without compressing physical step numbers. Orders without a policy snapshot and preserved historical summaries are not retrospectively paid. Rates and placement changes do not rewrite existing snapshots. Live Off switches can stop a not-yet-settled commission; turning them back On never replays a settled/skipped order.

Distribution requires a fully dispatched status (Dispatched, Out for delivery, or Delivered) AND payment Paid. Pending, Confirmed, Partially dispatched and unpaid orders never distribute. The final quantity dispatch automatically sets Dispatched and triggers settlement if already Paid. If payment is verified later, that update triggers settlement. Subsequent delivery updates or request retries cannot pay again. Ranking rewards remain governed by their own Paid + Delivered rule.

Step pays its configured percentage of BV × rupee value, or of net sales. Net sales proportionally removes recorded VAT from the final amount after coupon/point discounts. Each actual Step income then generates the SAME Affiliate percentage of that original income at every recorded binary ancestor above the Step recipient, continuing to the root. It does not compound from the preceding affiliate payment and never reduces the original member's income. Rank rewards and affiliate payments do not seed further Affiliate income. Exact integer-cent arithmetic rounds down each payout; below Rs. 0.01 nothing is credited. Percentages support 0.01% increments.

The calculator previews costs for a chosen depth, optionally simulating switches On without changing settings or wallets. Member Details → Commission shows the resulting wallet entries, source member, original base and rate. Refund/cancellation or a later status reversal flags paid entries for Admin review; existing credits are not automatically debited. Ledger credits, original Step links, policy snapshots and order settlements are immutable and idempotent.

Portable v18 includes policy settings, frozen order contexts, distribution receipts and Step/Affiliate entries. Restore reconciles every entry with its wallet credit, rate/base amount, source Step income and order totals; old backups initialize Off defaults. Private policy contexts are not included in customer-facing order payloads.

Discount Panel reward redemption (migration 021)

Admin → Reward Settings (also /admin/reward-points/settings) sets the rupee value of one reward point, redemption On/Off, a default sales-percentage cap and category/subcategory overrides. A subcategory custom rule takes precedence over its parent; otherwise parent/default applies. The default cap starts at 0% until configured. Existing point balances and point conversion values are preserved. Category limits are kept when the older CMS reward form updates conversion settings.

Reward points can be redeemed ONLY through the Discount Panel channel. Retail storefront/cart, Quick Order and Wholesale reject positive reward redemption server-side. Coupon use continues in the other channels. The public cart links to Discount Panel instead of offering a points input.

The cap is the sum of category percentages of VAT-inclusive sales amounts after coupons, before points redemption. Coupon discounts are allocated proportionally using integer cents and deterministic remainder allocation. The payable discount is limited by category caps, the actual available point balance and whole points × the configured rupee value. Quote/checkout revalidate current product/category settings; checkout shares the policy row lock through commit and locks the point balance before spending. Settings changes require a fresh quote. Paid/placed order snapshots keep the original point value, discounts and category-cap details. Cancellation/refund restores spent points once through the existing immutable ledger.

Discount Panel displays reward balance and its current Rs. value, the configured conversion, product category cap, and order-level maximum redeemable points/value. Review Order supports coupon and points application and shows the resulting discount and final total before submission. Order history shows the saved points used and their original rupee value.

Reward Settings → Member points supports exact member ID/name/username search, manual Add/Reduce, mandatory remarks, current point/Rs. balance and recent ledger history. Manual changes require users.rewards; policy access uses reward-settings.view/manage or the existing benefits.manage permission. Reductions cannot exceed available points; adjustment references make retries idempotent and the Admin actor is audited. These operations do not modify cash-wallet balances. Settings and audit/point/order snapshots remain portable in the existing v18 JSON-backed tables.


### Checkout fulfillment and payments (migration 022)

Admin → Payment Settings (/admin/payment-settings) controls Cash on Delivery, Bank Transfer/QR, eSewa ePay v2 and Khalti KPG-2. Only enabled, configured methods appear at checkout, including the member panels. COD is the initial default; bank and gateways stay Off until configured. Add active bank accounts with bank name, account holder, account number, branch and uploaded QR (PNG/JPEG/WebP, up to 2 MB). Each order retains its selected bank details even after settings change. Bank references are optional and payment remains Pending until Admin verifies it in Order Flow.

Dispatch Center appears only when Order fulfillment is Dispatch Center. Online / Home Delivery clears the center and leaves assignment to Admin. Server checkout ignores a submitted center for online fulfillment and requires an active center for center fulfillment.

For gateways set the public website origin, Sandbox/Live environment and merchant credentials in Admin. Live requires HTTPS. Set PAYMENT_ENCRYPTION_KEY to a stable random secret of at least 32 characters; if unset, the existing MAIL_ENCRYPTION_KEY is used. Keep that key securely with your private backup and preserve it when moving servers. Secrets are encrypted with AES-256-GCM and never returned to browsers. Public origin is configuration, not the incoming Host header.

Checkout records a Pending order and reserves stock, then opens the selected gateway. eSewa uses a signed form; Khalti is initiated server-side with amounts in paisa. Return URLs never prove payment. Provider status/lookup must match the saved attempt, currency amount and provider transaction before marking Paid. Repeat verification is idempotent. Payment received after cancellation/refund is recorded for Admin review and does not reopen the order or distribute commission. Existing Paid + full Dispatched commission rules and Paid + Delivered reward/rank rules remain in force. Admin cannot manually mark an unverified gateway order Paid.

A pending gateway order can be continued or checked from member Order Details; Admin can check it in Order Flow. Disabling a gateway prevents new payment starts while verification remains available. Do not pay a second time when confirmation is unclear. Khalti initialization with an ambiguous network response is not automatically retried: Admin must reconcile it in the merchant portal before cancelling/reordering. Provider refunds and bank/COD collection are managed by Admin; changing local status does not issue a provider refund. Local tests mock provider APIs; live payment acceptance requires merchant credentials and provider acceptance testing.

Official integration references: https://developer.esewa.com.np/pages/Epay and https://docs.khalti.com/khalti-epayment/ . The eSewa sandbox status endpoint follows its official documentation (uat.esewa.com.np), separately from the rc-epay form endpoint. If the provider changes its sandbox routing, verify against its current official documentation before acceptance testing.

Portable backup format v19 adds payment_settings and gateway_attempts, retaining encrypted merchant configuration and original payment attempts. Earlier backups import with COD enabled and other methods Off. Update the website origin for future payments after moving hosting; existing attempts retain their original callback configuration and can still be verified from order details. Preserve original-domain redirects while pending gateway payments complete.


Homepage first paint is server-rendered from the current published CMS content and product listing. Browser and server share storefront-markup.js; startup consumes escaped public bootstrap JSON and binds the existing HTML instead of replacing it. No member, session or merchant credentials are included in that bootstrap. Menu navigation keeps the previous visual until the destination data is ready, without persisting private page snapshots.


### Product sharing and direct sales (migration 023, backup v20)

Admin member details → Profile → Product sharing & Direct Sales Commission controls a member's product-link sharing permission (Off by default). Enabled active members see Copy Link, Facebook, WhatsApp and TikTok actions below website products and member product cards. Only published website products can generate publicly accessible links. TikTok uses the device sharing menu when supported, otherwise copies the URL for pasting; this does not automatically post to a TikTok account. Facebook/WhatsApp open their share composer.

Links are random UUIDs bound to one member and one product. Visiting a valid link opens that product and remembers its attribution in the same browser for 30 days, including through checkout registration. The most recently opened valid link wins for that product. Server checkout verifies the link, product and member authorization again; clients cannot supply a commission recipient, rank or amount. A different product in the cart does not inherit that link.

Direct Commission uses the product's existing Rank-Based Direct Commission (fixed amount / unit), multiplied by ordered quantity, using the recipient's active Affiliate Rank at purchase. There is no separate percentage setting. A valid authorized product share takes precedence for its product. Otherwise the buyer's registered Sponsor/referrer receives the normal Direct Commission even when the Sponsor's sharing switch is Off. Admin Add Member with a Sponsor username now also stores the actual referrer relationship. Member registration and checkout registration already store this relationship. No self sales commission/points are awarded; the purchaser still earns configured Purchase Rewards. Share Off stops new share-link attribution; it does not turn off ordinary Sponsor commissions or erase previously placed orders.

Snapshots preserve the recipient, source (Product share / Registration sponsor), rank and per-unit amount at purchase. Historical orders without snapshots do not get new direct commissions. Missing/inactive ranks receive zero direct commission, while configured Sales Rewards can still apply. Direct cash is paid once after Paid + full Dispatched (also recognized in later delivery states); partial dispatch, Pending and Confirmed do not distribute it. Purchase/Sales reward points use the existing product settings and settle at Paid + Delivered. Each product has one sales recipient, so sharing and Sponsor rewards do not double-pay. Cash appears in the member wallet, transaction ledger and Admin member Commission details. Refund/cancellation reverses earned reward points once; previously paid direct cash remains in the immutable ledger and is flagged for review, matching the existing network commission policy.

Backup v20 preserves product_share_links and direct_sales_awards, reconciles fixed-unit awards against their wallet entries and snapshots, and restores sequence IDs. User sharing permission travels with the existing member record. Migration does not enable sharing, modify balances or issue historical payments.


The frontend Products menu opens /products, with the existing category/search/price filters and full View Details dialogs. Both the homepage and Products page are server-rendered on the first response. Testimonials appear in a dedicated homepage section immediately after the journal, with up to four cards; the standalone Testimonials menu is removed. The four initial entries are explicitly labelled sample testimonials. Replace them with verified feedback using Admin → Brand & CMS → Slider & Testimonials (name, role, quote, photo, active/inactive, edit/delete).


Information pages: Footer Terms and Conditions (/terms-and-conditions), Privacy Policy (/privacy-policy) and additional /pages/:slug entries are managed under Admin → Brand & CMS → Terms, Privacy & Pages. Admin can add, edit, publish/unpublish and delete pages; per-page version checks prevent stale overwrites. Inactive/deleted pages return a styled 404 and do not appear in footer or public API payloads. Deleted defaults stay deleted. Content is escaped plain text with blank paragraphs and ## section headings. Initial policy drafts describe the implemented shopping, sponsor/share commission, rewards, storage and payment behavior; the owner should confirm business identity, returns arrangements, retention and applicable legal requirements. References reviewed: https://lawcommission.gov.np/content/12261/the-privacy-act-2075/ and https://lawcommission.gov.np/content/13517/electricity-trade--e-workers--act--2081/ . Existing settings backups include the pages; no schema/backup format change is required.

The About detail page now uses one story-and-slider section, removes an identical repeated summary, retains full CMS text and photo controls, and keeps Mission/Vision and Watch Us below. About and information pages are server-rendered and bound in place on first visit.
