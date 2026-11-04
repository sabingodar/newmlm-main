import {randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {digest} from './auth.mjs';
import {fail} from './validation.mjs';
import {locationOf,persistLocation} from './geography.mjs';
const derive=promisify(scrypt),username=d=>d.username||d.legacyUsername||'';
const id=v=>{if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)<1)fail('Invalid member ID');return Number(v);};
export function createBinaryTree(db){
 async function descendants(client,owner){return (await client.query(`WITH RECURSIVE tree AS (SELECT user_id,parent_id,position,0 depth,ARRAY[user_id] path FROM member_profiles WHERE user_id=$1 UNION ALL SELECT p.user_id,p.parent_id,p.position,t.depth+1,t.path||p.user_id FROM member_profiles p JOIN tree t ON p.parent_id=t.user_id WHERE t.depth<64 AND NOT p.user_id=ANY(t.path)) SELECT r.id,r.data->>'name' name,COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername') username,r.data->>'status' status,r.data->>'legacyUsername' legacy_username,r.data->'sourceTree' source_tree,p.parent_id,p.position,t.depth,a.data->>'name' rank FROM tree t JOIN records r ON r.id=t.user_id AND r.kind='users' JOIN member_profiles p ON p.user_id=r.id LEFT JOIN records a ON a.id=p.affiliate_rank_id ORDER BY t.depth,r.id LIMIT 5000`,[id(owner)])).rows;}
 async function owner(client,ownerId){const r=(await client.query("SELECT r.*,p.permissions FROM records r JOIN member_profiles p ON p.user_id=r.id WHERE r.kind='users' AND r.id=$1",[id(ownerId)])).rows[0];if(!r||r.data.status!=='Active'||!r.permissions.includes('profile'))fail('Member network access is not enabled',403);return r;}
 const childrenKnown=n=>n.source_tree?.childrenKnown===true||!n.legacy_username;
 async function tree(ownerId,targetUsername='',q=''){
  await owner(db,ownerId);const all=await descendants(db,ownerId),byId=new Map(all.map(n=>[Number(n.id),n]));
  const root=targetUsername?all.find(n=>n.username.toLowerCase()===String(targetUsername).toLowerCase()):byId.get(Number(ownerId));if(!root)fail('This member is outside your recorded network',403);
  const children=new Map();for(const n of all){const parent=Number(n.parent_id);if(!children.has(parent))children.set(parent,{});children.get(parent)[n.position]=n;}
  const clean=n=>({id:Number(n.id),name:n.name,username:n.username,status:n.status,rank:n.rank||'No rank',parentId:n.parent_id?Number(n.parent_id):null,position:n.position,childrenKnown:childrenKnown(n)});
  const nodes=[];const visit=(n,depth,path)=>{nodes.push({...clean(n),depth,path});if(depth<3)for(const [side,symbol] of [['Left','L'],['Right','R']]){const c=children.get(Number(n.id))?.[side];if(c)visit(c,depth+1,path+symbol);}};visit(root,0,'');
  const next=side=>{let cursor=root;const visited=new Set();while(cursor&&!visited.has(Number(cursor.id))){visited.add(Number(cursor.id));const child=children.get(Number(cursor.id))?.[side];if(child){cursor=child;continue;}return childrenKnown(cursor)&&cursor.status==='Active'?{parentId:Number(cursor.id),parentUsername:cursor.username,position:side}:null;}return null;};
  const branchCount=side=>{const c=children.get(Number(root.id))?.[side];if(!c)return 0;return all.filter(n=>{let cursor=n;while(cursor&&Number(cursor.id)!==Number(c.id))cursor=byId.get(Number(cursor.parent_id));return !!cursor;}).length;};
  return {owner:clean(byId.get(Number(ownerId))),root:clean(root),nodes,next:{Left:next('Left'),Right:next('Right')},summary:{earth:branchCount('Left'),sky:branchCount('Right')},parent:root.parent_id&&byId.has(Number(root.parent_id))?clean(byId.get(Number(root.parent_id))):null,matches:q?all.filter(n=>[n.username,n.name].some(s=>s?.toLowerCase().includes(String(q).slice(0,60).toLowerCase()))).slice(0,30).map(clean):[],limit:5000};
 }
 async function slot(client,ownerId,parentId,position){
  const o=await owner(client,ownerId);if(!['Left','Right'].includes(position))fail('Choose Earth or Sky');
  const all=await descendants(client,ownerId),parent=all.find(n=>Number(n.id)===id(parentId));if(!parent)fail('Placement must be inside your own network',403);if(parent.status!=='Active')fail('This placement parent is inactive');
  if(all.some(n=>Number(n.parent_id)===Number(parent.id)&&n.position===position))fail('This position is already occupied. Refresh the tree.',409);
  if(!childrenKnown(parent))fail('This branch has not been imported completely. Ask administration to verify the position.',409);return {o,parent};
 }
 async function invite(ownerId,input){const token=randomBytes(32).toString('hex');await db.transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(76241905)');await slot(c,ownerId,input.parentId,input.position);await c.query('INSERT INTO member_referral_invites(token,owner_id,parent_id,position) VALUES($1,$2,$3,$4)',[digest(token),ownerId,input.parentId,input.position]);});return {token,expiresInDays:7};}
 async function invitation(token,client=db,lock=false){if(!/^[a-f0-9]{64}$/.test(String(token)))fail('Invalid invitation',404);const r=(await client.query('SELECT * FROM member_referral_invites WHERE token=$1 AND expires_at>now() AND used_by IS NULL'+(lock?' FOR UPDATE':''),[digest(token)])).rows[0];if(!r)fail('Invitation has expired or has already been used',410);return r;}
 async function inviteInfo(token){const i=await invitation(token);const {o,parent}=await slot(db,i.owner_id,i.parent_id,i.position);return {referrer:username(o.data),parent:parent.username,position:i.position,expiresAt:i.expires_at};}
 async function register(ownerId,input,{token,ip='local'}={}){
  const attempt=(await db.query("INSERT INTO login_attempts(ip,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.attempts+1 END,expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING attempts",['registration:'+ip])).rows[0];if(attempt.attempts>20)fail('Too many registrations. Try again in 15 minutes.',429);
  const first=String(input.firstName||'').trim(),last=String(input.lastName||'').trim(),email=String(input.email||'').trim().toLowerCase(),name=String(input.username||'').trim(),phone=String(input.phone||'').trim();
  if(!first||!last||first.length>100||last.length>100)fail('Enter first and last name');if(!/^[a-zA-Z0-9_.-]{3,60}$/.test(name))fail('Username needs 3–60 letters, numbers, dots, underscores or hyphens');if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email');if(phone.length>40)fail('Phone is too long');
  if(typeof input.password!=='string'||input.password.length<6||input.password.length>256||input.password!==input.confirmation)fail('Matching passwords of 6–256 characters are required');
  const salt=randomBytes(16).toString('hex'),hash=(await derive(input.password,salt,64)).toString('hex');
  const location=locationOf(input.location);
  return db.transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(76241905)');let invitationRow;if(token){invitationRow=await invitation(token,c,true);ownerId=invitationRow.owner_id;input={...input,parentId:invitationRow.parent_id,position:invitationRow.position};}
   const {o,parent}=await slot(c,ownerId,input.parentId,input.position);
   const duplicate=await c.query("SELECT 1 FROM records WHERE kind='users' AND (lower(COALESCE(NULLIF(data->>'username',''),data->>'legacyUsername'))=lower($1) OR lower(data->>'email')=$2)",[name,email]);if(duplicate.rowCount)fail('Username or email is already registered',409);
   const data={name:first+' '+last,username:name,email,phone,sponsor:username(o.data),status:'Active',sourceTree:{childrenKnown:true},createdVia:'Member referral',location,country:'NP'};
   const r=(await c.query("INSERT INTO records(kind,data) VALUES('users',$1) RETURNING id",[data])).rows[0];
   await c.query('UPDATE member_profiles SET first_name=$1,last_name=$2,referrer_id=$3,parent_id=$4,position=$5 WHERE user_id=$6',[first,last,ownerId,parent.id,input.position,r.id]);
   await persistLocation(c,r.id,location);
   await c.query('INSERT INTO member_credentials(user_id,salt,password_hash,version,must_change_password) VALUES($1,$2,$3,$4,$5)',[r.id,salt,hash,randomBytes(16).toString('hex'),!token]);
   if(invitationRow)await c.query('UPDATE member_referral_invites SET used_by=$1 WHERE token=$2',[r.id,invitationRow.token]);
   await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Created referral member','users',$1,$2)",[r.id,{actor:Number(ownerId),parentId:Number(parent.id),position:input.position,invitation:!!token,financialCredit:false}]);
   return {id:Number(r.id),username:name,mustChangePassword:!token};
  });
 }
 return {tree,invite,inviteInfo,register};
}
