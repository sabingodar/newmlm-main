import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {fail} from './validation.mjs';
const derive=promisify(scrypt);
export const digest=token=>createHash('sha256').update(token).digest('hex');
export async function initializeAdmin(db,username,password) {
  if(!password||password.length<12)throw Error('Set ADMIN_PASSWORD to at least 12 characters.');
  await db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(76241904)');
    const old=(await client.query('SELECT * FROM administrators WHERE username=$1 FOR UPDATE',[username])).rows[0];
    if(old?.is_owner&&old.password_managed_in_app){await client.query("UPDATE administrators SET role='Admin',status='Active',deleted_at=NULL WHERE username=$1",[username]);return;}
    if(old&&timingSafeEqual(await derive(password,old.salt,64),Buffer.from(old.password_hash,'hex'))){await client.query("UPDATE administrators SET is_owner=true,role='Admin',status='Active',deleted_at=NULL WHERE username=$1",[username]);return;}
    const salt=randomBytes(16).toString('hex');const hash=(await derive(password,salt,64)).toString('hex');
    await client.query("INSERT INTO administrators(username,salt,password_hash,credential_version,is_owner,name) VALUES($1,$2,$3,$4,true,$1) ON CONFLICT(username) DO UPDATE SET salt=EXCLUDED.salt,password_hash=EXCLUDED.password_hash,credential_version=EXCLUDED.credential_version,is_owner=true,role='Admin',status='Active',deleted_at=NULL",[username,salt,hash,randomBytes(16).toString('hex')]);
    await client.query('DELETE FROM sessions WHERE username=$1',[username]);
  });
}
export function createAuth(db,username) {
  async function login(ip,input) {
    const rate=await db.query(`INSERT INTO login_attempts(ip,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.attempts+1 END,
      expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING attempts`,[ip]);
    if(rate.rows[0].attempts>10)fail('Too many attempts. Try again in 15 minutes.',429);
    const user=(await db.query('SELECT * FROM administrators WHERE username=$1',[String(input.username||'')])).rows[0];
    const actual=await derive(String(input.password||'').slice(0,1000),user?.salt||'dummy-authentication-salt',64);
    if(!user||user.status!=='Active'||user.deleted_at||!timingSafeEqual(actual,Buffer.from(user.password_hash,'hex')))fail('Incorrect username or password',401);
    const token=randomBytes(32).toString('hex');
    await db.query('DELETE FROM login_attempts WHERE ip=$1 OR expires_at<now()',[ip]);
    await db.query('DELETE FROM sessions WHERE expires_at<now()');
    await db.query("INSERT INTO sessions(token,username,credential_version,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[digest(token),user.username,user.credential_version]);
    return token;
  }
  async function principal(cookie) {
    const token=cookie?.match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)fail('Please sign in',401);
    const row=(await db.query("SELECT s.token,a.username,a.name,a.email,a.role,a.center_id,a.is_owner,a.permission_overrides,a.must_change_password,a.import_metadata FROM sessions s JOIN administrators a ON a.username=s.username AND a.credential_version=s.credential_version WHERE s.token=$1 AND s.expires_at>now() AND a.status='Active' AND a.deleted_at IS NULL",[digest(token)])).rows[0];
    if(!row)fail('Please sign in',401);return {...row,centerId:row.center_id==null?null:Number(row.center_id),isOwner:row.is_owner};
  }
  async function authenticate(cookie){return (await principal(cookie)).token;}
  return {login,authenticate,principal};
}
