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
