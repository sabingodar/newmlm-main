import {fail} from './validation.mjs';

const recorded = "kind='orders' AND (data ? 'paymentStatus' OR data ? 'paymentType' OR COALESCE(data->>'legacyPayment','') <> '')";
const columns = `id::text, version, created_at, updated_at,
 data->>'legacyOrder' AS reference, split_part(data->>'customer', chr(10), 1) AS customer,
 data->>'recipient' AS recipient, data->>'phone' AS phone,
 data->>'status' AS "orderStatus", data->>'amount' AS amount,
 data->>'paymentType' AS "paymentType", data->>'paymentMethod' AS method,
 COALESCE(NULLIF(data->>'paymentStatus',''), NULLIF(data->>'legacyPayment',''), 'Pending') AS status,
 data->>'paymentReference' AS "paymentReference", data->'paymentApproval' AS approval,
 data->'paymentRejection' AS rejection, data->>'paymentReviewNote' AS note,
 data->>'gatewayVerifiedAt' AS "gatewayVerifiedAt", COALESCE(data->>'legacyReadOnly' = 'true', false) AS historical`;
export function visibleOrderPaymentData(data) {
 const {paymentReviewNote, paymentRejection, paymentApproval, ...visible} = data;
 return visible;
}
const statuses = ['Pending','Paid','Failed','Refunded'];

export function canRejectOrderPayment(order) {
 return !order.legacyReadOnly && !order.gatewayVerifiedAt && !['esewa','khalti'].includes(order.paymentType)
  && !['Cancelled','Refunded','Unknown'].includes(order.status)
  && ([undefined,null,'','Pending'].includes(order.paymentStatus)
    || (order.paymentStatus === 'Paid' && ['Pending','Confirmed'].includes(order.status)
      && !(order.deliveryEvents || []).some(event=>['Partially dispatched','Dispatched','Out for delivery','Delivered'].includes(event.status))));
}

export function createOrderPaymentReview(db) {
 async function list({q='', status='', page='1'} = {}) {
  const number=Number(page), limit=20;
  if(!Number.isSafeInteger(number)||number<1||number>1000000||q.length>200||(status&&!statuses.includes(status)))fail('Invalid payment filter');
  const {rows:[result]}=await db.query(`
   WITH matched AS (
    SELECT ${columns} FROM records WHERE ${recorded}
      AND ($1 = '' OR strpos(lower(concat_ws(' ', id::text, data->>'legacyOrder', data->>'customer',
        data->>'recipient', data->>'phone', data->>'paymentReference')), lower($1)) > 0)
   ), filtered AS (SELECT * FROM matched WHERE $2 = '' OR status = $2),
   page_rows AS (SELECT * FROM filtered ORDER BY updated_at DESC,id::bigint DESC LIMIT $3 OFFSET $4)
   SELECT (SELECT count(*)::int FROM filtered) AS total,
    COALESCE((SELECT jsonb_agg(page_rows ORDER BY updated_at DESC,id::bigint DESC) FROM page_rows),'[]'::jsonb) AS items`,
   [q.trim(),status,limit,(number-1)*limit]);
  return {...result,page:number,limit};
 }
 async function detail(id) {
  const {rows:[payment]}=await db.query(`SELECT ${columns}, data->'deliveryEvents' AS events FROM records WHERE ${recorded} AND id=$1`,[id]);
  if(!payment)fail('Order payment not found',404);
  payment.canReject=canRejectOrderPayment({legacyReadOnly:payment.historical,gatewayVerifiedAt:payment.gatewayVerifiedAt,
   paymentType:payment.paymentType,status:payment.orderStatus,paymentStatus:payment.status,deliveryEvents:payment.events});
  delete payment.events;
  return payment;
 }
 return {list,detail};
}
