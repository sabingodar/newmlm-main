import {createHash} from 'node:crypto';
import {fail} from './validation.mjs';

const types = {
 'application/pdf': b => b.subarray(0,5).toString() === '%PDF-',
 'image/jpeg': b => b[0] === 255 && b[1] === 216 && b[2] === 255,
 'image/png': b => b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
 'image/webp': b => b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP'
};
export function decodePaymentSlip(input) {
 if(!input||!Object.hasOwn(types,input.type)||typeof input.data!=='string'||input.data.length>2796204||/[^A-Za-z0-9+/=]/.test(input.data))fail('Choose a PDF, JPG, PNG or WebP payment slip up to 2 MB');
 const content=Buffer.from(input.data,'base64');
 if(!content.length||content.length>2097152||content.toString('base64')!==input.data||!types[input.type](content))fail('Invalid payment slip file');
 const name=String(input.name||'Payment slip').split(/[\\/]/).at(-1).replace(/[\x00-\x1f\x7f]/g,'').slice(0,100)||'Payment slip';
 return {name,type:input.type,content,digest:createHash('sha256').update(content).digest('hex')};
}
export async function savePaymentSlip(client,id,slip) {
 await client.query(`INSERT INTO order_payment_slips(order_id,name,mime_type,content) VALUES($1,$2,$3,$4)
  ON CONFLICT(order_id) DO UPDATE SET name=EXCLUDED.name,mime_type=EXCLUDED.mime_type,content=EXCLUDED.content`,
  [id,slip.name,slip.type,slip.content]);
}
export async function replaceMemberPaymentSlip(db,user,id,input) {
 const slip=decodePaymentSlip(input);
 return db.transaction(async c=>{
  const {rows:[row]}=await c.query("SELECT data FROM records WHERE kind='orders' AND id=$1 AND data->>'userId'=$2 FOR UPDATE",[id,String(user)]);
  if(!row)fail('Order not found',404);
  const o=row.data;
  if(o.paymentType!=='bank'||!['Pending','Failed'].includes(o.paymentStatus)||['Cancelled','Refunded'].includes(o.status))fail('This order cannot receive a payment slip',409);
  await savePaymentSlip(c,id,slip);
  await c.query("UPDATE records SET data=data || '{\"hasPaymentSlip\":true}'::jsonb, version=version+1,updated_at=now() WHERE id=$1",[id]);
  await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Uploaded order payment slip','orders',$1,$2)",[id,{userId:Number(user)}]);
  return {hasPaymentSlip:true};
 });
}

export async function sendPaymentSlip(db,res,id,user) {
 const {rows:[file]}=await db.query(`SELECT s.name,s.mime_type,s.content FROM order_payment_slips s JOIN records r ON r.id=s.order_id
  WHERE r.kind='orders' AND r.id=$1 AND ($2::text IS NULL OR r.data->>'userId'=$2)`,[id,user===undefined?null:String(user)]);
 if(!file)fail('Payment slip not found',404);
 const name=encodeURIComponent(file.name.toWellFormed()).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
 res.writeHead(200,{'Content-Type':file.mime_type,'Content-Length':file.content.length,
  'Cache-Control':'private, no-store','Content-Disposition':(file.mime_type==='application/pdf'?'attachment':'inline')+"; filename*=UTF-8''"+name});
 return res.end(file.content);
}
