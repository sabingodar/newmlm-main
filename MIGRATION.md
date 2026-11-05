# Migration verification

Source: user-authorized Dynamic Life Success administrator pages. Snapshot taken on 31 October 2026 (Asia/Kathmandu). No original website records were modified.

| Dataset | Source records | Imported application records |
| --- | ---: | ---: |
| Members | 147 | 147 |
| Active members | 146 | 146 |
| Banned members | 1 | 1 (Inactive) |
| Products | 108 | 108 |
| Orders | 115 | 115 (historical, read-only) |
| Deposits | 142 | 142 (historical, read-only) |
| Withdrawals | 8 | 8 (historical, read-only) |
| BV ranks | 5 | 5 (historical, read-only) |
| Affiliate ranks | 6 | 6 (historical, read-only) |
| CRM leads | 2 | 2 (historical, read-only) |
| Plans | 0 | 0 |
| PINs | 0 | 0 |
| Service centers | 0 | 0 |

Approved deposits total **NPR 876,093.94** and approved withdrawals total **NPR 55,775.00**, matching the source dashboard. Product images: **108 downloaded locally**. Source rows retain original prices, status, references and links inside the authenticated archive.

This is an import of the accessible administration **lists**, not a complete server/database backup. Detailed product fields were captured for 8 products before repeated browser timeouts prevented completing the detail-page pass. Descriptions and additional commission fields for other products remain incomplete. All 108 products have their list price, stock, category, status, source commission amount and image preserved.

Member names, usernames, contact details, balance and country were captured from the lists. Sponsor/tree placement, KYC files, complete member profiles, password hashes and member authentication were not migrated. The source active/banned distinction is retained.

Order summaries retain the original order number, customer, amount, payment text, status and date. Order line items, addresses, attachments and complete detail pages were not extracted. Import never reserves stock for old orders or repeats transactions.

Other source modules (TDS, rewards ledgers, dispatch-center accounting, service tasks, tickets, subscriber lists and full commission/transaction reports) have not been exported. Their absence is not evidence that those datasets are empty.

The reference member (original website ID 147, local ID 109) was subsequently enriched from the explicitly requested detail and dashboard pages: name/address fields, recorded verification, affiliate rank, referrer/placement parent and labelled reward/commission snapshots. Its two historical orders and NPR 8,296 approved deposits/confirmed purchases reconcile with the source view. Personal profile values remain in the private database, outside application source. The new application now provides its own member management and authentication. All 147 existing local members were assigned the user-requested temporary password using unique salted hashes, with mandatory password change on first login; original-site credentials remain unchanged. Opening wallet balances were seeded from the imported list snapshots, not by crediting old deposits again.

Private original raw backup: `data/source-data.json`. The former `data/dynamic.db` remains an untouched SQLite recovery copy. The running application now uses PostgreSQL through `DATABASE_URL`. All **533 application records**, their IDs and every stored payload field were compared with the SQLite source after migration and matched. Approved deposits and withdrawals also matched. A PostgreSQL portable export is at `data/postgresql-portable-backup.json`; use `npm run db:restore -- <file>` against an empty PostgreSQL database to move it. These private files are ignored by Git. Preserve the original site's full database backup separately if full operational migration is required.

Product panel visibility and channel pricing are stored in product records. Source product flags, team list snapshots and dispatch centers were imported once through `scripts/import-commerce-reference.mjs`; repeating that import is blocked to preserve subsequent administrator settings. Member orders store immutable line prices, VAT and dispatch details. Migration 006 creates `member_checkouts`, included in v4 backups for safe request replay after moving hosts. Older backups restore with an empty checkout history. Invitations remain temporary and are regenerated after restore.

Migration 007 adds regional coordinator assignments and structured address indexes. v5 backups preserve these assignments and the member location IDs in records. Older v1–v4 backups restore with an empty assignment table; legacy free-text addresses remain intact and require selection of a structured address before regional reporting. The checked-in Nepal catalogue and its license must move with the source.

