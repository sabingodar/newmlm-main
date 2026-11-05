import {randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {fail} from './validation.mjs';
import {record} from './repository.mjs';
import {locationOf,persistLocation} from './geography.mjs';
const derive=promisify(scrypt);
export const memberPermissions=['profile','orders','deposits','withdrawals','ledger','notifications'];
const usernameOf=data=>data.username||data.legacyUsername||'';
const numberId=value=>{if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1)fail('Invalid member ID');return Number(value);};
const text=(value,max=500)=>{const result=String(value??'').trim();if(result.length>max)fail('Field is too long');return result;};
export function createMembers(db) {
  async function user(client,id,lock=false){const r=(await client.query("SELECT * FROM records WHERE kind='users' AND id=$1"+(lock?' FOR UPDATE':''),[numberId(id)])).rows[0];if(!r)fail('Member not found',404);return r;}
  async function audit(client,id,action,details={}){await client.query("INSERT INTO audit(action,kind,record_id,details) VALUES($1,'users',$2,$3)",[action,id,details]);}
  async function lookup(q=''){return (await db.query("SELECT id,data->>'name' AS name,COALESCE(NULLIF(data->>'username',''),data->>'legacyUsername') AS username FROM records WHERE kind='users' AND data->>'deletedAt' IS NULL AND (data->>'name' ILIKE $1 OR COALESCE(NULLIF(data->>'username',''),data->>'legacyUsername') ILIKE $1) ORDER BY id LIMIT 30",['%'+text(q,100).replace(/[\\%_]/g,'\\$&')+'%'])).rows;}
  async function related(id,kind,page=1){
    if(!['orders','deposits','withdrawals'].includes(kind))fail('Unknown member history',404);
    const u=await user(db,id),name=usernameOf(u.data);page=Number(page);if(!Number.isInteger(page)||page<1)fail('Invalid page');
    const where=`kind=$1 AND (data->>'userId'=$2 OR (NOT data ? 'userId' AND $3<>'' AND $3=ANY(regexp_split_to_array(replace(COALESCE(data->>'customer',data->>'member',''),'@',''),E'\\n'))))`;
    const params=[kind,String(u.id),name];const total=Number((await db.query('SELECT count(*) FROM records WHERE '+where,params)).rows[0].count);
    const rows=(await db.query('SELECT * FROM records WHERE '+where+" ORDER BY COALESCE(data->>'sortDate',created_at::text) DESC,id DESC LIMIT 20 OFFSET $4",[...params,(page-1)*20])).rows;
    return {items:rows.map(record),total,page,limit:20};
  }
  async function detail(id){
    const u=await user(db,id),p=(await db.query('SELECT * FROM member_profiles WHERE user_id=$1',[u.id])).rows[0];
    const account=(await db.query('SELECT opening_balance,balance FROM member_accounts WHERE user_id=$1',[u.id])).rows[0];
    const [orders,deposits,withdrawals]=await Promise.all(['orders','deposits','withdrawals'].map(k=>related(u.id,k)));
    const totals={};
    const allOrders=await relatedAll(u,'orders');
    totals.purchase=allOrders.filter(r=>['Confirmed','Delivered','Dispatched','Out for delivery'].includes(r.data.status)).reduce((sum,r)=>sum+Math.round(Number(r.data.amount)*100),0)/100;
    totals.pendingOrders=allOrders.filter(r=>r.data.status==='Pending').length;
    totals.completedOrders=allOrders.filter(r=>['Delivered','Completed'].includes(r.data.status)).length;
    for(const kind of ['deposits','withdrawals']){const data=await relatedAll(u,kind);totals[kind+'Status']={submitted:data.reduce((n,r)=>n+Math.round(Number(r.data.amount)*100),0)/100,pending:data.filter(r=>r.data.status==='Pending').reduce((n,r)=>n+Math.round(Number(r.data.amount)*100),0)/100,rejected:data.filter(r=>r.data.status==='Rejected').reduce((n,r)=>n+Math.round(Number(r.data.amount)*100),0)/100};totals[kind]=data.filter(r=>r.data.status==='Approved').reduce((n,r)=>n+Math.round(Number(r.data.amount)*100),0)/100;}
    const referrals=Number((await db.query('SELECT count(*) FROM member_profiles WHERE referrer_id=$1',[u.id])).rows[0].count);
    const ledger=(await db.query('SELECT * FROM member_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 20',[u.id])).rows;
    const activity=(await db.query("SELECT id,action,details,created_at AS created FROM audit WHERE kind='users' AND record_id=$1 ORDER BY id DESC LIMIT 30",[u.id])).rows;
    const rank=p.affiliate_rank_id?(await db.query("SELECT id,data FROM records WHERE kind='affiliates' AND id=$1",[p.affiliate_rank_id])).rows[0]:null;
    const relation=async rid=>rid?(await db.query("SELECT id,data->>'name' AS name,COALESCE(NULLIF(data->>'username',''),data->>'legacyUsername') AS username FROM records WHERE kind='users' AND id=$1",[rid])).rows[0]:null;
    return {user:{...record(u),username:usernameOf(u.data)},profile:p,account,rank:rank?{id:Number(rank.id),...rank.data}:null,referrer:await relation(p.referrer_id),parent:await relation(p.parent_id),totals:{...totals,orders:orders.total,referrals,transactions:Number((await db.query('SELECT count(*) FROM member_ledger WHERE user_id=$1',[u.id])).rows[0].count)},orders,deposits,withdrawals,ledger,activity,
      hasPassword:!!(await db.query('SELECT user_id FROM member_credentials WHERE user_id=$1',[u.id])).rowCount,
      logins:(await db.query('SELECT id,ip,user_agent,success,created_at FROM member_login_history WHERE user_id=$1 ORDER BY id DESC LIMIT 30',[u.id])).rows,
      localReferrals:(await db.query("SELECT r.id,r.data->>'name' AS name,COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername') AS username,r.data->>'status' AS status,COALESCE(NULLIF(r.data->>'legacyJoinedAt',''),r.created_at::text) AS joined FROM member_profiles p JOIN records r ON r.id=p.user_id WHERE p.referrer_id=$1 ORDER BY r.id DESC LIMIT 100",[u.id])).rows,
      notifications:(await db.query('SELECT id,title,message,created_at FROM member_notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 30',[u.id])).rows};
  }
  async function relatedAll(u,kind){return (await db.query(`SELECT data FROM records WHERE kind=$1 AND (data->>'userId'=$2 OR (NOT data ? 'userId' AND $3<>'' AND $3=ANY(regexp_split_to_array(replace(COALESCE(data->>'customer',data->>'member',''),'@',''),E'\\n'))))`,[kind,String(u.id),usernameOf(u.data)])).rows;}
  async function checkVersion(u,input){if(!Number.isInteger(input.version)||input.version!==u.version)fail('This member changed. Refresh before saving.',409);}
  async function update(id,input){
    return db.transaction(async client=>{const u=await user(client,id,true);if(u.data.deletedAt)fail('Deleted member is read-only',409);await checkVersion(u,input);
      const firstName=text(input.firstName,100),lastName=text(input.lastName,100),email=text(input.email,254),username=text(input.username,60);
      if(!firstName||!lastName||!email||!username)fail('First name, last name, email and username are required');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Invalid email');if(!/^[a-zA-Z0-9_.-]{3,60}$/.test(username))fail('Username must contain 3–60 letters, digits, dots, underscores or hyphens');
      if(usernameOf(u.data)&&username!==usernameOf(u.data))fail('Existing member usernames cannot be changed because history is linked to them');
      const country=text(input.country,2).toUpperCase();if(country&&!/^[A-Z]{2}$/.test(country))fail('Use a two-letter country code');
      for(const key of ['emailVerified','mobileVerified'])if(input[key]!==null&&typeof input[key]!=='boolean')fail('Invalid verification status');
      if(!['Unknown','Pending','Verified','Rejected'].includes(input.kycStatus))fail('Invalid KYC status');
      const data={...u.data,name:firstName+' '+lastName,email,phone:text(input.phone,40),username,country};
      if(input.location!==undefined){data.location=locationOf(input.location);data.country='NP';}
      await client.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2',[data,u.id]);
      await client.query('UPDATE member_profiles SET first_name=$1,last_name=$2,address=$3,city=$4,state=$5,postal_code=$6,country=$7,email_verified=$8,mobile_verified=$9,kyc_status=$10,notes=$11 WHERE user_id=$12',[firstName,lastName,text(input.address),text(input.city,100),text(input.state,100),text(input.postalCode,30),country,input.emailVerified,input.mobileVerified,input.kycStatus,text(input.notes,4000),u.id]);
      if(input.location!==undefined)await persistLocation(client,u.id,data.location);
      await audit(client,u.id,'Updated member profile');return {ok:true};
    });
  }
  async function action(id,kind,input,actor){
    if(kind==='password') {
      if(typeof input.password!=='string'||input.password.length<6||input.password.length>256||input.password!==input.confirmation)fail('Passwords must match and contain 6–256 characters');
      const salt=randomBytes(16).toString('hex'),hash=(await derive(input.password,salt,64)).toString('hex');
      return db.transaction(async client=>{const u=await user(client,id,true);if(u.data.deletedAt)fail('Deleted member is read-only',409);await client.query('INSERT INTO member_credentials(user_id,salt,password_hash,version,must_change_password) VALUES($1,$2,$3,$4,true) ON CONFLICT(user_id) DO UPDATE SET salt=EXCLUDED.salt,password_hash=EXCLUDED.password_hash,version=EXCLUDED.version,must_change_password=true,updated_at=now()',[u.id,salt,hash,randomBytes(16).toString('hex')]);await client.query('DELETE FROM member_sessions WHERE user_id=$1',[u.id]);await audit(client,u.id,'Changed member password');return {ok:true};});
    }
    return db.transaction(async client=>{
      if(['network','status'].includes(kind))await client.query('SELECT pg_advisory_xact_lock(76241905)');
      const u=await user(client,id,true);if(u.data.deletedAt)fail('Deleted member is read-only',409);
      if(kind==='balance') {
        if(!['Credit','Debit'].includes(input.direction)||!/^\d{1,10}(?:\.\d{1,2})?$/.test(String(input.amount))||Number(input.amount)<=0)fail('Enter a positive amount with at most two decimals');
        const amount=Number(input.amount).toFixed(2),reason=text(input.reason,1000),requestId=text(input.requestId,100);
        if(!reason||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))fail('Reason and unique request reference are required');
        const duplicate=(await client.query('SELECT * FROM member_ledger WHERE user_id=$1 AND request_id=$2',[u.id,requestId])).rows[0];
        if(duplicate){if(duplicate.direction!==input.direction||duplicate.amount!==amount||duplicate.reason!==reason)fail('Request reference was already used for a different adjustment',409);return {ok:true,entry:duplicate,replayed:true};}
        const account=(await client.query('UPDATE member_accounts SET balance=balance+CASE WHEN $1=\'Credit\' THEN $2::numeric ELSE -$2::numeric END WHERE user_id=$3 AND ($1=\'Credit\' OR balance >=$2::numeric) RETURNING balance',[input.direction,amount,u.id])).rows[0];
        if(!account)fail('Insufficient balance');
        const entry=(await client.query('INSERT INTO member_ledger(user_id,direction,amount,balance_after,reason,request_id,actor) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[u.id,input.direction,amount,account.balance,reason,requestId,actor])).rows[0];
        await audit(client,u.id,'Adjusted member balance',{direction:input.direction,amount,reason,ledgerId:entry.id});return {ok:true,entry};
      }
      if(kind==='status'){await checkVersion(u,input);if(!['Active','Inactive'].includes(input.status))fail('Invalid member status');const reason=text(input.reason,1000);if(input.status==='Inactive'&&!reason)fail('Enter the reason for banning this member');await client.query('UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2',[{...u.data,status:input.status},u.id]);await client.query('UPDATE member_profiles SET ban_reason=$1 WHERE user_id=$2',[input.status==='Inactive'?reason:'',u.id]);if(input.status==='Inactive')await client.query('DELETE FROM member_sessions WHERE user_id=$1',[u.id]);await audit(client,u.id,input.status==='Inactive'?'Banned member':'Unbanned member',{reason});}
      else if(kind==='rank'){await checkVersion(u,input);const rankId=numberId(input.rankId);const rank=(await client.query("SELECT id FROM records WHERE kind='affiliates' AND id=$1 AND data->>'status'='Active'",[rankId])).rows[0];if(!rank)fail('Choose an active affiliate rank');await client.query('UPDATE member_profiles SET affiliate_rank_id=$1 WHERE user_id=$2',[rankId,u.id]);await bump(client,u.id);await audit(client,u.id,'Changed affiliate rank',{rankId,bonusAwarded:false});}
      else if(kind==='network'){await checkVersion(u,input);const referrerId=input.referrerId?numberId(input.referrerId):null,parentId=input.parentId?numberId(input.parentId):null;const position=input.position||null;if(position&&!['Left','Right'].includes(position))fail('Invalid position');if(position&&!parentId)fail('Choose a placement parent first');
        await client.query('SELECT pg_advisory_xact_lock(76241905)');
        for(const [column,rid] of [['referrer_id',referrerId],['parent_id',parentId]]){if(!rid)continue;await user(client,rid);if(rid===Number(u.id))fail('A member cannot refer or parent themselves');const cycle=await client.query(`WITH RECURSIVE chain AS (SELECT user_id,${column} AS next FROM member_profiles WHERE user_id=$1 UNION SELECT p.user_id,p.${column} FROM member_profiles p JOIN chain c ON p.user_id=c.next) SELECT 1 FROM chain WHERE user_id=$2`,[rid,u.id]);if(cycle.rowCount)fail('This relationship would create a cycle');}
        await client.query('UPDATE member_profiles SET referrer_id=$1,parent_id=$2,position=$3 WHERE user_id=$4',[referrerId,parentId,position,u.id]);await bump(client,u.id);await audit(client,u.id,'Updated member relationships',{referrerId,parentId,position});
      }
      else if(kind==='permissions'){if(!Array.isArray(input.permissions)||input.permissions.some(p=>!memberPermissions.includes(p)))fail('Invalid member portal permissions');await client.query('UPDATE member_profiles SET permissions=$1 WHERE user_id=$2',[JSON.stringify([...new Set(input.permissions)]),u.id]);await audit(client,u.id,'Updated member portal permissions',{permissions:input.permissions});}
      else if(kind==='notifications'){const title=text(input.title,150),message=text(input.message,4000);if(!title||!message)fail('Title and message are required');await client.query('INSERT INTO member_notifications(user_id,title,message,actor) VALUES($1,$2,$3,$4)',[u.id,title,message,actor]);await audit(client,u.id,'Created internal member notification');}
      else fail('Unknown member action',404);
      return {ok:true};
    });
  }
  async function bump(client,id){await client.query('UPDATE records SET version=version+1,updated_at=now() WHERE id=$1',[id]);}
  async function network(id){await user(db,id);return (await db.query(`WITH RECURSIVE tree AS (SELECT user_id,parent_id,position,0 AS depth,ARRAY[user_id] AS path FROM member_profiles WHERE user_id=$1 UNION ALL SELECT p.user_id,p.parent_id,p.position,t.depth+1,t.path||p.user_id FROM member_profiles p JOIN tree t ON p.parent_id=t.user_id WHERE t.depth<3 AND NOT p.user_id=ANY(t.path)) SELECT r.id,r.data->>'name' AS name,COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername') AS username,t.parent_id,t.position,t.depth FROM tree t JOIN records r ON r.id=t.user_id ORDER BY t.depth,r.id LIMIT 100`,[id])).rows;}
  async function remove(id,input,actor){if(['Dispatch Center Manager','Service Center Manager'].includes(actor.role))fail('Center managers cannot delete members',403);return db.transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(76241905)');const u=await user(c,id,true);if(u.data.deletedAt)return {deleted:true,replayed:true};if(Number(input.version)!==u.version)fail('Member changed. Refresh before deleting.',409);const assignments=(await c.query('SELECT * FROM coordinator_assignments WHERE user_id=$1',[u.id])).rows;const data={...u.data,status:'Inactive',deletedAt:new Date().toISOString(),deletedBy:actor.username,deletedReason:text(input.reason,1000)||'Deleted by administrator',deletedAssignments:assignments};await c.query('UPDATE records SET data=$2,version=version+1,updated_at=now() WHERE id=$1',[u.id,data]);await c.query('DELETE FROM member_sessions WHERE user_id=$1',[u.id]);await c.query('UPDATE member_password_resets SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[u.id]);await c.query('DELETE FROM coordinator_assignments WHERE user_id=$1',[u.id]);await audit(c,u.id,'Deleted member',{actor:actor.username,reason:data.deletedReason,assignmentsRemoved:assignments.length,historyPreserved:true});return {deleted:true};});}
  return {lookup,detail,update,action,related,network,remove};
}
