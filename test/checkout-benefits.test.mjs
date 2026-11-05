import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../src/database.mjs';
import {geography} from '../src/geography.mjs';
const name='dls_checkout_'+randomBytes(6).toString('hex'),base='http://localhost:3208',city=geography.cities[0],location={country:'NP',provinceId:city.provinceId,districtId:city.districtId,cityId:city.id};
let adminDb,db,child,adminCookie,a,b,referrer,product,center,firstOrder,coupon;
async function req(path,method='GET',data,cookie=adminCookie){return fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});}
async function jsonOk(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json();}
const create=async(kind,input)=>jsonOk(await req('/api/records/'+kind,'POST',input),201);
const registration=(username,extra={})=>({firstName:'Checkout',lastName:'Fixture',username,email:username+'@example.test',phone:'9800000000',password:'chosen6',confirmation:'chosen6',location,...extra});
async function register(username,extra={}){const r=await req('/api/cart/register','POST',registration(username,extra),null);const user=await jsonOk(r,201);return {user,cookie:r.headers.get('set-cookie').split(';')[0]};}
const cart=(extra={})=>({items:[{productId:product.id,quantity:2}],channel:'discount',useBenefits:true,...extra});
async function quote(input,cookie=a.cookie){return jsonOk(await req('/api/member/quote','POST',input,cookie));}
const orderInput=(q,input,key)=>({...input,quoteHash:q.quoteHash,centerId:center.id,recipient:'Checkout Fixture',phone:'9800000000',address:'Fixture address',requestKey:key,paymentStatus:'Paid',amount:.01});
const balance=async id=>(await jsonOk(await req('/api/users/'+id+'/rewards'))).balance;
async function changeOrder(o,status,paymentStatus='Pending'){return jsonOk(await req('/api/records/orders/'+o.id,'PUT',{customer:o.customer,productId:o.productId,quantity:o.quantity,amount:0,status,paymentStatus}));}
const couponInput=(code,extra={})=>({code,discountType:'Fixed',value:20,minimumAmount:100,maximumDiscount:0,usageLimit:2,perMemberLimit:1,active:true,...extra});
before(async()=>{adminDb=createDatabase(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);await adminDb.query('CREATE DATABASE '+name);const url=new URL(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);url.pathname='/'+name;db=createDatabase(url.toString());child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DATABASE_URL:url.toString(),PORT:'3208',ADMIN_PASSWORD:'CheckoutFixtureAdmin2026!',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Checkout server timeout')),45000);child.stdout.on('data',c=>{if(String(c).includes('localhost')){clearTimeout(t);resolve();}});child.on('exit',code=>{clearTimeout(t);reject(Error('Server exit '+code));});});let r=await req('/api/login','POST',{username:'admin',password:'CheckoutFixtureAdmin2026!'},null);await jsonOk(r);adminCookie=r.headers.get('set-cookie').split(';')[0];referrer=await create('users',{name:'Referral Fixture',username:'REF_FIXTURE',email:'ref@example.test',status:'Active'});a=await register('CHECKOUT_A',{referralId:'REF_FIXTURE'});b=await register('CHECKOUT_B');center=await create('centers',{name:'Fixture Center',location:'Fixture location',status:'Active'});await jsonOk(await req('/api/settings','PUT',{rewardRedemption:{pointValue:1,enabled:true,defaultMaxPercent:100}}));product=await create('products',{name:'Checkout product',category:'Fixture',price:113,bv:0,stock:20,status:'Active',showInDiscount:true,rewardsEnabled:true,purchaseRewardPoints:5,salesRewardPoints:3});await jsonOk(await req('/api/users/'+a.user.id+'/rewards','POST',{points:100,direction:'Credit',reason:'Verified fixture opening points',requestKey:'opening-points-a'}));});
after(async()=>{child?.kill();if(child&&child.exitCode===null)await new Promise(r=>child.once('exit',r));await db?.close();await adminDb?.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await adminDb?.close();});
test('checkout registration signs in with chosen password and links only a valid referral',async()=>{
 const session=await jsonOk(await req('/api/member/session','GET',undefined,a.cookie));assert.equal(session.username,'CHECKOUT_A');assert.equal(session.mustChangePassword,false);
 const detail=await jsonOk(await req('/api/users/'+a.user.id));assert.equal(Number(detail.profile.referrer_id),referrer.id);assert.equal(detail.profile.parent_id,null);assert.equal(detail.user.location.cityId,city.id);assert.equal(detail.account.balance,'0.00');
 assert.equal((await req('/api/cart/register','POST',registration('DUPLICATE',{email:'CHECKOUT_A@example.test'}),null)).status,409);assert.equal((await req('/api/cart/register','POST',registration('SHORT',{password:'123',confirmation:'123'}),null)).status,400);assert.equal((await req('/api/cart/register','POST',registration('BAD_REF',{referralId:'UNKNOWN'}),null)).status,400);assert.equal((await req('/api/cart/register','POST',registration('BAD_COUNTRY',{location:{...location,country:'US'}}),null)).status,400);
 assert.equal((await req('/cart','GET',undefined,null)).status,200);assert.equal((await req('/checkout','GET',undefined,null)).status,200);assert.equal((await req('/api/member/checkout','POST',{},null)).status,401);
 const guest=await jsonOk(await req('/api/cart/context','GET',undefined,null));assert.equal(guest.member,null);assert.equal(guest.rewards.balance,0);assert.ok(!JSON.stringify(guest).includes('CHECKOUT_A@example.test'));
});
test('coupon and points use server totals, reserve once, and replay without duplicate stock or debits',async()=>{
 coupon=await jsonOk(await req('/api/coupons','POST',couponInput('FIXTURE20')),201);const input=cart({couponCode:'fixture20',rewardPoints:60}),q=await quote(input);assert.equal(q.subtotal,226);assert.equal(q.couponDiscount,20);assert.equal(q.rewardDiscount,60);assert.equal(q.amount,146);assert.equal(q.vatAmount,26);
 const payload=orderInput(q,input,'benefit-checkout-001'),results=await Promise.all([req('/api/member/checkout','POST',payload,a.cookie),req('/api/member/checkout','POST',payload,a.cookie)]);const rows=await Promise.all(results.map(r=>jsonOk(r,201)));firstOrder=rows[0];assert.equal(rows[0].id,rows[1].id);assert.equal(firstOrder.amount,146);assert.equal(firstOrder.paymentStatus,'Pending');assert.equal(Number(await balance(a.user.id)),40);
 assert.equal(Number((await db.query("SELECT data->>'stock' AS stock FROM records WHERE id=$1",[product.id])).rows[0].stock),18);assert.equal((await db.query('SELECT count(*) FROM coupon_redemptions')).rows[0].count,'1');assert.equal((await db.query("SELECT count(*) FROM member_reward_ledger WHERE reference LIKE 'redeem:%'")).rows[0].count,'1');
 assert.equal((await req('/api/member/checkout','POST',{...payload,rewardPoints:20},a.cookie)).status,409);assert.equal((await req('/api/member/quote','POST',input,a.cookie)).status,409);
 assert.equal((await req('/api/cart/checkout-result?requestKey=benefit-checkout-001','GET',undefined,b.cookie)).status,404);assert.equal((await jsonOk(await req('/api/cart/checkout-result?requestKey=benefit-checkout-001','GET',undefined,a.cookie))).id,firstOrder.id);
 assert.equal((await db.query('SELECT balance FROM member_accounts WHERE user_id=$1',[a.user.id])).rows[0].balance,'0.00');
});
test('concurrent redemption cannot spend the same reward points twice',async()=>{
 const input=cart({rewardPoints:30,items:[{productId:product.id,quantity:1}]}),q=await quote(input);const results=await Promise.all(['points-race-001','points-race-002'].map(key=>req('/api/member/checkout','POST',orderInput(q,input,key),a.cookie)));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(Number(await balance(a.user.id)),10);const accepted=await results.find(r=>r.status===201).json();await changeOrder(accepted,'Cancelled');assert.equal(Number(await balance(a.user.id)),40);
});
test('Paid + Delivered earns purchase/referral points once; cancellation restores redemption and coupon use',async()=>{
 await changeOrder(firstOrder,'Delivered','Paid');await changeOrder(firstOrder,'Delivered','Paid');assert.equal(Number(await balance(a.user.id)),50);assert.equal(Number(await balance(referrer.id)),6);
 await changeOrder(firstOrder,'Cancelled','Paid');await changeOrder(firstOrder,'Cancelled','Paid');assert.equal(Number(await balance(a.user.id)),100);assert.equal(Number(await balance(referrer.id)),0);assert.equal((await db.query('SELECT released FROM coupon_redemptions WHERE order_id=$1',[firstOrder.id])).rows[0].released,true);assert.equal((await quote(cart({couponCode:'FIXTURE20'}))).couponDiscount,20);
 await assert.rejects(db.query('UPDATE member_reward_ledger SET amount=999 WHERE user_id=$1',[a.user.id]),/append-only/);
});
test('coupon caps, expiry, usage races, point ownership and disabled redemption are enforced',async()=>{
 await jsonOk(await req('/api/coupons','POST',couponInput('CAP10',{discountType:'Percentage',value:10,maximumDiscount:5,minimumAmount:0})),201);assert.equal((await quote(cart({couponCode:'CAP10'}))).couponDiscount,5);
 await jsonOk(await req('/api/coupons','POST',couponInput('EXPIRED',{endsAt:'2000-01-01'})),201);assert.equal((await req('/api/member/quote','POST',cart({couponCode:'EXPIRED'}),a.cookie)).status,400);
 assert.equal((await req('/api/member/quote','POST',cart({rewardPoints:101,userId:a.user.id}),b.cookie)).status,409);assert.equal((await req('/api/member/quote','POST',cart({rewardPoints:1}),null)).status,401);assert.equal((await req('/api/member/quote','POST',cart({rewardPoints:-1}),a.cookie)).status,400);
 await jsonOk(await req('/api/coupons','POST',couponInput('LASTUSE',{usageLimit:1})),201);const input=cart({couponCode:'LASTUSE'}),qa=await quote(input),qb=await quote(input,b.cookie),results=await Promise.all([req('/api/member/checkout','POST',orderInput(qa,input,'last-use-a'),a.cookie),req('/api/member/checkout','POST',orderInput(qb,input,'last-use-b'),b.cookie)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 await jsonOk(await req('/api/settings','PUT',{rewardRedemption:{pointValue:2,enabled:false}}));assert.equal((await req('/api/member/quote','POST',cart({rewardPoints:1}),a.cookie)).status,400);await jsonOk(await req('/api/settings','PUT',{rewardRedemption:{pointValue:1,enabled:true}}));
 assert.equal((await req('/api/coupons','GET',undefined,a.cookie)).status,401);assert.equal((await req('/api/users/'+a.user.id+'/rewards','POST',{points:100,direction:'Credit',reason:'Forgery',requestKey:'forged-reward'},a.cookie)).status,401);
});
test('spent earned points reverse on refund and cannot be reused until repaid',async()=>{
 const user=await register('POINTS_REFUND'),input=cart({items:[{productId:product.id,quantity:1}]}),q=await quote(input,user.cookie),earned=await jsonOk(await req('/api/member/checkout','POST',orderInput(q,input,'earn-order-001'),user.cookie),201);await changeOrder(earned,'Delivered','Paid');assert.equal(Number(await balance(user.user.id)),5);
 const redeem=cart({items:[{productId:product.id,quantity:1}],rewardPoints:5}),qr=await quote(redeem,user.cookie),spent=await jsonOk(await req('/api/member/checkout','POST',orderInput(qr,redeem,'spend-order-001'),user.cookie),201);await changeOrder(earned,'Cancelled','Refunded');assert.equal(Number(await balance(user.user.id)),-5);assert.equal((await req('/api/member/quote','POST',redeem,user.cookie)).status,409);await changeOrder(spent,'Cancelled');assert.equal(Number(await balance(user.user.id)),0);
});

test('storefront account status follows the real member session and logout',async()=>{let r=await req('/api/account-status','GET',undefined,null);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await jsonOk(r),{authenticated:false});assert.deepEqual(await jsonOk(await req('/api/account-status','GET',undefined,a.cookie)),{authenticated:true});assert.equal((await req('/api/member/logout','POST',{},a.cookie)).status,200);assert.deepEqual(await jsonOk(await req('/api/account-status','GET',undefined,a.cookie)),{authenticated:false});const login=await req('/api/member/login','POST',{username:'CHECKOUT_A',password:'chosen6'},null);await jsonOk(login);const cookie=login.headers.get('set-cookie').split(';')[0];assert.deepEqual(await jsonOk(await req('/api/account-status','GET',undefined,cookie)),{authenticated:true});});

test('coupon deletion rejects stale changes and manual reward revisions preserve history and balances',async()=>{
 const c=await jsonOk(await req('/api/coupons','POST',couponInput('DELETE_FIXTURE')),201);
 await jsonOk(await req('/api/coupons/'+c.id,'DELETE',{version:c.version+1}),409);
 await jsonOk(await req('/api/coupons/'+c.id,'DELETE',{version:c.version}));
 assert.ok(!(await jsonOk(await req('/api/coupons'))).some(x=>x.id===c.id));
 assert.equal((await db.query('SELECT active,deleted_at FROM shop_coupons WHERE id=$1',[c.id])).rows[0].active,false);
 const before=Number(await balance(b.user.id));
 await jsonOk(await req('/api/users/'+b.user.id+'/rewards','POST',{points:10,direction:'Credit',reason:'Revision fixture',requestKey:'revision-fixture-key'}));
 let account=await jsonOk(await req('/api/users/'+b.user.id+'/rewards'));const row=account.items.find(r=>r.reference==='admin:revision-fixture-key');assert.equal(row.editable,true);
 await jsonOk(await req('/api/users/'+b.user.id+'/rewards/'+row.id,'PUT',{version:0,points:15,direction:'Credit',reason:'Corrected fixture'}));
 assert.equal(Number(await balance(b.user.id)),before+15);
 await jsonOk(await req('/api/users/'+b.user.id+'/rewards/'+row.id,'DELETE',{version:0}),409);
 await jsonOk(await req('/api/users/'+b.user.id+'/rewards/'+row.id,'DELETE',{version:1}));
 assert.equal(Number(await balance(b.user.id)),before);
 assert.equal(Number((await db.query('SELECT amount FROM member_reward_ledger WHERE id=$1',[row.id])).rows[0].amount),10);
 account=await jsonOk(await req('/api/users/'+b.user.id+'/rewards'));assert.equal(account.items.find(r=>r.id===row.id).revision.deleted,true);
 const automatic=account.items.find(r=>!r.editable);assert.ok(automatic);await jsonOk(await req('/api/users/'+b.user.id+'/rewards/'+automatic.id,'DELETE',{version:0}),400);
});
