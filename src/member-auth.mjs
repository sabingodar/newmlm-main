import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {digest} from './auth.mjs';
import {fail} from './validation.mjs';
const derive=promisify(scrypt);
export function createMemberAuth(db){
  async function login(input,ip,userAgent){
    const rate=(await db.query(`INSERT INTO login_attempts(ip,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.attempts+1 END,expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING attempts`,['member:'+ip])).rows[0];
    if(rate.attempts>10)fail('Too many attempts. Try again in 15 minutes.',429);
    const u=(await db.query("SELECT r.id,r.data,c.salt,c.password_hash,c.version FROM records r LEFT JOIN member_credentials c ON c.user_id=r.id WHERE r.kind='users' AND lower(COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername'))=lower($1)",[String(input.username||'').slice(0,60)])).rows[0];
    const actual=await derive(String(input.password||'').slice(0,256),u?.salt||'member-dummy-salt',64);
    const success=!!u?.password_hash&&u.data.status==='Active'&&timingSafeEqual(actual,Buffer.from(u.password_hash,'hex'));
    if(u)await db.query('INSERT INTO member_login_history(user_id,ip,user_agent,success) VALUES($1,$2,$3,$4)',[u.id,ip,String(userAgent||'').slice(0,500),success]);
    if(!success)fail('Incorrect credentials or inactive account',401);
    const token=randomBytes(32).toString('hex');await db.query('DELETE FROM login_attempts WHERE ip=$1',['member:'+ip]);
    await db.query('DELETE FROM member_sessions WHERE expires_at<now()');
    await db.query("INSERT INTO member_sessions(token,user_id,credential_version,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[digest(token),u.id,u.version]);return token;
  }
  async function session(cookie){
    const token=cookie?.match(/(?:^|;\s*)member_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)fail('Please sign in',401);
    const row=(await db.query("SELECT s.user_id,s.credential_version,c.must_change_password,r.data,p.permissions FROM member_sessions s JOIN member_credentials c ON c.user_id=s.user_id AND c.version=s.credential_version JOIN records r ON r.id=s.user_id JOIN member_profiles p ON p.user_id=s.user_id WHERE s.token=$1 AND s.expires_at>now() AND r.data->>'status'='Active'",[digest(token)])).rows[0];if(!row)fail('Please sign in',401);return {...row,token:digest(token)};
  }
  async function changePassword(member,input){
    if(typeof input.password!=='string'||input.password.length<6||input.password.length>256||input.password!==input.confirmation)fail('New passwords must match and contain 6–256 characters');
    return db.transaction(async client=>{
      const user=(await client.query("SELECT data FROM records WHERE kind='users' AND id=$1 FOR UPDATE",[member.user_id])).rows[0];if(user?.data.status!=='Active')fail('Account is inactive',403);
      const old=(await client.query('SELECT * FROM member_credentials WHERE user_id=$1 FOR UPDATE',[member.user_id])).rows[0];
      if(!old||old.version!==member.credential_version)fail('Please sign in again',401);
      if(!timingSafeEqual(await derive(String(input.currentPassword||'').slice(0,256),old.salt,64),Buffer.from(old.password_hash,'hex')))fail('Current password is incorrect');
      if(input.password===input.currentPassword)fail('Choose a different new password');
      const salt=randomBytes(16).toString('hex'),hash=(await derive(input.password,salt,64)).toString('hex');
      await client.query('UPDATE member_credentials SET salt=$1,password_hash=$2,version=$3,must_change_password=false,updated_at=now() WHERE user_id=$4',[salt,hash,randomBytes(16).toString('hex'),member.user_id]);
      await client.query('DELETE FROM member_sessions WHERE user_id=$1',[member.user_id]);
      await client.query("INSERT INTO audit(action,kind,record_id) VALUES('Member changed own password','users',$1)",[member.user_id]);return {ok:true};
    });
  }
  return {login,session,changePassword};
}
