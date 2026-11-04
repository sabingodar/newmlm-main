import { fail, validate, schemas } from './validation.mjs';
import {configuredProduct,channelFlags,productView,lineAmounts} from './catalog.mjs';
import { mapLegacy } from './legacy.mjs';
import {locationOf,persistLocation} from './geography.mjs';
import {settleRewards} from './benefits.mjs';
import {validateProductDetails} from './product-config.mjs';

export const record = r => ({...r.data,...(r.kind==='users'?{username:r.data.username||r.data.legacyUsername||''}:{}),...(r.wallet_balance!==undefined?{walletBalance:r.wallet_balance}:{}),id:Number(r.id),created:r.created_at.toISOString(),version:r.version});
export function createRepository(db) {
  async function list(kind, filters={}) {
    if(!schemas[kind])fail('Unknown module',404);
    const values=[kind];let where='kind=$1';
    if(filters.status){values.push(filters.status);where+=` AND data->>'status'=$${values.length}`;}
    if(filters.q){values.push('%'+filters.q.slice(0,200).replace(/[\\%_]/g,'\\$&')+'%');where+=` AND data::text ILIKE $${values.length}`;}
    const order=" ORDER BY COALESCE(data->>'sortDate',created_at::text) DESC,id DESC";
    if(filters.page!==undefined) {
      const page=Number(filters.page),limit=Number(filters.limit||25);
      if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>100)fail('Invalid pagination');
      const total=Number((await db.query(`SELECT count(*) FROM records WHERE ${where}`,values)).rows[0].count);
      const rows=await db.query(`SELECT records.*${kind==='users'?',(SELECT balance FROM member_accounts WHERE user_id=records.id) AS wallet_balance':''} FROM records WHERE ${where}${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,(page-1)*limit]);
      return {items:rows.rows.map(record),page,limit,total};
    }
    return (await db.query(`SELECT records.*${kind==='users'?',(SELECT balance FROM member_accounts WHERE user_id=records.id) AS wallet_balance':''} FROM records WHERE ${where}${order}`,values)).rows.map(record);
  }
  async function save(kind,id,input) {
    if(!schemas[kind])fail('Unknown module',404);
    const validated=validate(kind,input);
    return db.transaction(async client=>{
      const existing=id?(await client.query('SELECT * FROM records WHERE kind=$1 AND id=$2 FOR UPDATE',[kind,id])).rows[0]:null;
      if(id&&!existing)fail('Record not found',404);
      if(existing?.data.legacyReadOnly)fail('Historical record is preserved read-only; see Source data archive.');
      if(input.version!==undefined&&existing&&Number(input.version)!==existing.version)fail('Record changed. Refresh and try again.',409);
      const old=existing?.data,data={...(kind==='products'?configuredProduct(old||{}):old),...validated};
      if(kind==='products')await validateProductDetails(client,data,input,{isNew:!old});
      if(kind==='products'){if(data.vatRate===null||data.vatRate<0||data.vatRate>100)fail('VAT must be between 0 and 100 percent');if(!Number.isInteger(data.wholesaleMinQty)||data.wholesaleMinQty<1||data.wholesaleMinQty>10000)fail('Wholesale minimum quantity must be 1–10,000');for(const k of ['price','originalPrice','discountPrice','wholesalePrice','businessValue','vatRate'])if(data[k]!=null&&Math.abs(Number(data[k])*100-Math.round(Number(data[k])*100))>0.00001)fail('Prices must have at most two decimal places');if(data.imageUrl&&!/^\/(?:media\/\d+\.img|assets\/[a-f0-9-]{36})$/.test(data.imageUrl))fail('Use an uploaded product image');}
      if(kind==='users'){
        if(input.location!==undefined)data.location=locationOf(input.location);
        if(data.username&&!/^[a-zA-Z0-9_.-]{3,60}$/.test(data.username))fail('Invalid username');
        if(old&&(old.username||old.legacyUsername)&&(old.username||old.legacyUsername)!==(data.username||data.legacyUsername||''))fail('Use member details; existing usernames cannot be changed');
        if(old?.status==='Inactive'&&data.status==='Active')fail('Unban this member through member details with an audit entry');
        if(old&&data.status!==old.status)fail('Change member status through member details');
      }
      if(input.userId!==undefined&&['orders','deposits','withdrawals'].includes(kind)){if(!Number.isSafeInteger(Number(input.userId))||Number(input.userId)<1||!(await client.query("SELECT id FROM records WHERE kind='users' AND id=$1",[input.userId])).rowCount)fail('Invalid member association');data.userId=Number(input.userId);}
      if(['deposits','withdrawals'].includes(kind)&&old&&!['Initiated','Pending'].includes(old.status))fail('Finalized record cannot be changed');
      if(kind==='orders') {
       if(data.deliveryOption&&!['Home delivery','Dispatch center pickup'].includes(data.deliveryOption))fail('Choose a valid delivery option');
       for(const [key,max] of [['courier',100],['trackingNumber',100],['trackingUrl',1000],['deliveryNotes',1000]])if(String(data[key]||'').length>max)fail('Invalid delivery details');
       if(data.trackingUrl){let url;try{url=new URL(data.trackingUrl);}catch{fail('Enter a valid courier tracking URL');}if(url.protocol!=='https:'||url.username||url.password)fail('Courier tracking URL must use HTTPS');}
       if(data.estimatedDelivery){const date=new Date(data.estimatedDelivery+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(data.estimatedDelivery)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.estimatedDelivery)fail('Enter a valid estimated delivery date');}
       data.deliveryEvents=old?.deliveryEvents||[];
       if(!old||old.status!==data.status)data.deliveryEvents=[...data.deliveryEvents,{status:data.status,at:new Date().toISOString()}];
       if(data.deliveryEvents.length>200)fail('This order has too many status changes');
       if(!old)data.paymentStatus??='Pending';
       if(old?.createdVia==='Member checkout'){
        if(old.paymentStatus==='Refunded'&&data.paymentStatus!=='Refunded')fail('Refunded orders cannot be reopened');
        if(Number(data.userId)!==Number(old.userId))fail('Checkout order owner cannot change');
        if(data.productId!==old.productId||data.quantity!==old.quantity)fail('Order items cannot change after submission');if(old.status==='Cancelled'&&data.status!=='Cancelled')fail('Cancelled order cannot be reopened');
        if(old.status!=='Cancelled'&&data.status==='Cancelled'){const lines=old.items.filter(l=>l.stockManaged!==false).sort((a,b)=>a.productId-b.productId);const products=(await client.query("SELECT * FROM records WHERE kind='products' AND id=ANY($1::bigint[]) ORDER BY id FOR UPDATE",[lines.map(l=>l.productId)])).rows;if(products.length!==lines.length)fail('An order product is missing');for(const line of lines)await client.query("UPDATE records SET data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::bigint+$1)),version=version+1,updated_at=now() WHERE id=$2",[line.quantity,line.productId]);}
        data.amount=old.amount;
       }else{
        if(data.status==='Unknown')fail('Choose a valid status for a new order');
        if(!Number.isInteger(data.quantity))fail('Quantity must be a whole number');
        const product=(await client.query("SELECT * FROM records WHERE kind='products' AND id=$1 FOR UPDATE",[data.productId])).rows[0];
        if(!product)fail('Product not found');
        if(old&&(old.productId!==data.productId||old.quantity!==data.quantity))fail('Product and quantity cannot change after creating an order');
        if(old?.status==='Cancelled'&&data.status!=='Cancelled')fail('Cancelled order cannot be reopened');
        const reserve=!old&&data.status!=='Cancelled';
        const release=old&&old.status!=='Cancelled'&&data.status==='Cancelled';
        const p=product.data,tracked=old?.stockManaged??(p.manageStock!==false);if(!old)data.stockManaged=tracked;
        if(reserve&&(p.status!=='Active'||tracked&&p.stock<data.quantity))fail('Product unavailable or insufficient stock');
        if((reserve||release)&&tracked){p.stock+=release?data.quantity:-data.quantity;await client.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2',[p,product.id]);}
        if(old)data.amount=old.amount;else Object.assign(data,lineAmounts(productView(product,'retail'),data.quantity));
        if(!Number.isSafeInteger(Math.round(data.amount*100))||data.amount>1e10)fail('Order amount exceeds the supported limit');
      }
       }
      const result=id?
        await client.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2 RETURNING *',[data,id]):
        await client.query('INSERT INTO records(kind,data) VALUES($1,$2) RETURNING *',[kind,data]);
      const saved=result.rows[0];
      if(kind==='orders')await settleRewards(client,saved.id,data);
      if(kind==='users'&&input.location!==undefined)await persistLocation(client,saved.id,data.location);
      if(kind==='users'&&old&&old.email!==data.email)await client.query('UPDATE member_profiles SET email_verified=NULL WHERE user_id=$1',[saved.id]);
      if(kind==='users'&&old&&old.phone!==data.phone)await client.query('UPDATE member_profiles SET mobile_verified=NULL WHERE user_id=$1',[saved.id]);
      await client.query('INSERT INTO audit(action,kind,record_id) VALUES($1,$2,$3)',[id?'Updated':'Created',kind,saved.id]);
      return record(saved);
    });
  }
  async function importLegacy(data) {
    if(!data||typeof data!=='object'||Array.isArray(data))fail('Invalid source data');
    for(const rows of Object.values(data))if(!Array.isArray(rows))fail('Source datasets must be arrays');
    return db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(76241902)');
      if((await client.query("SELECT name FROM data_imports WHERE name='legacy-admin'")).rowCount)fail('Source data has already been imported.');
      const mapped=mapLegacy(data);
      for(const [kind,rows] of Object.entries(data))await client.query('INSERT INTO archive(kind,data) VALUES($1,$2)',[kind,JSON.stringify(rows)]);
      for(const r of mapped)await client.query('INSERT INTO records(kind,data) VALUES($1,$2)',[r.kind,r.data]);
      await client.query("INSERT INTO data_imports(name) VALUES('legacy-admin')");
      return {ok:true,counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length]))};
    });
  }
  async function stage(incoming) {
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))fail('Invalid staging data');
    return db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(76241903)');
      for(const [kind,rows] of Object.entries(incoming)) {
        if(!Array.isArray(rows)||kind.length>100)fail('Invalid staging dataset');
        const data=(await client.query('SELECT data FROM import_staging WHERE kind=$1',[kind])).rows[0]?.data||[];
        const keys=new Set(data.map(r=>r.url||JSON.stringify(r)));
        for(const r of rows){const key=r.url||JSON.stringify(r);if(!keys.has(key)){keys.add(key);data.push(r);}}
        await client.query('INSERT INTO import_staging(kind,data) VALUES($1,$2) ON CONFLICT(kind) DO UPDATE SET data=EXCLUDED.data',[kind,JSON.stringify(data)]);
      }
      const counts=Object.fromEntries((await client.query('SELECT kind,jsonb_array_length(data) AS count FROM import_staging')).rows.map(r=>[r.kind,r.count]));
      return {saved:true,counts};
    });
  }
  async function dashboard() {
    const rows=(await db.query(`SELECT kind,count(*)::integer AS total,
      count(*) FILTER(WHERE data->>'status'='Pending')::integer AS pending,
      count(*) FILTER(WHERE kind='tickets' AND data->>'status'<>'Resolved')::integer AS open,
      count(*) FILTER(WHERE kind='products' AND data->>'manageStock' IS DISTINCT FROM 'false' AND (data->>'stock')::numeric<6)::integer AS low,
      COALESCE(sum(CASE WHEN kind IN ('deposits','withdrawals') AND data->>'status'='Approved' THEN (data->>'amount')::numeric ELSE 0 END),0) AS approved
      FROM records GROUP BY kind`)).rows;
    const byKind=Object.fromEntries(rows.map(r=>[r.kind,r]));
    const counts=Object.fromEntries(Object.keys(schemas).map(k=>[k,byKind[k]?.total||0]));
    const recentOrders=(await db.query("SELECT * FROM records WHERE kind='orders' ORDER BY COALESCE(data->>'sortDate',created_at::text) DESC,id DESC LIMIT 6")).rows.map(record);
    return {counts,lowStock:byKind.products?.low||0,pendingOrders:byKind.orders?.pending||0,openTickets:byKind.tickets?.open||0,
      pendingDeposits:byKind.deposits?.pending||0,pendingWithdrawals:byKind.withdrawals?.pending||0,
      approvedDeposits:Number(byKind.deposits?.approved||0),approvedWithdrawals:Number(byKind.withdrawals?.approved||0),recentOrders};
  }
  async function visibility(id,input){if(!Object.values(channelFlags).includes(input.field)||typeof input.enabled!=='boolean')fail('Invalid visibility setting');return db.transaction(async c=>{const r=(await c.query("SELECT * FROM records WHERE kind='products' AND id=$1 FOR UPDATE",[id])).rows[0];if(!r)fail('Product not found',404);if(input.version!==r.version)fail('Product changed. Refresh and try again.',409);const data={...configuredProduct(r.data),[input.field]:input.enabled};const saved=(await c.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2 RETURNING *',[data,id])).rows[0];await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Changed product visibility','products',$1,$2)",[id,{field:input.field,enabled:input.enabled}]);return record(saved);});}
  return {list,save,importLegacy,stage,dashboard,visibility};
}
