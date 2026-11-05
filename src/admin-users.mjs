import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {fail} from './validation.mjs';
import {adminRoles,permissionGroups,validateOverrides,validatePermissions,isCenterManager} from './admin-permissions.mjs';
const derive=promisify(scrypt);
const publicColumns='username,name,email,role,status,center_id,is_owner,version,created_at,updated_at,permission_overrides,must_change_password,import_metadata';
const expose=r=>({...r,centerId:r.center_id==null?null:Number(r.center_id),isOwner:r.is_owner});
export function createAdminUsers(db){
 async function list(filters={}){
  const args=[],where=['a.deleted_at IS NULL'];
  for(const key of ['role','status'])if(filters[key]){if(!(key==='role'?adminRoles:['Active','Inactive']).includes(filters[key]))fail('Invalid administrator filter');args.push(filters[key]);where.push(`a.${key}=$${args.length}`);}
  if(filters.q){args.push('%'+String(filters.q).slice(0,150).replace(/[\\%_]/g,'\\$&')+'%');where.push(`(a.username ILIKE $${args.length} OR a.name ILIKE $${args.length} OR a.email ILIKE $${args.length})`);}
  const page=Number(filters.page||1),limit=20;if(!Number.isSafeInteger(page)||page<1)fail('Invalid page');
  const total=Number((await db.query('SELECT count(*) FROM administrators a WHERE '+where.join(' AND '),args)).rows[0].count);
  const rows=(await db.query(`SELECT ${publicColumns.split(',').map(k=>'a.'+k).join(',')},c.data->>'name' AS center_name FROM administrators a LEFT JOIN records c ON c.id=a.center_id AND c.kind='centers' WHERE ${where.join(' AND ')} ORDER BY a.is_owner DESC,a.created_at DESC,a.username ASC LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,(page-1)*limit])).rows;
  return {items:rows.map(expose),page,limit,total};
 }
 async function save(username,input,actor){
  const text=(key,max)=>{if(typeof input[key]!=='string'||input[key].length>max)fail('Invalid administrator '+key);return input[key].trim();};
  const name=text('name',150),email=text('email',254),role=input.role,status=input.status,overrides=validateOverrides(input.permissionOverrides||{allow:[],deny:[]});
  if(!name||!adminRoles.includes(role)||!['Active','Inactive'].includes(status)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid name, email, role and status');
  const login=username||text('username',60);if(!/^[A-Za-z0-9_.-]{3,60}$/.test(login))fail('Username must contain 3–60 letters, numbers, dots, hyphens or underscores');
  const password=input.password??'';if(typeof password!=='string'||password.length>256||password&&password.length<6||!username&&!password)fail('Password must contain at least 6 characters');
  let salt,hash;if(password){salt=randomBytes(16).toString('hex');hash=(await derive(password,salt,64)).toString('hex');}
  const centerId=isCenterManager({role})?Number(input.centerId):null;if(isCenterManager({role})&&(!Number.isSafeInteger(centerId)||centerId<=0))fail('Assign a center to this manager');
  return db.transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(76241905)');
   const old=username?(await c.query('SELECT * FROM administrators WHERE username=$1 FOR UPDATE',[username])).rows[0]:null;
   if(username&&(!old||old.deleted_at))fail('Administrator not found',404);
   if(old&&Number(input.version)!==old.version)fail('Administrator changed. Reload before editing.',409);
   if(!old&&(await c.query('SELECT username FROM administrators WHERE lower(username)=lower($1)',[login])).rowCount)fail('This administrator username already exists',409);
   if(old?.is_owner&&(role!=='Admin'||status!=='Active'||password||overrides.allow.length||overrides.deny.length))fail('The primary administrator stays active with full access; use Change password to update your own password');
   if(old?.username===actor.username&&(role!==old.role||status!=='Active'))fail('You cannot deactivate or change your own administrator role');
   if(centerId&&!(await c.query("SELECT id FROM records WHERE id=$1 AND kind='centers' AND (data->>'status'='Active' OR $3::boolean) AND COALESCE(data->>'centerType','Dispatch Center')=$2 FOR SHARE",[centerId,role==='Dispatch Center Manager'?'Dispatch Center':'Service Center',!!old&&Number(old.center_id)===centerId&&old.role===role])).rowCount)fail('Choose an active center');
   const changed=!old||!!password||old.role!==role||old.status!==status||Number(old.center_id||0)!==Number(centerId||0)||JSON.stringify(old.permission_overrides)!==JSON.stringify(overrides);
   const values=[login,name,email,role,status,centerId,JSON.stringify(overrides),salt||old?.salt,hash||old?.password_hash,changed?randomBytes(16).toString('hex'):old.credential_version];
   const row=(await c.query(old?`UPDATE administrators SET name=$2,email=$3,role=$4,status=$5,center_id=$6,permission_overrides=$7,salt=$8,password_hash=$9,credential_version=$10,version=version+1,updated_at=now() WHERE username=$1 RETURNING ${publicColumns}`:`INSERT INTO administrators(username,name,email,role,status,center_id,permission_overrides,salt,password_hash,credential_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${publicColumns}`,values)).rows[0];
   if(old?.import_metadata?.accessReview&&(old.role!==role||JSON.stringify(old.permission_overrides)!==JSON.stringify(overrides))){const metadata={...old.import_metadata,accessReview:false,reviewedAt:new Date().toISOString()};await c.query('UPDATE administrators SET import_metadata=$2 WHERE username=$1',[login,JSON.stringify(metadata)]);row.import_metadata=metadata;}
   if(changed&&old)await c.query('DELETE FROM sessions WHERE username=$1',[login]);
   await c.query("INSERT INTO audit(action,kind,details) VALUES($1,'administrators',$2)",[old?'Updated administrator':'Created administrator',{actor:actor.username,username:login,role,status,centerId,permissions:overrides,passwordChanged:!!password}]);
   return expose(row);
  });
 }
 async function remove(username,input,actor){return db.transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(76241905)');const old=(await c.query('SELECT * FROM administrators WHERE username=$1 FOR UPDATE',[username])).rows[0];
  if(!old||old.deleted_at)fail('Administrator not found',404);if(Number(input.version)!==old.version)fail('Administrator changed. Reload before deleting.',409);
  if(old.is_owner||username===actor.username)fail('You cannot delete the primary administrator or your own account');
  await c.query("UPDATE administrators SET status='Inactive',deleted_at=now(),version=version+1,credential_version=$2,updated_at=now() WHERE username=$1",[username,randomBytes(16).toString('hex')]);
  await c.query('DELETE FROM sessions WHERE username=$1',[username]);await c.query("INSERT INTO audit(action,kind,details) VALUES('Deleted administrator','administrators',$1)",[{actor:actor.username,username}]);return {ok:true};
 });}
 async function roles(){return {roles:adminRoles,groups:permissionGroups,items:(await db.query('SELECT * FROM admin_role_permissions ORDER BY role')).rows};}
 async function saveRole(role,input,actor){if(role==='Admin'||!adminRoles.includes(role))fail('Admin always has full access');const permissions=validatePermissions(input.permissions);return db.transaction(async c=>{
  const old=(await c.query('SELECT * FROM admin_role_permissions WHERE role=$1 FOR UPDATE',[role])).rows[0];if(!old)fail('Role not found',404);if(Number(input.version)!==old.version)fail('Role permissions changed. Reload before editing.',409);
  const row=(await c.query('UPDATE admin_role_permissions SET permissions=$2,version=version+1 WHERE role=$1 RETURNING *',[role,JSON.stringify(permissions)])).rows[0];
  await c.query('DELETE FROM sessions WHERE username IN (SELECT username FROM administrators WHERE role=$1)',[role]);
  await c.query("INSERT INTO audit(action,kind,details) VALUES('Updated role permissions','administrators',$1)",[{actor:actor.username,role,permissions}]);return row;
 });}
 async function changePassword(actor,input){const password=input.password,current=input.currentPassword;if(typeof password!=='string'||password.length<6||password.length>256||password!==input.confirmation||typeof current!=='string'||current.length>256||password===current)fail('Choose and confirm a different password of at least 6 characters');const rateKey='admin-password:'+actor.username,rate=(await db.query("INSERT INTO login_attempts(ip,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.attempts+1 END,expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING attempts",[rateKey])).rows[0];if(rate.attempts>10)fail('Too many password change attempts. Try again in 15 minutes.',429);return db.transaction(async c=>{const old=(await c.query('SELECT * FROM administrators WHERE username=$1 FOR UPDATE',[actor.username])).rows[0];if(!old||old.status!=='Active'||old.deleted_at||old.credential_version!==(await c.query('SELECT credential_version FROM sessions WHERE token=$1',[actor.token])).rows[0]?.credential_version)fail('Sign in again',401);const actual=await derive(current,old.salt,64);if(!timingSafeEqual(actual,Buffer.from(old.password_hash,'hex')))fail('Current password is incorrect');const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');await c.query('UPDATE administrators SET salt=$2,password_hash=$3,credential_version=$4,must_change_password=false,password_managed_in_app=CASE WHEN is_owner THEN true ELSE password_managed_in_app END,version=version+1,updated_at=now() WHERE username=$1',[actor.username,salt,hash,randomBytes(16).toString('hex')]);await c.query('DELETE FROM sessions WHERE username=$1',[actor.username]);await c.query('DELETE FROM login_attempts WHERE ip=$1',[rateKey]);await c.query("INSERT INTO audit(action,kind,details) VALUES('Administrator changed own password','administrators',$1)",[{username:actor.username}]);return {ok:true};});}
 return {list,save,remove,roles,saveRole,changePassword};
}
