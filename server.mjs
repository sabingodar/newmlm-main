import {createLegalPages,publicLegalPages} from './src/legal-pages.mjs';
import {createProductSharing} from './src/product-sharing.mjs';
import {renderHomeResponse,renderInformationResponse,renderAboutResponse} from './src/home-render.mjs';
import {panelShell} from './src/panel-shell.mjs';
import {createPayments} from './src/payments.mjs';
import {createRewardSettings,validateRewardCategories} from './src/redemption-policy.mjs';
import {createNetworkCommissions} from './src/network-commissions.mjs';
import {createMemberEarnings} from './src/member-earnings.mjs';
import {createRankRewards} from './src/rank-rewards.mjs';
import {createTransferCorrections} from './src/transfer-corrections.mjs';
import {createDispatchCommissions} from './src/dispatch-commissions.mjs';
import {createInventory} from './src/inventory.mjs';
import {transferPrint,orderBillPrint,dispatchPrint} from './src/inventory-print.mjs';
import {createAdminUsers} from './src/admin-users.mjs';
import {seedRolePermissions,permissionsFor,authorizeAdmin,can,centerScope,requirePermission,isCenterManager} from './src/admin-permissions.mjs';
import {createCenters} from './src/centers.mjs';
import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {basename} from 'node:path';
import {createDatabase,migrate} from './src/database.mjs';
import {initializeAdmin,createAuth} from './src/auth.mjs';
import {createRepository} from './src/repository.mjs';
import {schemas,fail} from './src/validation.mjs';
import {contentDefaults,validateContent,decodeImage} from './src/cms.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createMembers} from './src/members.mjs';
import {createCommerce} from './src/commerce.mjs';
import {createTeamLists} from './src/team-lists.mjs';
import {createBinaryTree} from './src/binary-tree.mjs';
import {createMemberAuth} from './src/member-auth.mjs';
import {geography,locationOf,persistLocation} from './src/geography.mjs';
import {createRegions} from './src/regions.mjs';
import {createCategories,commissions,commissionDefaults} from './src/product-config.mjs';
import {createStorefront,storefrontDefaults,publishedStorefront,validateStorefront} from './src/storefront.mjs';
import {createBenefits,rewardsDefaults,validateRewards} from './src/benefits.mjs';
import {readHeroVideo,videoRange} from './src/hero-video.mjs';
import {aboutPage,aboutVersion,publicAbout,validateAbout} from './src/about.mjs';
import {createRecovery} from './src/password-recovery.mjs';
import {createShopRegistration} from './src/shop-registration.mjs';