Migration 008 adds two-level product categories, maps existing category names, and allows non-record audit events for categories/settings. Portable format v6 includes `product_categories` in parent-first order and repairs its sequence after restore. Gallery/featured images live in the existing media asset table. Existing prices, credentials, balances and stock quantities are preserved. Commission defaults affect new products only; product changes do not issue payouts or points.

Migration 009 adds category image URLs. Portable format v7 includes this column; older category backups receive an empty image URL. Storefront content is in settings, inquiries in CRM leads, and delivery histories/options in order records, all already preserved by the transfer tool. Keep source, PostgreSQL data and media together. No courier credentials or external tracking integration are required for the manual delivery timeline.

Migration 010 adds checkout coupons, independent reward accounts, immutable point ledger and coupon reservations. Existing users, passwords, cash balances and imported point snapshots remain unchanged. Portable v8 exports these tables and checks reward balances against their ledger on restore. Keep private backups secure; they contain personal data and credential hashes.

Migration 014 adds managed administrator profiles, roles, personal permission overrides, role policies and center assignments. Existing administrators remain protected primary Admin accounts; existing centers receive Dispatch Center type without changing balances, orders or members. Portable v12 includes managed administrator credentials and policies, excluding primary owner credentials and all sessions. A fresh destination may contain unchanged bootstrap role defaults; customized policies or existing application data are never overwritten. Restore before opening the installation for normal use.

Administrator reference import (2026-11-04): 13 source accounts were reconciled as 12 new local accounts and one protected primary owner profile update. Eight Dispatch Center Managers were linked by verified source center IDs. Three source Unknown roles became Admin Staff with all access denied for review. Three missing referenced dispatch centers were created Inactive, matching the source. No source passwords were read or changed; local imported accounts require their assigned temporary password to be changed at first sign-in. Member records, cash/point balances, ledgers and existing primary admin credentials were verified unchanged. Source snapshots and import reports remain private under data/. Migration 015 and portable v13 preserve password-change flags and source metadata.

Inventory migration 016 and portable backup v14 add warehouse/center stock, order reservations, transfer receipts, partial shipments, private proof files and immutable movement records. Products retain their existing central available quantities; migration records opening balances without sending or receiving any stock. Online and center checkout explicitly reserve at their selected source. Use Orders → Order Flow for dispatch and courier updates, and Actions → Courier Details for read-only tracking details. Export/restore includes all inventory tables and base64-encoded private proof content.

Migration 017 introduces dispatch-center commission accounts, immutable credit/debit ledgers, reserved withdrawal requests, payout profiles/method settings and private QR/payment proof images. New dispatch transactions credit the physically dispatching center using the order's per-unit commission snapshot (current product rate only for older/manual orders with no snapshot). Historical shipments are not backfilled. Portable backup v15 carries these tables and checks ledger balances and pending/approved reserves during restore; older backups initialize empty commission data and default methods.

Migration 018 / backup v16 adds immutable stock-transfer correction history and an approved-revision link. Pending corrections block receipt. Admin approval adjusts only the difference against central in-transit stock; center stock changes once on receipt. Original transfer lines remain unchanged. The revision foreign key is deferred so complete backup restores can insert the transfer and its edit history within one transaction.

Migration 019 / portable v17 adds immutable one-time rank reward awards linked to wallet ledger credits, recovers preserved source Min Purchase/Earth/Sky thresholds, and indexes completed member orders. Startup does not activate ranks or award historical balances. New orders snapshot product BV; team matching counts all placement descendants in their original Earth/Sky branch. Restore includes awards and verifies each positive award's member, amount, credit direction and unique rank request reference against the wallet ledger. Older backup rank criteria are normalized during restore without inventing historical order BV.

Migration 020 / portable v18 introduces global Step/Affiliate settings (both Off), private order-policy/binary-parent snapshots, immutable distribution receipts and linked cash commission entries. Full dispatch plus Paid is required; partial dispatch cannot pay. Payouts use integer cents and each order settles once. Restore carries the new tables in dependency order with deferred source-Step links and validates ledger credits and receipt totals. Existing completed/historical orders are not backfilled; migration does not modify balances or activate payouts.

