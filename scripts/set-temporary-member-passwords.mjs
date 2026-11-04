import {randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {createDatabase,migrate} from '../src/database.mjs';
const derive=promisify(scrypt),db=createDatabase();
// Password is read from stdin so it never appears in command-line process arguments.
let password='';for await(const chunk of process.stdin)password+=chunk;password=password.replace(/[\r\n]+$/,'');
if(!password||password.length>256)throw Error('Provide the requested temporary password through stdin.');
try{await migrate(db);const users=(await db.query("SELECT id FROM records WHERE kind='users' ORDER BY id")).rows;
  const hashes=[];for(const u of users){const salt=randomBytes(16).toString('hex');hashes.push({id:u.id,salt,hash:(await derive(password,salt,64)).toString('hex'),version:randomBytes(16).toString('hex')});}
  await db.transaction(async client=>{await client.query('SELECT pg_advisory_xact_lock(76241906)');for(const u of hashes){await client.query('INSERT INTO member_credentials(user_id,salt,password_hash,version,must_change_password) VALUES($1,$2,$3,$4,true) ON CONFLICT(user_id) DO UPDATE SET salt=EXCLUDED.salt,password_hash=EXCLUDED.password_hash,version=EXCLUDED.version,must_change_password=true,updated_at=now()',[u.id,u.salt,u.hash,u.version]);await client.query('DELETE FROM member_sessions WHERE user_id=$1',[u.id]);await client.query("INSERT INTO audit(action,kind,record_id) VALUES('Assigned temporary member password','users',$1)",[u.id]);}});
  console.log(JSON.stringify({membersUpdated:hashes.length,mustChangePasswordOnLogin:true}));
}finally{password='';await db.close();}
