import {attributeShares,shareInput} from './product-sharing.mjs';
import {checkoutPayment} from './payments.mjs';
import {readRewardPolicy,redemptionPercent} from './redemption-policy.mjs';
import {snapshotNetworkCommission} from './network-commissions.mjs';
import {inventoryStockSQL,reserveInventoryOrder,journalCentral} from './inventory-core.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {fail} from './validation.mjs';
import {productVisible,productView,lineAmounts} from './catalog.mjs';
import {applyBenefits,commitBenefits} from './benefits.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const money=n=>{const cents=Math.round(Number(n)*100);if(!Number.isSafeInteger(cents)||cents<0||cents>1e12)fail('Amount exceeds the supported limit');return cents;};
const text=(v,max=1000)=>{const s=String(v??'').trim();if(s.length>max)fail('Field is too long');return s;};
const numId=v=>{if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)<1)fail('Invalid record ID');return Number(v);};
export function createCommerce(db){
 async function catalog(channel='retail'){
  const rows=(await db.query(`SELECT id,data,version,${inventoryStockSQL()} FROM records WHERE kind='products' ORDER BY created_at DESC,CASE WHEN data->>'legacyId' ~ '^[0-9]+$' THEN (data->>'legacyId')::bigint ELSE id END DESC,id DESC`)).rows;
  const rewardSettings=channel==='discount'?await readRewardPolicy(db):null;
  return {channel,...(rewardSettings?{rewardSettings}:{}),items:rows.filter(r=>productVisible(r.data,channel)).map(r=>{const p=productView(r,channel);return rewardSettings?{...p,redemptionPercent:rewardSettings.enabled?redemptionPercent(rewardSettings,p):0}:p;}),centers:(await db.query("SELECT id,data->>'name' name,data->>'location' location FROM records WHERE kind='centers' AND data->>'status'='Active' AND COALESCE(data->>'centerType','Dispatch Center')='Dispatch Center' ORDER BY data->>'name'")).rows.map(r=>({...r,id:Number(r.id)}))};
 }
 function cart(input){if(!['retail','quick','discount','wholesale'].includes(input.channel))fail('Choose a product panel');if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Choose between 1 and 100 products');const seen=new Set();return input.items.map(i=>{const productId=numId(i.productId),quantity=Number(i.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>10000)fail('Quantity must be a whole number between 1 and 10,000');if(seen.has(productId))fail('A product can appear only once');seen.add(productId);return {productId,quantity};}).sort((a,b)=>a.productId-b.productId);}
 async function calculate(client,input,lock=false,userId=null){
  const selected=cart(input),products=(await client.query(`SELECT id,data,version${input.inventoryStock||input.fulfillmentMode?','+inventoryStockSQL():''} FROM records WHERE kind='products' AND id=ANY($1::bigint[]) ORDER BY id`+(lock?' FOR UPDATE':''),[selected.map(i=>i.productId)])).rows;
  if(products.length!==selected.length)fail('A selected product no longer exists',409);
  let amount=0,taxableAmount=0,vatAmount=0,businessAmount=0,quantity=0;
  const items=selected.map((selection,index)=>{const row=products[index],p=productView(row,input.channel);if(!productVisible(row.data,input.channel))fail('A selected product is no longer available in this panel',409);if(!Number.isInteger(p.stock)||p.stock<selection.quantity)fail('Insufficient stock for '+p.name,409);if(selection.quantity<p.minimumQuantity)fail(p.name+' requires at least '+p.minimumQuantity+' units');const amounts=lineAmounts(p,selection.quantity);amount+=money(amounts.amount);taxableAmount+=money(amounts.taxableAmount);vatAmount+=money(amounts.vatAmount);businessAmount+=money(amounts.businessAmount);quantity+=selection.quantity;return {productId:p.id,name:p.name,quantity:selection.quantity,categoryId:p.categoryId||null,subcategoryId:p.subcategoryId||null,category:p.category,subcategory:p.subcategory,bvPerUnit:p.bv,bvAmount:money(p.bv)*selection.quantity/100,...amounts,version:p.version,minimumQuantity:p.minimumQuantity,stock:p.stock,stockManaged:p.manageStock,commissionSettings:{dispatchCommissionPerUnit:p.dispatchCommission,rankCommissionsPerUnit:p.rankCommissions,regionalCommissionsPerUnit:p.regionalCommissions},rewardSettings:{enabled:p.rewardsEnabled,salesPointsPerUnit:p.rewardsEnabled?p.salesRewardPoints:0,purchasePointsPerUnit:p.rewardsEnabled?p.purchaseRewardPoints:0}};});
  await attributeShares(client,items,input,userId,lock);
  for(const n of [amount,taxableAmount,vatAmount,businessAmount])if(!Number.isSafeInteger(n)||n>1e12)fail('Order amount exceeds the supported limit');
  const result={channel:input.channel,items,bvAmount:items.reduce((n,l)=>n+money(l.bvAmount),0)/100,amount:amount/100,taxableAmount:taxableAmount/100,vatAmount:vatAmount/100,businessAmount:businessAmount/100,quantity};return {...result,quoteHash:hash(result)};
 }
 const enhanced=input=>input.channel==='discount'||input.useBenefits===true||!!input.couponCode||Number(input.rewardPoints)>0;
 const quote=async(input,userId=null)=>{const base=await calculate(db,input,false,userId);return enhanced(input)?applyBenefits(db,input,base,userId):base;};
 async function checkout(userId,input){
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(String(input.requestKey)))fail('A checkout request reference is required');
  const inventoryMode=input.fulfillmentMode!==undefined;if(inventoryMode&&!['online','center'].includes(input.fulfillmentMode))fail('Choose Online or Dispatch Center');
  const selected=cart(input),address=text(input.address,2000),phone=text(input.phone,40),recipient=text(input.recipient,200),paymentReference=text(input.paymentReference,200),centerId=inventoryMode&&input.fulfillmentMode==='online'?null:numId(input.centerId);
  if(!address||!phone||!recipient)fail('Recipient, phone and delivery/pickup address are required');
  const deliveryOption=input.deliveryOption??'Home delivery';if(!['Home delivery','Dispatch center pickup'].includes(deliveryOption))fail('Choose a delivery option');
  const fingerprint=hash({...(input.deliveryOption===undefined?{}:{deliveryOption}),...(enhanced(input)?{couponCode:String(input.couponCode||'').trim().toUpperCase(),rewardPoints:Number(input.rewardPoints||0)}:{}),...(inventoryMode?{fulfillmentMode:input.fulfillmentMode}:{}),shares:shareInput(input,selected),items:selected,channel:input.channel,centerId,address,phone,recipient,paymentReference,paymentMethod:input.paymentMethod,bankId:input.bankId,quoteHash:input.quoteHash});
  return db.transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock_shared(76241905)');
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['checkout:'+userId+':'+input.requestKey]);
   const previous=(await c.query('SELECT fingerprint,order_id FROM member_checkouts WHERE user_id=$1 AND request_key=$2',[userId,input.requestKey])).rows[0];
   if(previous){if(previous.fingerprint!==fingerprint)fail('This checkout reference was already used for different details',409);return {...await order(userId,previous.order_id,c),replayed:true};}
   const payment=await checkoutPayment(c,input);
   const member=(await c.query("SELECT data FROM records WHERE id=$1 AND kind='users' AND data->>'status'='Active' FOR SHARE",[userId])).rows[0];if(!member)fail('Account is inactive',403);
   const center=centerId?(await c.query("SELECT id,data FROM records WHERE id=$1 AND kind='centers' AND data->>'status'='Active' AND COALESCE(data->>'centerType','Dispatch Center')='Dispatch Center' FOR SHARE",[centerId])).rows[0]:null;if(centerId&&!center)fail('Choose an active dispatch center');if(inventoryMode&&input.fulfillmentMode==='online'&&deliveryOption==='Dispatch center pickup')fail('Choose a dispatch center for pickup');
   let priced=await calculate(c,input,true,userId);if(enhanced(input))priced=await applyBenefits(c,input,priced,userId,true);if(!input.quoteHash||input.quoteHash!==priced.quoteHash)fail('Price, stock or product settings changed. Refresh your order total.',409);
   if(payment.paymentType==='khalti'&&priced.amount>0&&priced.amount<10)fail('Khalti requires a payment of at least Rs. 10. Choose another payment method.');
   for(const line of priced.items)if(!inventoryMode&&line.stockManaged)await c.query("UPDATE records SET data=jsonb_set(data,'{stock}',to_jsonb((data->>'stock')::bigint-$1)),version=version+1,updated_at=now() WHERE id=$2",[line.quantity,line.productId]);
   const referrerId=(await c.query('SELECT referrer_id FROM member_profiles WHERE user_id=$1',[userId])).rows[0]?.referrer_id;
   const data={...(inventoryMode?{inventoryManaged:true,fulfillmentMode:input.fulfillmentMode}:{}),...(enhanced(input)?{subtotal:priced.subtotal,couponCode:priced.couponCode,couponDiscount:priced.couponDiscount,rewardPoints:priced.rewardPoints,pointValue:priced.pointValue,rewardDiscount:priced.rewardDiscount,rewardRedemptionSnapshot:priced.rewardRedemption}:{}),referrerId:referrerId?Number(referrerId):null,customer:member.data.name+'\n'+(member.data.username||member.data.legacyUsername),userId:Number(userId),productId:priced.items[0].productId,quantity:priced.quantity,items:priced.items,bvAmount:priced.bvAmount,amount:priced.amount,taxableAmount:priced.taxableAmount,vatAmount:priced.vatAmount,businessAmount:priced.businessAmount,status:'Pending',deliveryEvents:[{status:'Pending',at:new Date().toISOString()}],paymentStatus:priced.amount===0?'Paid':'Pending',...payment,paymentReference,recipient,phone,address,deliveryOption,dispatchCenterId:centerId,dispatchCenter:center?{name:center.data.name,location:center.data.location}:null,channel:input.channel,legacyOrder:'DLS-'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),createdVia:'Member checkout'};
   const row=(await c.query("INSERT INTO records(kind,data) VALUES('orders',$1) RETURNING id,created_at",[data])).rows[0];
   await snapshotNetworkCommission(c,Number(row.id),Number(userId));
   if(inventoryMode)await reserveInventoryOrder(c,Number(row.id),priced.items,centerId,'member:'+userId);else for(const line of priced.items)if(line.stockManaged)await journalCentral(c,line.productId,-line.quantity,'order:'+row.id+':legacy-reserve','Reserved legacy checkout stock','member:'+userId,{orderId:Number(row.id)});
   if(enhanced(input))await commitBenefits(c,userId,row.id,priced);
   await c.query('INSERT INTO member_checkouts(user_id,request_key,fingerprint,order_id) VALUES($1,$2,$3,$4)',[userId,input.requestKey,fingerprint,row.id]);
   await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Member submitted order','orders',$1,$2)",[row.id,{userId:Number(userId),channel:input.channel,quantity:priced.quantity,paymentStatus:'Pending'}]);
   return {id:Number(row.id),created:row.created_at,...data};
  });
 }
 async function order(userId,orderId,client=db){const r=(await client.query("SELECT r.* FROM records r JOIN records u ON u.id=$1 AND u.kind='users' WHERE r.kind='orders' AND r.id=$2 AND (r.data->>'userId'=$1::text OR (NOT r.data ? 'userId' AND COALESCE(NULLIF(u.data->>'username',''),u.data->>'legacyUsername')=ANY(regexp_split_to_array(replace(COALESCE(r.data->>'customer',''),'@',''),E'\\n'))))",[userId,numId(orderId)])).rows[0];if(!r)fail('Order not found',404);return {id:Number(r.id),created:r.created_at,...r.data};}
 async function track(userId,reference){const ref=String(reference||'').trim().replace(/^#/,'');if(!ref||ref.length>100)fail('Enter your order reference');const row=(await db.query("SELECT r.id FROM records r JOIN records u ON u.id=$1 AND u.kind='users' WHERE r.kind='orders' AND (r.id::text=$2 OR r.data->>'legacyOrder'=$2) AND (r.data->>'userId'=$1::text OR (NOT r.data ? 'userId' AND COALESCE(NULLIF(u.data->>'username',''),u.data->>'legacyUsername')=ANY(regexp_split_to_array(replace(COALESCE(r.data->>'customer',''),'@',''),E'\\n')))) ORDER BY r.id DESC LIMIT 1",[userId,ref])).rows[0];if(!row)fail('Order not found in your account',404);return order(userId,row.id);}
 return {catalog,quote,checkout,order,track};
}