Migration 021 restricts reward redemption to Discount Panel and stores category/subcategory sales-percentage caps plus the point-to-rupee conversion in settings.rewardRedemption. The initial default cap is 0%; existing conversion/balances remain intact. No new tables or backup-format bump are required: v18 backups already preserve settings JSON, point ledger/audit entries and order snapshots. Older settings without category fields use safe defaults when read. This changes future redemption eligibility without rewriting existing orders or financial history.


### Checkout fulfillment and payments (migration 022)

Admin → Payment Settings (/admin/payment-settings) controls Cash on Delivery, Bank Transfer/QR, eSewa ePay v2 and Khalti KPG-2. Only enabled, configured methods appear at checkout, including the member panels. COD is the initial default; bank and gateways stay Off until configured. Add active bank accounts with bank name, account holder, account number, branch and uploaded QR (PNG/JPEG/WebP, up to 2 MB). Each order retains its selected bank details even after settings change. Bank references are optional and payment remains Pending until Admin verifies it in Order Flow.

Dispatch Center appears only when Order fulfillment is Dispatch Center. Online / Home Delivery clears the center and leaves assignment to Admin. Server checkout ignores a submitted center for online fulfillment and requires an active center for center fulfillment.

For gateways set the public website origin, Sandbox/Live environment and merchant credentials in Admin. Live requires HTTPS. Set PAYMENT_ENCRYPTION_KEY to a stable random secret of at least 32 characters; if unset, the existing MAIL_ENCRYPTION_KEY is used. Keep that key securely with your private backup and preserve it when moving servers. Secrets are encrypted with AES-256-GCM and never returned to browsers. Public origin is configuration, not the incoming Host header.

Checkout records a Pending order and reserves stock, then opens the selected gateway. eSewa uses a signed form; Khalti is initiated server-side with amounts in paisa. Return URLs never prove payment. Provider status/lookup must match the saved attempt, currency amount and provider transaction before marking Paid. Repeat verification is idempotent. Payment received after cancellation/refund is recorded for Admin review and does not reopen the order or distribute commission. Existing Paid + full Dispatched commission rules and Paid + Delivered reward/rank rules remain in force. Admin cannot manually mark an unverified gateway order Paid.

A pending gateway order can be continued or checked from member Order Details; Admin can check it in Order Flow. Disabling a gateway prevents new payment starts while verification remains available. Do not pay a second time when confirmation is unclear. Khalti initialization with an ambiguous network response is not automatically retried: Admin must reconcile it in the merchant portal before cancelling/reordering. Provider refunds and bank/COD collection are managed by Admin; changing local status does not issue a provider refund. Local tests mock provider APIs; live payment acceptance requires merchant credentials and provider acceptance testing.

Official integration references: https://developer.esewa.com.np/pages/Epay and https://docs.khalti.com/khalti-epayment/ . The eSewa sandbox status endpoint follows its official documentation (uat.esewa.com.np), separately from the rc-epay form endpoint. If the provider changes its sandbox routing, verify against its current official documentation before acceptance testing.

Portable backup format v19 adds payment_settings and gateway_attempts, retaining encrypted merchant configuration and original payment attempts. Earlier backups import with COD enabled and other methods Off. Update the website origin for future payments after moving hosting; existing attempts retain their original callback configuration and can still be verified from order details. Preserve original-domain redirects while pending gateway payments complete.


### Product sharing and direct sales (migration 023, backup v20)

Admin member details → Profile → Product sharing & Direct Sales Commission controls a member's product-link sharing permission (Off by default). Enabled active members see Copy Link, Facebook, WhatsApp and TikTok actions below website products and member product cards. Only published website products can generate publicly accessible links. TikTok uses the device sharing menu when supported, otherwise copies the URL for pasting; this does not automatically post to a TikTok account. Facebook/WhatsApp open their share composer.

