import {createHash} from 'node:crypto';
import {fail} from './validation.mjs';
export const rewardsDefaults={pointValue:1,enabled:true};
const number=(value,label,max=1e10)=>{const n=Number(value);if(value==null||value===''||!Number.isFinite(n)||n<0||n>max||Math.abs(n*100-Math.round(n*100))>.00001)fail('Invalid '+label);return n;};
const cents=v=>Math.round(Number(v)*100);
export function validateRewards(input){if(!input||typeof input.enabled!=='boolean')fail('Invalid reward settings');const pointValue=number(input.pointValue,'point value',1000);if(pointValue<.01)fail('Point value must be at least Rs. 0.01');return {enabled:input.enabled,pointValue};}
export async function rewardBalance(c,userId,lock=false){if(!userId)return 0;if(lock)await c.query('INSERT INTO member_reward_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);return Number((await c.query('SELECT balance FROM member_reward_accounts WHERE user_id=$1'+(lock?' FOR UPDATE':''),[userId])).rows[0]?.balance||0);}
async function entry(c,userId,amount,reference,reason,orderId=null){
 if(!amount)return;number(Math.abs(amount),'reward points');await rewardBalance(c,userId,true);
 const previous=(await c.query('SELECT * FROM member_reward_ledger WHERE user_id=$1 AND reference=$2',[userId,reference])).rows[0];if(previous){if(Number(previous.amount)!==amount||previous.reason!==reason)fail('Reward reference already used',409);return;}
 const balance=(await c.query('UPDATE member_reward_accounts SET balance=balance+$1 WHERE user_id=$2 RETURNING balance',[amount,userId])).rows[0].balance;
 await c.query('INSERT INTO member_reward_ledger(user_id,amount,balance_after,reference,reason,order_id) VALUES($1,$2,$3,$4,$5,$6)',[userId,amount,balance,reference,reason,orderId]);
}
export async function applyBenefits(c,input,base,userId,lock=false){
 const settings={...rewardsDefaults,...(await c.query('SELECT data FROM settings WHERE id=1')).rows[0]?.data?.rewardRedemption};
 const code=String(input.couponCode||'').trim().toUpperCase();if(code.length>40||code&&!/^[A-Z0-9_-]+$/.test(code))fail('Invalid coupon code');
 let coupon=null,discount=0;
 if(code){coupon=(await c.query('SELECT * FROM shop_coupons WHERE code=$1'+(lock?' FOR UPDATE':''),[code])).rows[0];const now=Date.now();if(!coupon||!coupon.active||coupon.starts_at&&coupon.starts_at.getTime()>now||coupon.ends_at&&coupon.ends_at.getTime()<now)fail('Coupon is unavailable or expired');if(base.amount<Number(coupon.minimum_amount))fail('Coupon minimum purchase is Rs. '+coupon.minimum_amount);
  const usage=(await c.query('SELECT count(*)::integer AS total,count(*) FILTER(WHERE user_id=$2)::integer AS member FROM coupon_redemptions WHERE coupon_id=$1 AND released=false',[coupon.id,userId||0])).rows[0];if(coupon.usage_limit&&usage.total>=coupon.usage_limit||userId&&coupon.per_member_limit&&usage.member>=coupon.per_member_limit)fail('Coupon usage limit reached',409);
  discount=coupon.discount_type==='Fixed'?cents(coupon.value):Math.round(cents(base.amount)*Number(coupon.value)/100);if(Number(coupon.maximum_discount)>0)discount=Math.min(discount,cents(coupon.maximum_discount));discount=Math.min(discount,cents(base.amount));
 }
 const points=Number(input.rewardPoints||0);if(!Number.isSafeInteger(points)||points<0||points>1e9)fail('Redeem whole reward points only');if(points&&!userId)fail('Sign in before redeeming reward points',401);if(points&&!settings.enabled)fail('Reward redemption is disabled');
 const balance=await rewardBalance(c,userId,lock&&points>0);if(points>Math.floor(Math.max(0,balance)))fail('Insufficient reward points',409);
 const rewardDiscount=points*cents(settings.pointValue);if(!Number.isSafeInteger(rewardDiscount)||rewardDiscount>cents(base.amount)-discount)fail('Reward points exceed the remaining order amount');
 const result={...base,subtotal:base.amount,couponCode:code,couponId:coupon?Number(coupon.id):null,couponDiscount:discount/100,rewardPoints:points,pointValue:settings.pointValue,rewardDiscount:rewardDiscount/100,amount:(cents(base.amount)-discount-rewardDiscount)/100};
 result.quoteHash=createHash('sha256').update(JSON.stringify({...result,quoteHash:base.quoteHash})).digest('hex');return result;
}
export async function commitBenefits(c,userId,orderId,priced){if(priced.couponId)await c.query('INSERT INTO coupon_redemptions(order_id,coupon_id,user_id,discount) VALUES($1,$2,$3,$4)',[orderId,priced.couponId,userId,priced.couponDiscount]);if(priced.rewardPoints)await entry(c,userId,-priced.rewardPoints,'redeem:'+orderId,'Redeemed on order',orderId);}
export async function settleRewards(c,orderId,data){
 if(data.createdVia!=='Member checkout'||!data.userId)return;
 const cancelled=data.status==='Cancelled'||data.paymentStatus==='Refunded';
 if(cancelled){const used=(await c.query('SELECT coupon_id FROM coupon_redemptions WHERE order_id=$1',[orderId])).rows[0];if(used){await c.query('SELECT id FROM shop_coupons WHERE id=$1 FOR UPDATE',[used.coupon_id]);await c.query('UPDATE coupon_redemptions SET released=true WHERE order_id=$1',[orderId]);}}
 const people=[Number(data.userId),Number(data.referrerId)].filter(Boolean).sort((a,b)=>a-b);for(const id of new Set(people))await rewardBalance(c,id,true);
 if(cancelled){if(data.rewardPoints)await entry(c,data.userId,data.rewardPoints,'redemption-return:'+orderId,'Returned redeemed points',orderId);for(const earned of (await c.query("SELECT * FROM member_reward_ledger WHERE order_id=$1 AND reference IN ($2,$3)",[orderId,'purchase-earned:'+orderId,'sales-earned:'+orderId])).rows)await entry(c,earned.user_id,-Number(earned.amount),'earned-reversal:'+orderId,'Reversed rewards on refund/cancellation',orderId);return;}
 if(data.status==='Delivered'&&data.paymentStatus==='Paid'){
  const total=kind=>Math.round((data.items||[]).reduce((n,line)=>n+(line.rewardSettings?.enabled?Number(line.rewardSettings[kind]||0)*line.quantity:0),0)*100)/100;
  await entry(c,data.userId,total('purchasePointsPerUnit'),'purchase-earned:'+orderId,'Purchase reward points',orderId);
  if(data.referrerId&&Number(data.referrerId)!==Number(data.userId))await entry(c,data.referrerId,total('salesPointsPerUnit'),'sales-earned:'+orderId,'Referral sales reward points',orderId);
 }
}
export function createBenefits(db){
 const list=async()=>(await db.query('SELECT c.*,(SELECT count(*)::integer FROM coupon_redemptions r WHERE r.coupon_id=c.id AND released=false) AS used FROM shop_coupons c ORDER BY c.id DESC')).rows;
 async function save(id,input){const code=String(input.code||'').trim().toUpperCase();if(!/^[A-Z0-9_-]{3,40}$/.test(code))fail('Coupon code must contain 3–40 letters, numbers, hyphens or underscores');if(!['Fixed','Percentage'].includes(input.discountType)||typeof input.active!=='boolean')fail('Invalid coupon type/status');const value=number(input.value,'coupon value');if(!value||input.discountType==='Percentage'&&value>100)fail('Invalid coupon discount');const minimum=number(input.minimumAmount??0,'minimum purchase'),maximum=number(input.maximumDiscount??0,'maximum discount');const count=k=>{const n=Number(input[k]??0);if(!Number.isInteger(n)||n<0||n>1e9)fail('Invalid usage limit');return n;};const date=(v,end)=>{if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('Invalid coupon date');return v+(end?'T23:59:59.999':'T00:00:00')+'+05:45';};const start=date(input.startsAt,false),end=date(input.endsAt,true);if(start&&end&&Date.parse(start)>Date.parse(end))fail('Coupon date range is reversed');
  return db.transaction(async c=>{if(id){const old=(await c.query('SELECT * FROM shop_coupons WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!old)fail('Coupon not found',404);if(Number(input.version)!==old.version)fail('Coupon changed. Reload before saving.',409);if(old.code!==code)fail('Existing coupon codes cannot change');}
   const values=[code,input.discountType,value,minimum,maximum,count('usageLimit'),count('perMemberLimit'),start,end,input.active];const row=(await c.query(id?'UPDATE shop_coupons SET code=$1,discount_type=$2,value=$3,minimum_amount=$4,maximum_discount=$5,usage_limit=$6,per_member_limit=$7,starts_at=$8,ends_at=$9,active=$10,version=version+1 WHERE id=$11 RETURNING *':'INSERT INTO shop_coupons(code,discount_type,value,minimum_amount,maximum_discount,usage_limit,per_member_limit,starts_at,ends_at,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',id?[...values,id]:values)).rows[0];await c.query("INSERT INTO audit(action,kind,details) VALUES('Saved coupon','coupons',$1)",[{couponId:row.id,code}]);return row;});
 }
 async function account(userId){return {balance:await rewardBalance(db,userId),items:(await db.query('SELECT * FROM member_reward_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 30',[userId])).rows};}
 async function adjust(userId,input){const amount=number(input.points,'reward points'),reason=String(input.reason||'').trim(),ref=String(input.requestKey||'');if(!amount||!reason||reason.length>500||!['Credit','Debit'].includes(input.direction)||!/^[a-zA-Z0-9_-]{8,100}$/.test(ref))fail('Enter points, reason and a request reference');return db.transaction(async c=>{const member=(await c.query("SELECT id FROM records WHERE kind='users' AND id=$1 FOR UPDATE",[userId])).rows[0];if(!member)fail('Member not found',404);const balance=await rewardBalance(c,userId,true),previous=(await c.query('SELECT id FROM member_reward_ledger WHERE user_id=$1 AND reference=$2',[userId,'admin:'+ref])).rows[0];if(!previous&&input.direction==='Debit'&&balance<amount)fail('Insufficient reward points');await entry(c,userId,input.direction==='Credit'?amount:-amount,'admin:'+ref,reason);await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Adjusted reward points','users',$1,$2)",[userId,{points:amount,direction:input.direction,reason}]);return {ok:true};});}
 return {list,save,account,adjust};
}
