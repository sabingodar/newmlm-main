import {fail, schemas, validate} from './validation.mjs';

const statuses = schemas.leads.status;
const sourceFilter = "(r.kind = 'leads' OR (r.kind = 'orders' AND r.data->>'status' = 'Delivered'))";
const leads = `
 SELECT r.id, r.kind, r.created_at, COALESCE(c.updated_at, r.updated_at) AS updated_at,
   COALESCE(c.version, 0) AS version, r.version AS record_version,
   COALESCE(CASE WHEN r.kind = 'leads' THEN r.data->>'status' ELSE c.status END, 'New') AS status,
   CASE WHEN r.kind = 'leads' THEN r.data->>'name'
        ELSE COALESCE(NULLIF(r.data->>'recipient', ''), NULLIF(u.data->>'name', ''), split_part(r.data->>'customer', chr(10), 1)) END AS name,
   COALESCE(CASE WHEN r.kind = 'leads' THEN r.data->>'email' ELSE u.data->>'email' END, '') AS email,
   COALESCE(NULLIF(r.data->>'phone', ''), u.data->>'phone', '') AS phone,
   CASE WHEN r.kind = 'orders' THEN COALESCE(NULLIF(r.data->>'legacyOrder', ''), '#' || r.id::text) END AS order_ref,
   COALESCE(CASE WHEN r.kind = 'leads' THEN r.data->>'notes' END, '') AS notes,
   COALESCE(c.customer_review, '') AS customer_review,
   c.followup_on::text AS followup_on,
   (c.followup_on <= (now() AT TIME ZONE 'Asia/Kathmandu')::date AND COALESCE(CASE WHEN r.kind = 'leads' THEN r.data->>'status' ELSE c.status END, 'New') <> 'Closed') AS followup_due
 FROM records r
 LEFT JOIN crm_lead_details c ON c.record_id = r.id
 LEFT JOIN records u ON u.kind = 'users' AND r.kind = 'orders'
   AND u.id = CASE WHEN r.data->>'userId' ~ '^[1-9][0-9]{0,17}$' THEN (r.data->>'userId')::bigint END
 WHERE ${sourceFilter}`;

function text(value, label, max) {
 if (typeof value !== 'string' || value.trim().length > max) fail('Invalid ' + label);
 return value.trim();
}

export function createCrmLeads(db) {
 async function list({status = '', q = '', page = '1', due = ''} = {}) {
  const number = Number(page), limit = 20;
  if (!Number.isSafeInteger(number) || number < 1 || number > 10000000) fail('Invalid CRM page');
  if (status && !statuses.includes(status)) fail('Invalid CRM status');
  if (due && due !== '1') fail('Invalid follow-up filter');
  const query = text(q, 'search', 200);
  const {rows:[result]} = await db.query(`
   WITH leads AS (${leads}), matched AS (
    SELECT * FROM leads WHERE strpos(lower(concat_ws(' ', name, email, phone, order_ref)), lower($1)) > 0
     AND (NOT $2::boolean OR followup_due)
   ), counts AS (
    SELECT status, count(*)::int AS total FROM matched GROUP BY status
   ), page_rows AS (
    SELECT id, kind, name, email, phone, order_ref, status, followup_on, followup_due, updated_at
    FROM matched WHERE ($3 = '' OR status = $3)
    ORDER BY followup_due DESC NULLS LAST, updated_at DESC, id DESC LIMIT $4 OFFSET $5
   )
   SELECT COALESCE((SELECT jsonb_object_agg(status, total) FROM counts), '{}'::jsonb) AS counts,
    COALESCE((SELECT jsonb_agg(page_rows ORDER BY followup_due DESC NULLS LAST, updated_at DESC, id DESC) FROM page_rows), '[]'::jsonb) AS items`,
   [query, due === '1', status, limit, (number - 1) * limit]);
  return {...result, page:number, limit, total:status ? result.counts[status] || 0 : Object.values(result.counts).reduce((sum,n) => sum+n, 0)};
 }

 async function detail(id, client = db) {
  const {rows:[lead]} = await client.query(`SELECT * FROM (${leads} AND r.id = $1) lead`, [id]);
  if (!lead) fail('CRM lead not found', 404);
  const {rows:history} = await client.query(`
   SELECT note, author, created_at FROM crm_lead_followups WHERE record_id = $1 ORDER BY id DESC LIMIT 100`, [id]);
  return {...lead, history};
 }

 async function save(id, input, author) {
  const {status, version} = input;
  if (!statuses.includes(status)) fail('Choose a CRM status');
  if (!Number.isInteger(version) || version < 0) fail('Reload the lead before saving', 409);
  const review = text(input.customerReview ?? '', 'customer review', 4000);
  const note = text(input.followupNote ?? '', 'follow-up note', 2000);
  const date = text(input.followupOn ?? '', 'follow-up date', 10);
  if (date) {
   const parsed = new Date(date + 'T00:00:00Z');
   if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== date) fail('Choose a valid follow-up date');
  }
  return db.transaction(async client => {
   const {rows:[source]} = await client.query(`SELECT r.kind, r.version FROM records r WHERE r.id = $1 AND ${sourceFilter} FOR UPDATE`, [id]);
   if (!source) fail('CRM lead not found', 404);
   const {rows:[existing]} = await client.query('SELECT version FROM crm_lead_details WHERE record_id = $1', [id]);
   if ((existing?.version ?? 0) !== version) fail('This lead changed. Reopen it before saving.', 409);
   if (source.kind === 'leads') {
    if (source.version !== input.recordVersion) fail('This lead changed. Reopen it before saving.', 409);
    const lead = validate('leads', input);
    await client.query("UPDATE records SET data = data || $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1", [id, lead]);
   }
   await client.query(`
    INSERT INTO crm_lead_details(record_id, status, customer_review, followup_on) VALUES($1,$2,$3,$4)
    ON CONFLICT(record_id) DO UPDATE SET status = EXCLUDED.status, customer_review = EXCLUDED.customer_review,
     followup_on = EXCLUDED.followup_on, version = crm_lead_details.version + 1, updated_at = now()`,
    [id, status, review, date || null]);
   if (note) await client.query('INSERT INTO crm_lead_followups(record_id, note, author) VALUES($1,$2,$3)', [id, note, author]);
   await client.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Updated CRM lead','leads',$1,$2)", [id, {actor:author, status}]);
   return detail(id, client);
  });
 }

 return {list, detail, save};
}