Links are random UUIDs bound to one member and one product. Visiting a valid link opens that product and remembers its attribution in the same browser for 30 days, including through checkout registration. The most recently opened valid link wins for that product. Server checkout verifies the link, product and member authorization again; clients cannot supply a commission recipient, rank or amount. A different product in the cart does not inherit that link.

Direct Commission uses the product's existing Rank-Based Direct Commission (fixed amount / unit), multiplied by ordered quantity, using the recipient's active Affiliate Rank at purchase. There is no separate percentage setting. A valid authorized product share takes precedence for its product. Otherwise the buyer's registered Sponsor/referrer receives the normal Direct Commission even when the Sponsor's sharing switch is Off. Admin Add Member with a Sponsor username now also stores the actual referrer relationship. Member registration and checkout registration already store this relationship. No self sales commission/points are awarded; the purchaser still earns configured Purchase Rewards. Share Off stops new share-link attribution; it does not turn off ordinary Sponsor commissions or erase previously placed orders.

Snapshots preserve the recipient, source (Product share / Registration sponsor), rank and per-unit amount at purchase. Historical orders without snapshots do not get new direct commissions. Missing/inactive ranks receive zero direct commission, while configured Sales Rewards can still apply. Direct cash is paid once after Paid + full Dispatched (also recognized in later delivery states); partial dispatch, Pending and Confirmed do not distribute it. Purchase/Sales reward points use the existing product settings and settle at Paid + Delivered. Each product has one sales recipient, so sharing and Sponsor rewards do not double-pay. Cash appears in the member wallet, transaction ledger and Admin member Commission details. Refund/cancellation reverses earned reward points once; previously paid direct cash remains in the immutable ledger and is flagged for review, matching the existing network commission policy.

Backup v20 preserves product_share_links and direct_sales_awards, reconciles fixed-unit awards against their wallet entries and snapshots, and restores sequence IDs. User sharing permission travels with the existing member record. Migration does not enable sharing, modify balances or issue historical payments.


Information pages: Footer Terms and Conditions (/terms-and-conditions), Privacy Policy (/privacy-policy) and additional /pages/:slug entries are managed under Admin → Brand & CMS → Terms, Privacy & Pages. Admin can add, edit, publish/unpublish and delete pages; per-page version checks prevent stale overwrites. Inactive/deleted pages return a styled 404 and do not appear in footer or public API payloads. Deleted defaults stay deleted. Content is escaped plain text with blank paragraphs and ## section headings. Initial policy drafts describe the implemented shopping, sponsor/share commission, rewards, storage and payment behavior; the owner should confirm business identity, returns arrangements, retention and applicable legal requirements. References reviewed: https://lawcommission.gov.np/content/12261/the-privacy-act-2075/ and https://lawcommission.gov.np/content/13517/electricity-trade--e-workers--act--2081/ . Existing settings backups include the pages; no schema/backup format change is required.

The About detail page now uses one story-and-slider section, removes an identical repeated summary, retains full CMS text and photo controls, and keeps Mission/Vision and Watch Us below. About and information pages are server-rendered and bound in place on first visit.


### Administrator password changes (migration 024)

Every admin, including the primary owner, can use Change password in the admin header. Enter the current password and confirm a different new password (6–256 characters). Passwords are salted with scrypt; success clears the login cookie and revokes all sessions for that account. Repeated failed changes are rate limited. The primary owner is marked password_managed_in_app after a successful self-change, so the original ADMIN_PASSWORD environment value does not reset it on redeploy or restart. The deployed password is not changed merely by installing this update.

ADMIN_PASSWORD is still required (at least 12 characters) for bootstrap. Before an owner changes their password in the app, existing environment-based rotation behavior is retained. Once managed in the app, operator recovery needs verified database/server access: set a new ADMIN_PASSWORD securely, set password_managed_in_app=false for the exact primary administrator row, and restart/redeploy to apply it. Do not expose recovery as a public endpoint. Portable backups still exclude primary administrator credentials; a new host uses its own bootstrap credentials. Other administrators cannot overwrite the owner password through Manage Admins. The public footer no longer includes the Administration link; use /admin directly.
