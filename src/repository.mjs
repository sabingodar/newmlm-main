import {settleDirectSales} from './product-sharing.mjs';
import {snapshotNetworkCommission,settleNetworkCommission} from './network-commissions.mjs';
import {settleRankOrder,rankRule} from './rank-rewards.mjs';
import {journalCentral,releaseInventoryOrder} from './inventory-core.mjs';
import { fail, validate, schemas } from './validation.mjs';
import {configuredProduct,channelFlags,productView,lineAmounts} from './catalog.mjs';
import { mapLegacy } from './legacy.mjs';
import {locationOf,persistLocation} from './geography.mjs';
import {settleRewards} from './benefits.mjs';
import {validateProductDetails} from './product-config.mjs';

export const record = r => ({...r.data,...(r.kind==='users'?{username:r.data.username||r.data.legacyUsername||'',affiliateRankId:r.affiliate_rank_id==null?null:Number(r.affiliate_rank_id),affiliateRank:r.affiliate_rank_name||'Not assigned'}:{}),...(r.wallet_balance!==undefined?{walletBalance:r.wallet_balance}:{}),id:Number(r.id),created:r.created_at.toISOString(),version:r.version});
export function createRepository(db) {
  async function list(kind, filters={},scope={}) {
    if(!schemas[kind])fail('Unknown module',404);
    const values=[kind];let where='kind=$1',productCenterParameter;
    if(scope.centerId&&['centers','orders','tasks'].includes(kind)){values.push(String(scope.centerId));where+=kind==='centers'?` AND records.id::text=$${values.length}`:` AND data->>'${kind==='orders'?'dispatchCenterId':'centerId'}'=$${values.length}`;}
    if(kind==='products'&&scope.centerId){values.push(scope.centerId);productCenterParameter=values.length;where+=` AND EXISTS (SELECT 1 FROM inventory_transfers t LEFT JOIN inventory_transfer_edits e ON e.id=t.approved_edit_id WHERE t.center_id=$${values.length} AND t.status='Received' AND ((t.approved_edit_id IS NULL AND EXISTS (SELECT 1 FROM inventory_transfer_lines l WHERE l.transfer_id=t.id AND l.product_id=records.id)) OR e.proposed_items @> jsonb_build_array(jsonb_build_object('productId',records.id))))`;}
    if(kind==='users')where+=" AND data->>'deletedAt' IS NULL";
    if(kind==='products'){where+=" AND data->>'deletedAt' IS NULL";const availability=filters.availability||'all';if(!['all','available','out'].includes(availability))fail('Choose a valid stock filter');if(availability!=='all'){const stock=scope.centerId?`COALESCE((SELECT on_hand-reserved FROM inventory_center_stock WHERE center_id=$${productCenterParameter} AND product_id=records.id),0)`:"COALESCE((data->>'stock')::bigint,0)";where+=` AND ${stock}${availability==='available'?'>0':'=0'}`;}}
    if(kind==='centers'&&filters.centerType){if(!['Dispatch Center','Service Center'].includes(filters.centerType))fail('Invalid center type');values.push(filters.centerType);where+=` AND COALESCE(data->>'centerType','Dispatch Center')=$${values.length}`;}
    if(filters.status){values.push(filters.status);where+=` AND data->>'status'=$${values.length}`;}
    if(filters.q){values.push('%'+filters.q.slice(0,200).replace(/[\\%_]/g,'\\$&')+'%');where+=` AND data::text ILIKE $${values.length}`;}
    if(kind==='users'&&filters.affiliateRankId){if(filters.affiliateRankId==='none')where+=" AND NOT EXISTS (SELECT 1 FROM member_profiles p WHERE p.user_id=records.id AND p.affiliate_rank_id IS NOT NULL)";else{const id=Number(filters.affiliateRankId);if(!/^[1-9]\d*$/.test(String(filters.affiliateRankId))||!Number.isSafeInteger(id))fail('Invalid affiliate rank');values.push(id);where+=` AND EXISTS (SELECT 1 FROM member_profiles p WHERE p.user_id=records.id AND p.affiliate_rank_id=$${values.length})`;}}
    const userColumns=kind==='users'?",(SELECT balance FROM member_accounts WHERE user_id=records.id) AS wallet_balance,(SELECT affiliate_rank_id FROM member_profiles WHERE user_id=records.id) AS affiliate_rank_id,(SELECT rank.data->>'name' FROM member_profiles p JOIN records rank ON rank.id=p.affiliate_rank_id AND rank.kind='affiliates' WHERE p.user_id=records.id) AS affiliate_rank_name":'';
    const stockColumns=kind==='products'&&scope.centerId?`,(SELECT on_hand FROM inventory_center_stock WHERE center_id=$${productCenterParameter} AND product_id=records.id) AS center_on_hand,(SELECT reserved FROM inventory_center_stock WHERE center_id=$${productCenterParameter} AND product_id=records.id) AS center_reserved`:'';
    const view=r=>{const result=record(r);return kind==='products'&&scope.centerId?{...result,stockOnHand:Number(r.center_on_hand||0),stockReserved:Number(r.center_reserved||0),stock:Number(r.center_on_hand||0)-Number(r.center_reserved||0),centerStock:true}:result;};
    let order=" ORDER BY COALESCE(data->>'sortDate',created_at::text) DESC,id DESC";
    if(kind==='users'&&filters.sort){const rankValue="(SELECT NULLIF(rank.data->>'minPurchase','')::numeric FROM member_profiles p JOIN records rank ON rank.id=p.affiliate_rank_id AND rank.kind='affiliates' WHERE p.user_id=records.id)";const sorts={latest:order,oldest:" ORDER BY COALESCE(data->>'sortDate',created_at::text) ASC,id ASC",'name-asc':" ORDER BY lower(data->>'name') ASC NULLS LAST,id ASC",'name-desc':" ORDER BY lower(data->>'name') DESC NULLS LAST,id ASC",'rank-asc':' ORDER BY '+rankValue+' ASC NULLS LAST,id ASC','rank-desc':' ORDER BY '+rankValue+' DESC NULLS LAST,id ASC','status-asc':" ORDER BY data->>'status' ASC,lower(data->>'name') ASC,id ASC",'status-desc':" ORDER BY data->>'status' DESC,lower(data->>'name') ASC,id ASC"};if(!Object.hasOwn(sorts,filters.sort))fail('Invalid member sort');order=sorts[filters.sort];}
    if(filters.page!==undefined) {
      const page=Number(filters.page),limit=Number(filters.limit||25);
      if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>100)fail('Invalid pagination');
      const total=Number((await db.query(`SELECT count(*) FROM records WHERE ${where}`,values)).rows[0].count);
      const rows=await db.query(`SELECT records.*${userColumns}${stockColumns} FROM records WHERE ${where}${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,(page-1)*limit]);
      return {items:rows.rows.map(view),page,limit,total};
    }
    return (await db.query(`SELECT records.*${userColumns}${stockColumns} FROM records WHERE ${where}${order}`,values)).rows.map(view);
  }
  async function save(kind,id,input,options={}) {
    if(!schemas[kind])fail('Unknown module',404);
    if(options.centerId&&kind==='orders'&&!id){if(input.dispatchCenterId&&Number(input.dispatchCenterId)!==options.centerId)fail('This order belongs to a different center',403);input={...input,dispatchCenterId:options.centerId};}
    if(options.centerId&&kind==='tasks'&&!id){if(input.centerId&&Number(input.centerId)!==options.centerId)fail('This task belongs to a different center',403);input={...input,centerId:options.centerId};}
    let validated=options.dispatchOnly?null:validate(kind,input);
    return db.transaction(async client=>{
      const centralEffects=[];
      if(['orders','ranks','users'].includes(kind))await client.query('SELECT pg_advisory_xact_lock(76241905)');
      if(['products','users'].includes(kind)&&id){const deleted=(await client.query("SELECT data->>'deletedAt' AS deleted FROM records WHERE id=$1 AND kind=$2 FOR UPDATE",[id,kind])).rows[0];if(deleted?.deleted)fail('Record was deleted',404);}
      const existing=id?(await client.query('SELECT * FROM records WHERE kind=$1 AND id=$2 FOR UPDATE',[kind,id])).rows[0]:null;
      if(id&&!existing)fail('Record not found',404);
      if(options.centerId&&['centers','orders','tasks'].includes(kind)&&existing){const center=kind==='centers'?Number(existing.id):Number(existing.data[kind==='orders'?'dispatchCenterId':'centerId']);if(center!==options.centerId)fail('This record belongs to a different center',403);}
      if(options.dispatchOnly){
        if(kind!=='orders'||!existing)fail('Dispatch access cannot create orders',403);
        const allowed=['version','status','deliveryOption','courier','trackingNumber','trackingUrl','estimatedDelivery','deliveryNotes'];
        if(Object.keys(input).some(k=>!allowed.includes(k)))fail('Dispatch access can update delivery fields only',403);
        if(!Number.isInteger(input.version))fail('Reload the order before updating');
        if(input.status!==undefined&&input.status!==existing.data.status&&!['Confirmed','Dispatched','Out for delivery','Delivered'].includes(input.status))fail('Dispatch access cannot cancel or reopen orders',403);
        if(existing.data.status==='Delivered'&&input.status&&input.status!=='Delivered')fail('Delivered orders cannot be reopened',409);
        if(existing.data.status==='Cancelled')fail('Cancelled orders cannot be dispatched',409);
        validated=validate('orders',{...existing.data,...input});
      }
      if(existing?.data.legacyReadOnly&&kind!=='ranks')fail('Historical record is preserved read-only; see Source data archive.');
      if(input.version!==undefined&&existing&&Number(input.version)!==existing.version)fail('Record changed. Refresh and try again.',409);
      const old=existing?.data,data={...(kind==='products'?configuredProduct(old||{}):old),...validated};
      const linkedCenter=kind==='tasks'?data.centerId:kind==='orders'?data.dispatchCenterId:null;
      if(options.centerId&&['orders','tasks'].includes(kind)&&Number(linkedCenter)!==options.centerId)fail('This record belongs to a different center',403);
      if(linkedCenter&&!(await client.query("SELECT id FROM records WHERE id=$1 AND kind='centers' AND data->>'status'='Active' AND COALESCE(data->>'centerType','Dispatch Center')=$2 FOR SHARE",[linkedCenter,kind==='tasks'?'Service Center':'Dispatch Center'])).rowCount)fail('Choose an active center of the correct type');
      if(kind==='centers'){data.centerType??='Dispatch Center';if(data.code){data.code=String(data.code).trim().toUpperCase();if(!/^[A-Z0-9_-]{2,40}$/.test(data.code))fail('Use a center code with 2–40 letters, numbers, hyphens or underscores');await client.query('SELECT pg_advisory_xact_lock(76241906)');if((await client.query("SELECT id FROM records WHERE kind='centers' AND lower(data->>'code')=lower($1) AND id<>$2",[data.code,id||0])).rowCount)fail('This center code already exists',409);}}
      if(kind==='ranks'){Object.assign(data,rankRule(data),{legacyReadOnly:false});for(const key of ['minPurchase','earthBv','skyBv','reward'])if(Math.abs(data[key]*100-Math.round(data[key]*100))>.00001)fail('Rank amounts and BV must have at most two decimals');}
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
       if(old?.inventoryManaged&&old.status!=='Cancelled'&&data.status==='Cancelled')await releaseInventoryOrder(client,Number(id),options.actor||'admin');
       if(old?.inventoryManaged&&['Dispatched','Out for delivery','Delivered'].includes(data.status)){const remaining=Number((await client.query('SELECT COALESCE(sum(remaining),0) AS quantity FROM inventory_order_allocations WHERE order_id=$1',[id])).rows[0].quantity);if(remaining>0)fail('Dispatch all remaining quantities through Order Flow before selecting this status',409);}
       if(data.status==='Partially dispatched'&&old?.status!==data.status)fail('Partial dispatch status is recorded through Order Flow');
       if(data.deliveryOption&&!['Home delivery','Dispatch center pickup'].includes(data.deliveryOption))fail('Choose a valid delivery option');
       for(const [key,max] of [['courier',100],['trackingNumber',100],['trackingUrl',1000],['deliveryNotes',1000]])if(String(data[key]||'').length>max)fail('Invalid delivery details');
       if(data.trackingUrl){let url;try{url=new URL(data.trackingUrl);}catch{fail('Enter a valid courier tracking URL');}if(url.protocol!=='https:'||url.username||url.password)fail('Courier tracking URL must use HTTPS');}
       if(data.estimatedDelivery){const date=new Date(data.estimatedDelivery+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(data.estimatedDelivery)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.estimatedDelivery)fail('Enter a valid estimated delivery date');}
       data.deliveryEvents=old?.deliveryEvents||[];if(old?.inventoryManaged)data.deliveryEvents=data.deliveryEvents.slice(-198);
       if(!old||old.status!==data.status)data.deliveryEvents=[...data.deliveryEvents,{status:data.status,at:new Date().toISOString()}];
       if(data.deliveryEvents.length>200)fail('This order has too many status changes');
       if(!old)data.paymentStatus??='Pending';
       if(old?.createdVia==='Member checkout'){
        if(['esewa','khalti'].includes(old.paymentType)&&old.paymentStatus!=='Paid'&&data.paymentStatus==='Paid')fail('Gateway payments must be verified through the payment provider',409);
        for(const k of ['paymentMethod','paymentType','paymentBank','paymentEnvironment','gatewayVerifiedAt'])if(old[k]!==undefined)data[k]=old[k];
        if(old.paymentStatus==='Refunded'&&data.paymentStatus!=='Refunded')fail('Refunded orders cannot be reopened');
        if(Number(data.userId)!==Number(old.userId))fail('Checkout order owner cannot change');
        if(data.productId!==old.productId||data.quantity!==old.quantity)fail('Order items cannot change after submission');if(old.status==='Cancelled'&&data.status!=='Cancelled')fail('Cancelled order cannot be reopened');
        if(!old.inventoryManaged&&old.status!=='Cancelled'&&data.status==='Cancelled'){const lines=old.items.filter(l=>l.stockManaged!==false).sort((a,b)=>a.productId-b.productId);const products=(await client.query("SELECT * FROM records WHERE kind='products' AND id=ANY($1::bigint[]) ORDER BY id FOR UPDATE",[lines.map(l=>l.productId)])).rows;if(products.length!==lines.length)fail('An order product is missing');for(const line of lines){await client.query("UPDATE records SET data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::bigint+$1)),version=version+1,updated_at=now() WHERE id=$2",[line.quantity,line.productId]);centralEffects.push({productId:line.productId,delta:line.quantity,type:'cancel'});}}
        data.amount=old.amount;
       }else{
        if(data.status==='Unknown')fail('Choose a valid status for a new order');
        if(!Number.isInteger(data.quantity))fail('Quantity must be a whole number');
        const product=(await client.query("SELECT * FROM records WHERE kind='products' AND id=$1 FOR UPDATE",[data.productId])).rows[0];
        if(!product)fail('Product not found');
        if(old&&(old.productId!==data.productId||old.quantity!==data.quantity))fail('Product and quantity cannot change after creating an order');
        if(old?.status==='Cancelled'&&data.status!=='Cancelled')fail('Cancelled order cannot be reopened');
        const reserve=!old&&data.status!=='Cancelled';
        const release=old&&!old.inventoryManaged&&old.status!=='Cancelled'&&data.status==='Cancelled';
        const p=product.data,tracked=old?.stockManaged??(p.manageStock!==false);if(!old)data.stockManaged=tracked;
        if(reserve&&(p.status!=='Active'||tracked&&p.stock<data.quantity))fail('Product unavailable or insufficient stock');
        if((reserve||release)&&tracked){centralEffects.push({productId:data.productId,delta:release?data.quantity:-data.quantity,type:release?'cancel':'reserve'});p.stock+=release?data.quantity:-data.quantity;await client.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2',[p,product.id]);}
        if(old)data.amount=old.amount;else Object.assign(data,lineAmounts(productView(product,'retail'),data.quantity),{bvAmount:Math.round(Number(p.bv||0)*100)*data.quantity/100});
        if(!Number.isSafeInteger(Math.round(data.amount*100))||data.amount>1e10)fail('Order amount exceeds the supported limit');
      }
       }
      const result=id?
        await client.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2 RETURNING *',[data,id]):
        await client.query('INSERT INTO records(kind,data) VALUES($1,$2) RETURNING *',[kind,data]);
      const saved=result.rows[0];
      for(const effect of centralEffects)await journalCentral(client,effect.productId,effect.delta,'order:'+saved.id+':legacy-'+effect.type,effect.type==='cancel'?'Returned cancelled legacy order stock':'Reserved manual order stock',options.actor||'admin',{orderId:Number(saved.id)});
      if(kind==='products')await journalCentral(client,Number(saved.id),old?Number(data.stock)-Number(old.stock):0,'product:'+saved.id+':version:'+saved.version,'Adjusted central stock in product editor',options.actor||'admin');
      if(kind==='orders'&&!old)await snapshotNetworkCommission(client,Number(saved.id),data.userId);
      if(kind==='orders'){await settleNetworkCommission(client,Number(saved.id),data,options.actor||'system');await settleDirectSales(client,Number(saved.id),data,options.actor||'system');await settleRewards(client,saved.id,data);await settleRankOrder(client,data,options.actor||'system');}
      if(kind==='users'&&(!old||input.sponsor!==undefined&&data.sponsor!==old.sponsor)){const sponsor=String(data.sponsor||'').trim();let referrer=null;if(sponsor){const matches=(await client.query("SELECT id FROM records WHERE kind='users' AND data->>'status'='Active' AND data->>'deletedAt' IS NULL AND lower(COALESCE(NULLIF(data->>'username',''),data->>'legacyUsername'))=lower($1)",[sponsor])).rows;if(matches.length!==1||Number(matches[0].id)===Number(saved.id))fail('Choose a valid sponsor username');referrer=matches[0].id;const cycle=(await client.query('WITH RECURSIVE chain AS (SELECT user_id,referrer_id FROM member_profiles WHERE user_id=$1 UNION SELECT p.user_id,p.referrer_id FROM member_profiles p JOIN chain c ON p.user_id=c.referrer_id) SELECT 1 FROM chain WHERE user_id=$2',[referrer,saved.id])).rowCount;if(cycle)fail('This sponsor relationship would create a cycle');}await client.query('UPDATE member_profiles SET referrer_id=$2 WHERE user_id=$1',[saved.id,referrer]);}
      if(kind==='users'&&input.location!==undefined)await persistLocation(client,saved.id,data.location);
      if(kind==='users'&&old&&old.email!==data.email)await client.query('UPDATE member_profiles SET email_verified=NULL WHERE user_id=$1',[saved.id]);
      if(kind==='users'&&old&&old.phone!==data.phone)await client.query('UPDATE member_profiles SET mobile_verified=NULL WHERE user_id=$1',[saved.id]);
      await client.query('INSERT INTO audit(action,kind,record_id,details) VALUES($1,$2,$3,$4)',[id?'Updated':'Created',kind,saved.id,{...(options.actor?{actor:options.actor}:{})}]);
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
  async function removeProduct(id,input,actor){if(actor.centerId||['Dispatch Center Manager','Service Center Manager'].includes(actor.role))fail('Only product administrators can delete products',403);return db.transaction(async c=>{const row=(await c.query("SELECT * FROM records WHERE kind='products' AND id=$1 FOR UPDATE",[id])).rows[0];if(!row)fail('Product not found',404);if(row.data.deletedAt)return {deleted:true,replayed:true};if(Number(input.version)!==row.version)fail('Product changed. Refresh before deleting.',409);const data={...row.data,status:'Inactive',showOnWebsite:false,showInDiscount:false,showInWholesale:false,showInQuickOrder:false,deletedAt:new Date().toISOString(),deletedBy:actor.username};await c.query('UPDATE records SET data=$2,version=version+1,updated_at=now() WHERE id=$1',[id,data]);await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Deleted product','products',$1,$2)",[id,{actor:actor.username,name:row.data.name}]);return {deleted:true};});}
  async function visibility(id,input){if(!Object.values(channelFlags).includes(input.field)||typeof input.enabled!=='boolean')fail('Invalid visibility setting');return db.transaction(async c=>{const r=(await c.query("SELECT * FROM records WHERE kind='products' AND id=$1 FOR UPDATE",[id])).rows[0];if(!r||r.data.deletedAt)fail('Product not found',404);if(input.version!==r.version)fail('Product changed. Refresh and try again.',409);const data={...configuredProduct(r.data),[input.field]:input.enabled};const saved=(await c.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2 RETURNING *',[data,id])).rows[0];await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Changed product visibility','products',$1,$2)",[id,{field:input.field,enabled:input.enabled}]);return record(saved);});}
  return {list,save,importLegacy,stage,dashboard,visibility,removeProduct};
}