const production=process.env.NODE_ENV==='production';
const username=process.env.ADMIN_USERNAME||'admin';
const db=createDatabase();
await migrate(db);
await initializeAdmin(db,username,process.env.ADMIN_PASSWORD);
await seedRolePermissions(db);
await db.query('INSERT INTO settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING',[{siteName:'Dynamic Life Success',tagline:'Better living. Shared success.',email:'',phone:'',address:'Nepal',currency:'NPR'}]);
const repository=createRepository(db),auth=createAuth(db,username),adminUsers=createAdminUsers(db);
const networkCommissions=createNetworkCommissions(db),rankRewards=createRankRewards(db),memberEarnings=createMemberEarnings(db);
const centerManagement=createCenters(db,repository),inventory=createInventory(db),transferCorrections=createTransferCorrections(db),dispatchCommissions=createDispatchCommissions(db);
const members=createMembers(db),memberAuth=createMemberAuth(db),binaryTree=createBinaryTree(db),commerce=createCommerce(db),teamLists=createTeamLists(db);
const regions=createRegions(db);
const categories=createCategories(db);
const storefront=createStorefront(db);
const informationPages=createLegalPages(db);
const productSharing=createProductSharing(db),payments=createPayments(db);
const rewardSettings=createRewardSettings(db),benefits=createBenefits(db),shopRegister=createShopRegistration(db),recovery=createRecovery(db);
const assets={ '/legal-admin.js':['legal-admin.js','text/javascript'], '/product-sharing.js':['product-sharing.js','text/javascript'], '/storefront-markup.js':['storefront-markup.js','text/javascript'], '/payments.js':['payments.js','text/javascript'],'/payment-settings.js':['payment-settings.js','text/javascript'], '/admin/reward-points/settings':['index.html','text/html; charset=utf-8'], '/reward-settings.js':['reward-settings.js','text/javascript'], '/network-commissions.js':['network-commissions.js','text/javascript'], '/dispatch-commissions.js':['dispatch-commissions.js','text/javascript'], '/inventory-admin.js':['inventory-admin.js','text/javascript'],'/order-flow.js':['order-flow.js','text/javascript'],'/inventory-print.css':['inventory-print.css','text/css'],'/inventory-print.js':['inventory-print.js','text/javascript'], '/admin-access.js':['admin-access.js','text/javascript'],'/admin-users.js':['admin-users.js','text/javascript'],'/center-management.js':['center-management.js','text/javascript'], '/hero.js':['hero.js','text/javascript'], '/password-tools.js':['password-tools.js','text/javascript'],'/cms-tabs.js':['cms-tabs.js','text/javascript'],'/about.js':['about.js','text/javascript'],'/about-admin.js':['about-admin.js','text/javascript'], '/startup.js':['startup.js','text/javascript'], '/shop-checkout.js':['shop-checkout.js','text/javascript'],'/promotions-admin.js':['promotions-admin.js','text/javascript'], '/delivery.js':['delivery.js','text/javascript'], '/storefront.js':['storefront.js','text/javascript'],'/storefront-admin.js':['storefront-admin.js','text/javascript'],'/storefront.css':['storefront.css','text/css'], '/product-editor.js':['product-editor.js','text/javascript'],'/geography.js':['geography.js','text/javascript'],'/regions.js':['regions.js','text/javascript'],'/app.js':['app.js','text/javascript'],'/dashboard.js':['dashboard.js','text/javascript'],'/cms.js':['cms.js','text/javascript'],'/admin.css':['admin.css','text/css'],'/brand/logo.jpg':['brand/logo.jpg','image/jpeg'],'/style.css':['style.css','text/css'],'/import.js':['import.js','text/javascript'],'/admin/import':['import.html','text/html; charset=utf-8']};
Object.assign(assets,{'/member-shop.js':['member-shop.js','text/javascript'],'/member-team-list.js':['member-team-list.js','text/javascript'],'/member-tree.js':['member-tree.js','text/javascript'],'/user/binary-tree':['member.html','text/html; charset=utf-8'],'/member-pages.js':['member-pages.js','text/javascript'],'/member-dashboard.js':['member-dashboard.js','text/javascript'],'/users.js':['users.js','text/javascript'],'/members.css':['members.css','text/css'],'/member.js':['member.js','text/javascript'],'/member':['member.html','text/html; charset=utf-8'],'/user/dashboard':['member.html','text/html; charset=utf-8'],'/user/login':['member.html','text/html; charset=utf-8']});
for(const route of ['/user/left-tree','/user/right-tree','/user/registration','/user/marketplace/discount-panel','/user/marketplace/wholesale-panel','/user/shop/quick-order','/user/shop/products'])assets[route]=['member.html','text/html; charset=utf-8'];
function json(res,status,data,headers={}) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data));}
async function body(req) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>10485760)fail('Request too large',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail('Invalid JSON');}
}
async function settings(){return {...contentDefaults,rewardRedemption:rewardsDefaults,storefront:storefrontDefaults,productCommissionDefaults:commissionDefaults,...(await db.query('SELECT data FROM settings WHERE id=1')).rows[0].data};}
async function publicSettings(){const {productCommissionDefaults,storefront,aboutPage:privateAbout,legalPages:privateLegal,...branding}=await settings();return branding;}
async function publicStorefrontData(){const [all,overview]=await Promise.all([settings(),storefront.overview()]);const {productCommissionDefaults,storefront:content,aboutPage:privateAbout,legalPages:privateLegal,...branding}=all;return {settings:branding,content:publishedStorefront(content),about:publicAbout(all),legalPages:publicLegalPages(all),...overview};}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-src https://www.youtube-nocookie.com https://www.google.com https://maps.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://epay.esewa.com.np https://rc-epay.esewa.com.np");
  if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  try {
    if((path.startsWith('/payment/return/')&&/^[a-f0-9-]{36}$/.test(path.slice(16)))){res.setHeader('Cache-Control','no-store');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(readFileSync(new URL('./public/payment-return.html',import.meta.url)));}
    if(path==='/health') {try{await db.query('SELECT 1');return json(res,200,{status:'ok',database:'postgresql'});}catch{return json(res,503,{status:'unavailable'});}}
    if(path.startsWith('/api/')) {
      res.setHeader('Cache-Control','no-store');
      if(!['GET','HEAD'].includes(req.method)) {
        if(req.headers.origin){let host;try{host=new URL(req.headers.origin).host;}catch{fail('Invalid origin',403);}if(host!==req.headers.host)fail('Cross-origin request denied',403);}
        if(path!=='/api/hero-video'&&!req.headers['content-type']?.startsWith('application/json'))fail('JSON content type required',415);
      }
      if(path==='/api/product-sharing/resolve'&&req.method==='GET')return json(res,200,await productSharing.resolve(url.searchParams.get('token')));
      if(path==='/api/product-sharing/me'&&req.method==='GET'){try{const m=await memberAuth.session(req.headers.cookie);return json(res,200,await productSharing.get(m.user_id));}catch(e){if(e.status===401||e.status===404)return json(res,200,{enabled:false});throw e;}}
      if(path==='/api/product-sharing/link'&&req.method==='POST'){const m=await memberAuth.session(req.headers.cookie);if(m.must_change_password)fail('Change your temporary password first',403);return json(res,200,await productSharing.link(m.user_id,Number((await body(req)).productId)));}
      if(path==='/api/payments/options'&&req.method==='GET')return json(res,200,await payments.options());
      if(path==='/api/payments/verify'&&req.method==='POST')return json(res,200,await payments.verify((await body(req)).attemptId));
      if(path==='/api/member/forgot-password'&&req.method==='POST')return json(res,200,await recovery.request(await body(req),req.socket.remoteAddress));
      if(path==='/api/member/reset-password'&&req.method==='POST')return json(res,200,await recovery.reset(await body(req)));
      if(path==='/api/login'&&req.method==='POST') {
        const token=await auth.login(req.socket.remoteAddress,await body(req));
        return json(res,200,{username:(await auth.principal('session='+token)).username},{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`});
      }
      if(path==='/api/public'&&req.method==='GET') {
        const products=(await commerce.catalog('retail')).items.map(({dispatchCommission,rankCommissions,regionalCommissions,...p})=>p);
        return json(res,200,{settings:await publicSettings(),products});
      }
      if(path==='/api/account-status'&&req.method==='GET'){try{await auth.authenticate(req.headers.cookie);return json(res,200,{authenticated:true,dashboardUrl:'/admin/dashboard',role:'admin'});}catch(e){if(e.status!==401)throw e;}try{await memberAuth.session(req.headers.cookie);return json(res,200,{authenticated:true});}catch(e){if(e.status!==401)throw e;return json(res,200,{authenticated:false});}}
      if(path==='/api/branding'&&req.method==='GET'){const s=await settings();return json(res,200,{siteName:s.siteName,logoUrl:s.logoUrl});}
      if(path==='/api/geography'&&req.method==='GET')return json(res,200,geography);
      if(path.startsWith('/api/pages/')&&req.method==='GET'){const page=publicLegalPages(await settings()).find(p=>p.slug===decodeURIComponent(path.slice(11)));if(!page)fail('Page not found',404);return json(res,200,page);}
      if(path==='/api/storefront'&&req.method==='GET')return json(res,200,await publicStorefrontData());
      if(path==='/api/storefront/products'&&req.method==='GET')return json(res,200,await storefront.products(Object.fromEntries(url.searchParams)));
      if((path.startsWith('/api/payments/orders/')&&/^[0-9]+$/.test(path.split('/')[4])&&['start','verify'].includes(path.split('/')[5])&&path.split('/').length===6)&&req.method==='POST'){const m=await memberAuth.session(req.headers.cookie);if(m.must_change_password||!m.permissions.includes('orders'))fail('Ordering is unavailable for this account',403);const parts=path.split('/');return json(res,200,await payments[parts[5]==='start'?'start':'verifyOrder'](m.user_id,Number(parts[4])));}
      if(path.startsWith('/api/cart/')){
        let member=null;try{member=await memberAuth.session(req.headers.cookie);}catch(e){if(e.status!==401)throw e;}
        if(path==='/api/cart/context'&&req.method==='GET'){
          const data=await commerce.catalog('retail'),info=member?await members.detail(member.user_id):null;
          return json(res,200,{member:info?{id:Number(member.user_id),name:info.user.name,username:info.user.username,email:info.user.email,phone:info.user.phone,location:info.user.location,mustChangePassword:member.must_change_password,canOrder:member.permissions.includes('orders')}:null,paymentOptions:await payments.options(),centers:data.centers,products:data.items.map(({dispatchCommission,regionalCommissions,rankCommissions,...p})=>p),rewards:member?await benefits.account(member.user_id):{balance:0,items:[]},rewardSettings:(await settings()).rewardRedemption});
        }
        if(path==='/api/cart/register'&&req.method==='POST'){const result=await shopRegister(await body(req),req.socket.remoteAddress);return json(res,201,{ok:true,id:result.id,username:result.username},{'Set-Cookie':`member_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`});}
        if(path==='/api/cart/quote'&&req.method==='POST'){const input=await body(req),quote=await commerce.quote({...input,channel:'retail',useBenefits:true},member?.user_id);return json(res,200,{...quote,items:quote.items.map(({commissionSettings,rewardSettings,shareAttribution,...line})=>line)});}
        if(path==='/api/cart/checkout-result'&&req.method==='GET'){if(!member)fail('Sign in to view this order',401);const key=url.searchParams.get('requestKey')||'';if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail('Invalid checkout reference');const previous=(await db.query('SELECT order_id FROM member_checkouts WHERE user_id=$1 AND request_key=$2',[member.user_id,key])).rows[0];if(!previous)fail('Order has not been recorded',404);return json(res,200,await commerce.order(member.user_id,previous.order_id));}
        if(path==='/api/cart/checkout'&&req.method==='POST'){if(!member)fail('Sign in or register to complete checkout',401);if(member.must_change_password)fail('Change your temporary password in My Account first',403);if(!member.permissions.includes('orders'))fail('Orders are not enabled for your account',403);return json(res,201,await commerce.checkout(member.user_id,{...await body(req),channel:'retail',useBenefits:true}));}
        fail('Not found',404);
      }
      if(path==='/api/inquiry'&&req.method==='POST'){
        const input=await body(req);if(input.website)fail('Unable to submit inquiry');
        const rate=(await db.query("INSERT INTO login_attempts(ip,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.attempts+1 END,expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING attempts",['inquiry:'+req.socket.remoteAddress])).rows[0];if(rate.attempts>10)fail('Please try again in 15 minutes',429);
        const bounded=(key,max)=>{const s=String(input[key]||'').trim();if(s.length>max)fail('Inquiry field is too long');return s;};
        if(!['contact','franchise'].includes(input.kind))fail('Choose an inquiry type');const name=bounded('name',150),email=bounded('email',254),phone=bounded('phone',40),message=bounded('message',2000),subject=bounded('subject',150);if(!name||!message)fail('Name and message are required');
        const location=input.kind==='franchise'?locationOf(input.location):null;
        await repository.save('leads',null,{name,email,phone,notes:[input.kind==='franchise'?'Franchise Partner Inquiry':'Website Contact Inquiry',subject,message,location?[location.province,location.district,location.city,location.address].filter(Boolean).join(', '):''].filter(Boolean).join('\n\n'),status:'New'});return json(res,201,{ok:true});
      }
      const referralRoute=path.match(/^\/api\/referral\/([a-f0-9]{64})$/);
      if(referralRoute){if(req.method==='GET')return json(res,200,await binaryTree.inviteInfo(referralRoute[1]));if(req.method==='POST')return json(res,201,await binaryTree.register(null,await body(req),{token:referralRoute[1],ip:req.socket.remoteAddress}));fail('Method not allowed',405);}
      if(path.startsWith('/api/member/')){
        if(path==='/api/member/login'&&req.method==='POST'){const token=await memberAuth.login(await body(req),req.socket.remoteAddress,req.headers['user-agent']);return json(res,200,{ok:true},{'Set-Cookie':`member_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`});}
        const member=await memberAuth.session(req.headers.cookie);
        if(path==='/api/member/logout'&&req.method==='POST'){await db.query('DELETE FROM member_sessions WHERE token=$1',[member.token]);return json(res,200,{ok:true},{'Set-Cookie':'member_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
        if(path==='/api/member/session'&&req.method==='GET')return json(res,200,{id:Number(member.user_id),name:member.data.name,username:member.data.username||member.data.legacyUsername,coordinatorAssignments:await regions.assignments(member.user_id),permissions:member.permissions,mustChangePassword:member.must_change_password,branding:await publicSettings()});
        if(path==='/api/member/password'&&req.method==='POST')return json(res,200,await memberAuth.changePassword(member,await body(req)));
        if(member.must_change_password)fail('Change your temporary password before accessing the member dashboard',403);
        if(path==='/api/member/regions'&&req.method==='GET')return json(res,200,await regions.report(member.user_id,Object.fromEntries(url.searchParams)));
        if(path==='/api/member/address'&&req.method==='POST'){
          const input=await body(req),location=locationOf(input.location);
          await db.transaction(async c=>{const row=(await c.query("SELECT * FROM records WHERE id=$1 AND kind='users' FOR UPDATE",[member.user_id])).rows[0];if(input.version!==row.version)fail('Profile changed. Refresh before saving.',409);await c.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2',[{...row.data,location,country:'NP'},member.user_id]);await persistLocation(c,member.user_id,location);await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Member updated regional address','users',$1,$2)",[member.user_id,{location}]);});return json(res,200,{ok:true});
        }
        if(['/api/member/tree','/api/member/tree-invite','/api/member/tree-create'].includes(path)){
          if(!member.permissions.includes('profile'))fail('Member network access is not enabled',403);
          if(path==='/api/member/tree'&&req.method==='GET')return json(res,200,await binaryTree.tree(member.user_id,url.searchParams.get('username')||'',url.searchParams.get('q')||''));
          if(path==='/api/member/tree-invite'&&req.method==='POST')return json(res,201,await binaryTree.invite(member.user_id,await body(req)));
          if(path==='/api/member/tree-create'&&req.method==='POST')return json(res,201,await binaryTree.register(member.user_id,await body(req),{ip:req.socket.remoteAddress}));
          fail('Method not allowed',405);
        }
        if(path==='/api/member/team-list'&&req.method==='GET'){if(!member.permissions.includes('profile'))fail('Network menu is not enabled',403);return json(res,200,await teamLists.list(member.user_id,url.searchParams.get('side'),Object.fromEntries(url.searchParams)));}
        if(path==='/api/member/shop'&&req.method==='GET'){const catalog=await commerce.catalog(url.searchParams.get('channel')||'retail');return json(res,200,{...catalog,paymentOptions:await payments.options(),...(catalog.channel==='discount'?{rewards:await benefits.account(member.user_id)}:{})});}
        if(path==='/api/member/quote'&&req.method==='POST'){if(!member.permissions.includes('orders'))fail('Orders menu is not enabled',403);return json(res,200,await commerce.quote(await body(req),member.user_id));}
        if(path==='/api/member/checkout'&&req.method==='POST'){if(!member.permissions.includes('orders'))fail('Orders menu is not enabled',403);return json(res,201,await commerce.checkout(member.user_id,await body(req)));}
        if(path==='/api/member/order'&&req.method==='GET'){if(!member.permissions.includes('orders'))fail('Orders menu is not enabled',403);return json(res,200,await commerce.order(member.user_id,url.searchParams.get('id')));}
        if(path==='/api/member/track-order'&&req.method==='GET'){if(!member.permissions.includes('orders'))fail('Orders menu is not enabled',403);return json(res,200,await commerce.track(member.user_id,url.searchParams.get('reference')));}
        if(req.method!=='GET')fail('Method not allowed',405);
        const resource=path.split('/').pop();if(!member.permissions.includes(resource))fail('This menu is not enabled for your account',403);
        if(['orders','deposits','withdrawals'].includes(resource))return json(res,200,await members.related(member.user_id,resource,url.searchParams.get('page')||1));
        if(resource==='ledger'){const [account,items,total]=await Promise.all([db.query('SELECT opening_balance,balance FROM member_accounts WHERE user_id=$1',[member.user_id]),db.query('SELECT * FROM member_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 20',[member.user_id]),db.query('SELECT count(*) FROM member_ledger WHERE user_id=$1',[member.user_id])]);return json(res,200,{account:account.rows[0],items:items.rows,total:Number(total.rows[0].count)});}
        if(resource==='notifications')return json(res,200,(await db.query('SELECT id,title,message,created_at FROM member_notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 30',[member.user_id])).rows);
        const detail=await members.detail(member.user_id);
        if(resource==='profile')return json(res,200,{user:{id:detail.user.id,name:detail.user.name,username:detail.user.username,email:detail.user.email,phone:detail.user.phone,status:detail.user.status,version:detail.user.version,location:detail.user.location},profile:{address:detail.profile.address,city:detail.profile.city,state:detail.profile.state,postalCode:detail.profile.postal_code,country:detail.profile.country,emailVerified:detail.profile.email_verified,mobileVerified:detail.profile.mobile_verified,kycStatus:detail.profile.kyc_status},rank:detail.rank,totals:detail.totals,localReferrals:detail.localReferrals,recordedMetrics:detail.user.recordedMetrics||null});
        fail('Not found',404);
      }
      const actor=await permissionsFor(db,await auth.principal(req.headers.cookie)),token=actor.token;
      if(actor.must_change_password&&!['/api/session','/api/logout','/api/admin-password'].includes(path))fail('Change your temporary administrator password before accessing this workspace',403);
      if(path==='/api/admin-password'&&req.method==='POST')return json(res,200,await adminUsers.changePassword(actor,await body(req)),{'Set-Cookie':`session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`});
      if(req.headers['x-member-preview']==='true'&&!can(actor,'users.preview'))fail('Member panel preview is not enabled for your account',403);
      const centerRoute=path.match(/^\/api\/center-management(?:\/(\d+)(?:\/(manager))?)?$/);
      if(centerRoute){const [,id,action]=centerRoute;if(action==='manager'&&req.method==='POST')return json(res,200,await centerManagement.assign(actor,id,await body(req)));if(!id&&req.method==='GET')return json(res,200,await centerManagement.list(actor,Object.fromEntries(url.searchParams)));if((!id&&req.method==='POST')||(id&&!action&&req.method==='PUT'))return json(res,id?200:201,await centerManagement.save(actor,id,await body(req)));fail('Method not allowed',405);}
      if(path.startsWith('/api/payment-verification/')&&req.method==='POST'){requirePermission(actor,'orders.manage');if(isCenterManager(actor))fail('Only central administration can verify gateway payments',403);const id=path.split('/').pop();if(!/^[0-9]+$/.test(id))fail('Invalid order');const row=(await db.query("SELECT data FROM records WHERE kind='orders' AND id=$1",[id])).rows[0];if(!row)fail('Order not found',404);return json(res,200,await payments.verifyOrder(row.data.userId,Number(id)));}
      if(/^\/api\/users\/\d+\/sharing$/.test(path)){const id=Number(path.split('/')[3]);requirePermission(actor,...(req.method==='GET'?['users.view','users.manage']:['users.manage']));if(req.method==='GET')return json(res,200,await productSharing.get(id));if(req.method==='POST'){if(isCenterManager(actor))fail('Only central administration can authorize product sharing',403);return json(res,200,await productSharing.save(id,await body(req),actor.username));}fail('Method not allowed',405);}
      if(path==='/api/payment-settings'){if(req.method==='GET'){requirePermission(actor,'payment-settings.view','payment-settings.manage');return json(res,200,await payments.get());}if(req.method==='PUT'){requirePermission(actor,'payment-settings.manage');return json(res,200,await payments.save(await body(req),actor.username));}fail('Method not allowed',405);}
      if(path==='/api/reward-settings'){if(req.method==='GET'){requirePermission(actor,'reward-settings.view','reward-settings.manage','benefits.manage');return json(res,200,await rewardSettings.get());}if(req.method==='PUT'){requirePermission(actor,'reward-settings.manage','benefits.manage');return json(res,200,await rewardSettings.save(await body(req),actor.username));}fail('Method not allowed',405);}
      if(path==='/api/commission-settings'){if(req.method==='GET'){requirePermission(actor,'commission-settings.view','commission-settings.manage');return json(res,200,await networkCommissions.get());}if(req.method==='PUT'){requirePermission(actor,'commission-settings.manage');if(isCenterManager(actor))fail('Center managers cannot configure network commissions',403);return json(res,200,await networkCommissions.save(await body(req),actor.username));}fail('Method not allowed',405);}
      if(path==='/api/commission-settings/calculate'&&req.method==='POST'){requirePermission(actor,'commission-settings.view','commission-settings.manage');return json(res,200,await networkCommissions.calculate(await body(req)));}
      if(path==='/api/rank-rewards'&&req.method==='GET'){requirePermission(actor,'ranks.view','ranks.manage');return json(res,200,await rankRewards.preview(url.searchParams.get('user')));}
      if(path==='/api/rank-rewards'&&req.method==='POST'){requirePermission(actor,'ranks.manage');return json(res,200,await rankRewards.award((await body(req)).user,actor.username));}
      if(path.startsWith('/api/dispatch-commissions/')){
        const root='/api/dispatch-commissions/';
        if(path===root+'context'&&req.method==='GET')return json(res,200,await dispatchCommissions.context(actor,Object.fromEntries(url.searchParams)));
        if(path===root+'settings'&&req.method==='PUT')return json(res,200,await dispatchCommissions.saveSettings(actor,await body(req)));
        if(path===root+'profile'&&req.method==='PUT')return json(res,200,await dispatchCommissions.profile(actor,await body(req)));
        if(path===root+'assets'&&req.method==='POST')return json(res,201,await dispatchCommissions.upload(actor,await body(req)));
        const image=path.match(/^\/api\/dispatch-commissions\/assets\/([a-f0-9-]{36})$/);if(image&&req.method==='GET'){const asset=await dispatchCommissions.asset(actor,image[1]);res.writeHead(200,{'Content-Type':asset.mime_type,'Content-Length':asset.content.length});return res.end(asset.content);}
        if([root+'ledger',root+'withdrawals'].includes(path)&&req.method==='GET')return json(res,200,await dispatchCommissions.list(actor,path.endsWith('ledger')?'ledger':'withdrawals',Object.fromEntries(url.searchParams)));
        if(path===root+'withdrawals'&&req.method==='POST')return json(res,201,await dispatchCommissions.request(actor,await body(req)));
        const withdrawal=path.match(/^\/api\/dispatch-commissions\/withdrawals\/(\d+)$/);if(withdrawal&&req.method==='PUT')return json(res,200,await dispatchCommissions.update(actor,withdrawal[1],await body(req)));
        fail('Commission endpoint not found',404);
      }
      if(path.startsWith('/api/inventory/')){
        if(path==='/api/inventory/context'&&req.method==='GET')return json(res,200,await inventory.context(actor,Object.fromEntries(url.searchParams)));
        if(path==='/api/inventory/stocks'&&req.method==='GET')return json(res,200,await inventory.stocks(actor,Object.fromEntries(url.searchParams)));
        if(path==='/api/inventory/movements'&&req.method==='GET')return json(res,200,await inventory.movements(actor,Object.fromEntries(url.searchParams)));
        if(path==='/api/inventory/adjust'&&req.method==='POST')return json(res,200,await inventory.adjust(actor,await body(req)));
        if(path==='/api/inventory/order-centers'&&req.method==='GET'){requirePermission(actor,'orders.view','orders.manage','orders.dispatch','inventory.dispatch');return json(res,200,(await db.query("SELECT id,data->>'name' AS name,data->>'location' AS location FROM records WHERE kind='centers' AND data->>'status'='Active' AND COALESCE(data->>'centerType','Dispatch Center')='Dispatch Center'"+(isCenterManager(actor)?' AND id=$1':'')+" ORDER BY data->>'name'",isCenterManager(actor)?[actor.centerId]:[])).rows.map(r=>({...r,id:Number(r.id)})));}
        if(path==='/api/inventory/transfers'&&req.method==='GET')return json(res,200,await inventory.transfers(actor,Object.fromEntries(url.searchParams)));
        if(path==='/api/inventory/transfers'&&req.method==='POST')return json(res,201,await inventory.send(actor,await body(req)));
        const correction=path.match(/^\/api\/inventory\/transfers\/(\d+)\/edits(?:\/(\d+))?$/);if(correction){const [,transferId,editId]=correction;if(!editId&&req.method==='POST')return json(res,201,await transferCorrections.request(actor,transferId,await body(req)));if(editId&&req.method==='PUT')return json(res,200,await transferCorrections.review(actor,transferId,editId,await body(req)));fail('Method not allowed',405);}
        const stockTransfer=path.match(/^\/api\/inventory\/transfers\/(\d+)(?:\/(receive|cancel|print))?$/);if(stockTransfer){const [,id,action]=stockTransfer;if(!action&&req.method==='GET')return json(res,200,await inventory.transfer(actor,id));if(['receive','cancel'].includes(action)&&req.method==='POST')return json(res,200,await inventory[action](actor,id,await body(req)));if(action==='print'&&req.method==='GET'){const html=transferPrint(await inventory.transfer(actor,id),await publicSettings(),url.searchParams.get('document')||'challan');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);}}
        if(path==='/api/inventory/proofs'&&req.method==='POST')return json(res,201,await inventory.uploadProof(actor,await body(req)));
        const stockProof=path.match(/^\/api\/inventory\/proofs\/([a-f0-9-]+)$/);if(stockProof&&req.method==='GET'){const p=await inventory.readProof(actor,stockProof[1]);res.writeHead(200,{'Content-Type':p.mime_type,'Content-Length':p.content.length,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(p.name)});return res.end(p.content);}
        if(path==='/api/inventory/orders/lookup'&&req.method==='POST')return json(res,200,await inventory.lookup(actor,await body(req)));
        const stockOrder=path.match(/^\/api\/inventory\/orders\/(\d+)(?:\/(dispatch|assign|bill))?$/);if(stockOrder){const [,id,action]=stockOrder;if(!action&&req.method==='GET')return json(res,200,await inventory.flow(actor,id,url.searchParams.get('userId')));if(['dispatch','assign'].includes(action)&&req.method==='POST')return json(res,action==='dispatch'?201:200,await inventory[action](actor,id,await body(req)));if(action==='bill'&&req.method==='GET'){const html=orderBillPrint(await inventory.flow(actor,id,url.searchParams.get('userId')),await publicSettings());res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);}}
        const packing=path.match(/^\/api\/inventory\/dispatches\/(\d+)\/print$/);if(packing&&req.method==='GET'){const r=(await db.query('SELECT * FROM inventory_dispatches WHERE id=$1',[packing[1]])).rows[0];if(!r)fail('Dispatch not found',404);await inventory.flow(actor,r.order_id,url.searchParams.get('userId'));const lines=(await db.query('SELECT * FROM inventory_dispatch_lines WHERE dispatch_id=$1 ORDER BY product_id',[r.id])).rows;res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(dispatchPrint(r,lines,await publicSettings()));}
        fail('Inventory endpoint not found',404);
      }
      authorizeAdmin(actor,path,req.method);
      const closedMember=path.match(/^\/api\/users\/(\d+)(?:\/(.*))?$/);if(closedMember&&req.method!=='GET'&&!(req.method==='DELETE'&&!closedMember[2])&&(await db.query("SELECT id FROM records WHERE id=$1 AND kind='users' AND data->>'deletedAt' IS NOT NULL",[closedMember[1]])).rowCount)fail('Deleted member is read-only',409);
      if(path==='/api/admin-users'&&req.method==='GET')return json(res,200,await adminUsers.list(Object.fromEntries(url.searchParams)));
      if(path==='/api/admin-users'&&req.method==='POST')return json(res,201,await adminUsers.save(null,await body(req),actor));
      const adminUserRoute=path.match(/^\/api\/admin-users\/([^/]+)$/);if(adminUserRoute){const name=decodeURIComponent(adminUserRoute[1]);if(req.method==='PUT')return json(res,200,await adminUsers.save(name,await body(req),actor));if(req.method==='DELETE')return json(res,200,await adminUsers.remove(name,await body(req),actor));fail('Method not allowed',405);}
      if(path==='/api/admin-roles'&&req.method==='GET')return json(res,200,await adminUsers.roles());
      const adminRoleRoute=path.match(/^\/api\/admin-roles\/([^/]+)$/);if(adminRoleRoute&&req.method==='PUT')return json(res,200,await adminUsers.saveRole(decodeURIComponent(adminRoleRoute[1]),await body(req),actor));
      if(path==='/api/coupons'&&req.method==='GET')return json(res,200,await benefits.list());
      if(path==='/api/coupons'&&req.method==='POST')return json(res,201,await benefits.save(null,await body(req)));
      const couponRoute=path.match(/^\/api\/coupons\/(\d+)$/);if(couponRoute&&req.method==='PUT')return json(res,200,await benefits.save(couponRoute[1],await body(req)));
      if(couponRoute&&req.method==='DELETE')return json(res,200,await benefits.remove(couponRoute[1],await body(req)));
      const rewardEntryRoute=path.match(/^\/api\/users\/(\d+)\/rewards\/(\d+)$/);if(rewardEntryRoute&&['PUT','DELETE'].includes(req.method))return json(res,200,await benefits.revise(rewardEntryRoute[1],rewardEntryRoute[2],await body(req),req.method==='DELETE'));
      if(path==='/api/categories'&&req.method==='GET')return json(res,200,await categories.list());
      if(path==='/api/categories'&&req.method==='POST')return json(res,201,await categories.create(await body(req)));
      const categoryImage=path.match(/^\/api\/categories\/(\d+)$/);if(categoryImage&&req.method==='PUT')return json(res,200,await categories.updateImage(categoryImage[1],await body(req)));
      if(path==='/api/coordinators'&&req.method==='GET')return json(res,200,await regions.all());
      const deleteProduct=path.match(/^\/api\/products\/(\d+)$/);if(deleteProduct&&req.method==='DELETE')return json(res,200,await repository.removeProduct(deleteProduct[1],await body(req),actor));
      const visibilityRoute=path.match(/^\/api\/products\/(\d+)\/visibility$/);if(visibilityRoute&&req.method==='POST')return json(res,200,await repository.visibility(visibilityRoute[1],await body(req)));
      if(path==='/api/users/lookup'&&req.method==='GET')return json(res,200,await members.lookup(url.searchParams.get('q')||''));
      const userRoute=path.match(/^\/api\/users\/(\d+)(?:\/([a-z]+))?$/);
      if(userRoute){const [,id,action]=userRoute;if(!['GET','DELETE'].includes(req.method)&&(await db.query("SELECT id FROM records WHERE id=$1 AND kind='users' AND data->>'deletedAt' IS NOT NULL",[id])).rowCount)fail('Deleted member is read-only',409);
        if(action==='rewards'&&req.method==='GET')return json(res,200,await benefits.account(id));
        if(action==='rewards'&&req.method==='POST')return json(res,200,await benefits.adjust(id,await body(req),actor.username));
        if(action==='trackorder'&&req.method==='GET')return json(res,200,await commerce.track(id,url.searchParams.get('reference')));
        if(action==='regions'&&req.method==='GET')return json(res,200,await regions.report(id,Object.fromEntries(url.searchParams)));
        if(action==='coordinators'&&req.method==='GET')return json(res,200,await regions.assignments(id));
        if(action==='coordinators'&&req.method==='POST')return json(res,201,await regions.assign(id,await body(req)));
        if(action==='unassign'&&req.method==='POST')return json(res,200,await regions.remove(id,await body(req)));
        if(!action&&req.method==='DELETE')return json(res,200,await members.remove(id,await body(req),actor));
        if(action==='earnings'&&req.method==='GET')return json(res,200,await memberEarnings.get(id,Object.fromEntries(url.searchParams)));
        if(!action&&req.method==='GET')return json(res,200,await members.detail(id));
        if(!action&&req.method==='PUT')return json(res,200,await members.update(id,await body(req)));
        if(action==='teamlist'&&req.method==='GET')return json(res,200,await teamLists.list(id,url.searchParams.get('side'),Object.fromEntries(url.searchParams)));
        if(action==='shop'&&req.method==='GET'){const catalog=await commerce.catalog(url.searchParams.get('channel')||'retail');return json(res,200,{...catalog,...(catalog.channel==='discount'?{rewards:await benefits.account(id)}:{})});}
        if(action==='order'&&req.method==='GET')return json(res,200,await commerce.order(id,url.searchParams.get('id')));
        if(action==='tree'&&req.method==='GET')return json(res,200,await binaryTree.tree(id,url.searchParams.get('username')||'',url.searchParams.get('q')||''));
        if(action==='network'&&req.method==='GET')return json(res,200,await members.network(id));
        if(['orders','deposits','withdrawals'].includes(action)&&req.method==='GET')return json(res,200,await members.related(id,action,url.searchParams.get('page')||1));
        if(action&&req.method==='POST')return json(res,200,await members.action(id,action,await body(req),actor.username));
        fail('Method not allowed',405);
      }
      if(path==='/api/session'&&req.method==='GET')return json(res,200,{username:actor.username,name:actor.name,role:actor.role,centerId:actor.centerId,isOwner:actor.isOwner,mustChangePassword:actor.must_change_password,permissions:actor.permissions,deniedPermissions:actor.permission_overrides?.deny||[],schemas});
      if(path==='/api/dashboard'&&req.method==='GET'){if(actor.role==='Admin')return json(res,200,await repository.dashboard());const cards=[];for(const [key,title] of [['users','Members'],['products','Products'],['orders','Orders'],['tasks','Service tasks'],['leads','CRM leads'],['tickets','Support tickets']])if(can(actor,key+'.view')||can(actor,key+'.manage')){const result=await repository.list(key,{page:1,limit:1},centerScope(actor));cards.push({key,title,count:result.total});}const center=actor.centerId?(await db.query("SELECT data->>'name' AS name FROM records WHERE id=$1 AND kind='centers'",[actor.centerId])).rows[0]?.name:null;return json(res,200,{restricted:true,name:actor.name||actor.username,role:actor.role,center,cards});}
      if(path==='/api/logout'&&req.method==='POST') {
        await db.query('DELETE FROM sessions WHERE token=$1',[token]);return json(res,200,{ok:true},{'Set-Cookie':`session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`});
      }
      if(path==='/api/legal-pages'&&req.method==='GET')return json(res,200,await informationPages.list());
      if(path==='/api/legal-pages'&&req.method==='POST')return json(res,201,await informationPages.save(null,await body(req),actor.username));
      if(path.startsWith('/api/legal-pages/')&&['PUT','DELETE'].includes(req.method))return json(res,200,await informationPages.save(decodeURIComponent(path.slice(17)),await body(req),actor.username,req.method==='DELETE'));
      if(path==='/api/about-page'){
        if(req.method==='GET'){const page=aboutPage(await settings());return json(res,200,{page,version:aboutVersion(page)});}
        if(!['POST','PUT','DELETE'].includes(req.method))fail('Method not allowed',405);const input=await body(req);return json(res,200,await db.transaction(async c=>{const old=(await c.query('SELECT data FROM settings WHERE id=1 FOR UPDATE')).rows[0].data,page=aboutPage(old);if(input.version!==aboutVersion(page))fail('About page changed. Reload before saving.',409);if(req.method==='POST'&&page)fail('About page already exists',409);if(req.method!=='POST'&&!page)fail('About page not found',404);const next=req.method==='DELETE'?null:await validateAbout(c,input);await c.query('UPDATE settings SET data=$1 WHERE id=1',[{...old,aboutPage:next}]);await c.query("INSERT INTO audit(action,kind) VALUES($1,'settings')",['About page '+req.method]);return {page:next,version:aboutVersion(next)};}));
      }
      if(path==='/api/email-settings'){if(req.method==='GET')return json(res,200,await recovery.settings());if(req.method==='PUT')return json(res,200,await recovery.save(await body(req)));}
      if(path==='/api/blog-posts'||path.startsWith('/api/blog-posts/')){
        if(path==='/api/blog-posts'&&req.method==='GET'){const value=(await settings()).storefront;return json(res,200,(value?.posts||storefrontDefaults.posts).map(p=>({...p,version:createHash('sha256').update(JSON.stringify(p)).digest('hex')})));}
        const input=await body(req);const saved=await db.transaction(async c=>{const old=(await c.query('SELECT data FROM settings WHERE id=1 FOR UPDATE')).rows[0].data,content={...storefrontDefaults,...old.storefront},posts=[...content.posts],slug=decodeURIComponent(path.slice('/api/blog-posts/'.length)),index=posts.findIndex(p=>p.slug===slug);if(req.method==='POST'&&path==='/api/blog-posts'){if(posts.some(p=>p.slug===input.slug))fail('This blog URL already exists',409);posts.push(input);}else if(['PUT','DELETE'].includes(req.method)&&index>=0){if(input.version!==createHash('sha256').update(JSON.stringify(posts[index])).digest('hex'))fail('This article changed. Reload before editing.',409);if(req.method==='DELETE')posts.splice(index,1);else posts[index]=input;}else fail('Article not found',404);const next=await validateStorefront(c,{...content,posts});await c.query('UPDATE settings SET data=$1 WHERE id=1',[{...old,storefront:next}]);await c.query("INSERT INTO audit(action,kind,details) VALUES($1,'settings',$2)",['Blog '+req.method,{slug:input.slug||slug}]);return {ok:true};});return json(res,200,saved);
      }
      if(path==='/api/settings') {
        if(req.method==='GET'){const value=await settings();return json(res,200,can(actor,'settings.view')||can(actor,'settings.manage')?value:{...await publicSettings(),productCommissionDefaults:can(actor,'products.manage')?value.productCommissionDefaults:undefined});}
        if(req.method==='PUT') {
          const input=await body(req);if(!can(actor,'settings.manage')&&(!can(actor,'benefits.manage')||Object.keys(input).some(k=>k!=='rewardRedemption')))fail('Your role cannot change website settings',403);if(input.rewardRedemption!==undefined&&!can(actor,'benefits.manage'))fail('Reward settings access is not enabled',403);const result=await db.transaction(async c=>{
            const current=(await c.query('SELECT data FROM settings WHERE id=1 FOR UPDATE')).rows[0].data,result=validateContent(input,current);
            if(input.productCommissionDefaults!==undefined)result.productCommissionDefaults=await commissions(c,input.productCommissionDefaults);
            if(input.storefront!==undefined)result.storefront=await validateStorefront(c,{...storefrontDefaults,...current.storefront,...input.storefront});
            if(input.rewardRedemption!==undefined){result.rewardRedemption=validateRewards(input.rewardRedemption,current.rewardRedemption);await validateRewardCategories(c,result.rewardRedemption);}
            if(result.logoUrl.startsWith('/assets/')&&!(await c.query('SELECT id FROM media_assets WHERE id=$1',[result.logoUrl.split('/').pop()])).rowCount)fail('Uploaded logo was not found');
            await c.query('UPDATE settings SET data=$1 WHERE id=1',[result]);await c.query("INSERT INTO audit(action,kind,details) VALUES('Updated settings','settings',$1)",[{fields:Object.keys(input)}]);return result;
          });return json(res,200,can(actor,'settings.manage')?result:{rewardRedemption:result.rewardRedemption});
        }
      }
      if(path==='/api/hero-video'&&req.method==='POST'){const {mime,content}=await readHeroVideo(req),id=randomUUID();await db.query('INSERT INTO hero_video_assets(id,name,mime_type,content) VALUES($1,$2,$3,$4)',[id,'Homepage hero video',mime,content]);return json(res,201,{url:'/videos/'+id});}
      if(path==='/api/media'&&req.method==='POST') {
        const input=await body(req),image=decodeImage(input),id=randomUUID();
        await db.query('INSERT INTO media_assets(id,name,mime_type,content) VALUES($1,$2,$3,$4)',[id,basename(String(input.name||'logo')).slice(0,200),image.mime,image.content]);
        return json(res,201,{url:'/assets/'+id});
      }
      if(path==='/api/stage'&&req.method==='POST')return json(res,200,await repository.stage(await body(req)));
      if(path==='/api/archive'&&req.method==='GET')return json(res,200,Object.fromEntries((await db.query('SELECT kind,data FROM archive')).rows.map(r=>[r.kind,r.data])));
      if(path==='/api/import'&&req.method==='POST') {
        const input=await body(req),data=Object.keys(input).length?input:Object.fromEntries((await db.query('SELECT kind,data FROM import_staging')).rows.map(r=>[r.kind,r.data]));
        if(!Object.keys(data).length)fail('Choose a source data file first');return json(res,200,await repository.importLegacy(data));
      }
      if(path==='/api/audit'&&req.method==='GET')return json(res,200,(await db.query('SELECT id,action,kind,record_id,created_at AS created FROM audit ORDER BY id DESC LIMIT 100')).rows);
      const match=path.match(/^\/api\/records\/([a-z]+)(?:\/(\d+))?$/);
      if(match) {
        const [,kind,id]=match;if(!schemas[kind])fail('Unknown module',404);
        if(req.method==='GET')return json(res,200,await repository.list(kind,Object.fromEntries(url.searchParams),centerScope(actor)));
        if(!['POST','PUT'].includes(req.method))fail('Method not allowed',405);
        if((req.method==='PUT'&&!id)||(req.method==='POST'&&id))fail('Invalid record URL');
        const input=await body(req);const saved=kind==='centers'?await centerManagement.save(actor,id,input):await repository.save(kind,id,input,{...centerScope(actor),actor:actor.username,dispatchOnly:kind==='orders'&&!can(actor,'orders.manage')});return json(res,id?200:201,saved);
      }
      fail('Endpoint not found',404);
    }
    if(!['GET','HEAD'].includes(req.method))fail('Method not allowed',405);
    if(/^\/videos\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(path)){const id=path.slice(8),meta=(await db.query('SELECT mime_type,octet_length(content) AS size FROM hero_video_assets WHERE id=$1',[id])).rows[0];if(!meta)fail('Video not found',404);const range=videoRange(req.headers.range,meta.size),headers={'Content-Type':meta.mime_type,'Accept-Ranges':'bytes','Cache-Control':'public,max-age=86400'};if(!range){res.writeHead(416,{...headers,'Content-Range':'bytes */'+meta.size});return res.end();}headers['Content-Length']=range.end-range.start+1;if(range.status===206)headers['Content-Range']='bytes '+range.start+'-'+range.end+'/'+meta.size;const content=req.method==='HEAD'?undefined:(await db.query('SELECT substring(content FROM $2 FOR $3) AS part FROM hero_video_assets WHERE id=$1',[id,range.start+1,range.end-range.start+1])).rows[0].part;res.writeHead(range.status,headers);return res.end(content);}
    if(/^\/assets\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(path)) {
      const asset=(await db.query('SELECT mime_type,content FROM media_assets WHERE id=$1',[path.split('/').pop()])).rows[0];
      if(!asset)fail('Image not found',404);res.writeHead(200,{'Content-Type':asset.mime_type,'Cache-Control':'public,max-age=86400'});return res.end(req.method==='HEAD'?undefined:asset.content);
    }
    if(/^\/media\/\d+\.img$/.test(path)) {
      const file=new URL(`./public/media/${basename(path)}`,import.meta.url);if(!existsSync(file))fail('Image not found',404);const content=readFileSync(file);
      const mime=content[0]===0x89?'image/png':content.toString('ascii',0,3)==='GIF'?'image/gif':content.toString('ascii',8,12)==='WEBP'?'image/webp':'image/jpeg';
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':'public,max-age=86400'});return res.end(req.method==='HEAD'?undefined:content);
    }
    const asset=assets[path];if(!asset&&!/^\/(?:terms-and-conditions|privacy-policy|pages\x2f[a-z0-9-]+|products|about|cart|checkout|blog(?:\/[a-z0-9-]+)?|franchise|contact|testimonials|track-order)$/.test(path)&&path!=='/'&&!/^\/admin(?:\/[a-z-]+)?$/.test(path)&&!/^\/admin\/users\/detail\/\d+$/.test(path))fail('Page not found',404);
    let htmlStatus=200;
    let content=readFileSync(new URL(`./public/${asset?asset[0]:'index.html'}`,import.meta.url));
    const html=!asset||asset[1].startsWith('text/html');
    if(html){let markup=content.toString();const informationSlug=['/terms-and-conditions','/privacy-policy'].includes(path)?path.slice(1):path.startsWith('/pages/')?path.slice(7):null;if(informationSlug){const data=await publicStorefrontData(),page=data.legalPages.find(p=>p.slug===informationSlug);if(!page)htmlStatus=404;markup=renderInformationResponse(markup,data,page,path);}if(path==='/about'){const data=await publicStorefrontData();markup=renderAboutResponse(markup,data);}if(path==='/'||path==='/products'){const state={categoryId:url.searchParams.get('categoryId')||'',subcategoryId:url.searchParams.get('subcategoryId')||'',q:url.searchParams.get('q')||'',min:url.searchParams.get('min')||'',max:url.searchParams.get('max')||'',sort:url.searchParams.get('sort')||'latest',page:1};const query=new URLSearchParams(Object.entries(state).filter(([,v])=>v!==''));const [data,listing]=await Promise.all([publicStorefrontData(),storefront.products(state)]);markup=renderHomeResponse(markup,data,listing,'storefront/products?'+query,path);}if(path.startsWith('/admin')||asset?.[0]==='member.html')markup=panelShell(markup,path,asset?.[0]==='member.html');if(!path.startsWith('/admin')&&!asset){for(const file of ['promotions-admin','storefront-admin','regions','cms','cms-tabs','about-admin','users','admin-access','admin-users','center-management','inventory-admin','order-flow','dispatch-commissions','network-commissions','reward-settings','payment-settings','legal-admin'])markup=markup.replace(`<script src="/${file}.js" defer></script>`,'');const title={'/':'Dynamic Life Success','/products':'Products','/cart':'Your shopping cart','/checkout':'Your shopping cart','/blog':'Our journal','/franchise':'Become a Franchise Partner','/about':'About Dynamic Life Success','/contact':'Contact us','/testimonials':'Testimonials','/track-order':'Track your order'}[path]||'Dynamic Life Success';markup=markup.replace('<h1>Dynamic Life Success</h1>','<h1>'+title+'</h1>');}markup=markup.replace(/(src|href)="(\/[a-z0-9-]+\.(?:js|css))"/g,(all,attr,url)=>{const item=assets[url];if(!item)return all;const hash=createHash('sha256').update(readFileSync(new URL('./public/'+item[0],import.meta.url))).digest('hex').slice(0,12);return attr+'="'+url+'?v='+hash+'"';});content=Buffer.from(markup);}
    const etag='"'+createHash('sha256').update(content).digest('hex').slice(0,24)+'"';
    const headers={'Content-Type':asset?asset[1]:'text/html; charset=utf-8','Cache-Control':html?'no-cache':url.searchParams.has('v')?'public,max-age=31536000,immutable':'no-cache','ETag':etag,'Vary':'Accept-Encoding'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
    if(content.length>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'')&&(html||/^text\//.test(asset?.[1]||''))){content=gzipSync(content);headers['Content-Encoding']='gzip';}
    res.writeHead(htmlStatus,headers);res.end(req.method==='HEAD'?undefined:content);
  }catch(error){
    if(error.code==='23505')return json(res,409,{error:'A record with this unique value already exists'});
    if(!error.status)console.error('Request failed:',error.code||error.name);
    json(res,error.status||500,{error:error.status?error.message:'Unexpected server error'});
  }
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Dynamic Life Success: http://localhost:${process.env.PORT||3000} (PostgreSQL)`));
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close(async()=>{await db.close();process.exit(0);});setTimeout(()=>process.exit(1),15000).unref();});
