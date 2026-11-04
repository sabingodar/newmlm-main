import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {createDatabase,migrate} from '../src/database.mjs';
import {initializeAdmin,createAuth} from '../src/auth.mjs';
import {createMembers} from '../src/members.mjs';
const execute=promisify(execFile);
test('portable export/restore preserves data and IDs and refuses non-empty destinations',async()=>{
  const admin=createDatabase(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);
  const suffix=randomBytes(6).toString('hex'),names=['dls_source_'+suffix,'dls_target_'+suffix];
  const dir=await mkdtemp(join(tmpdir(),'dls-portable-'));const clients=[];
  try{
    for(const name of names)await admin.query('CREATE DATABASE '+name);
    const urls=names.map(name=>{const u=new URL(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);u.pathname='/'+name;return u.toString();});
    for(const url of urls){const db=createDatabase(url);clients.push(db);await migrate(db);}
    const source=clients[0],target=clients[1];await migrate(source);await source.query('INSERT INTO mail_settings(id,data) VALUES(1,$1)',[{enabled:false,password:'encrypted-fixture'}]);
    await source.query("INSERT INTO records(id,kind,data) VALUES(42,'users',$1)",[{name:'Portable member',email:'member@example.test',status:'Active',customMetadata:{preserved:true}}]);
    await source.query("INSERT INTO audit(id,action,kind,record_id) VALUES(9,'Created','users',42)");
    await source.query('INSERT INTO settings(id,data) VALUES(1,$1)',[{siteName:'Portable workspace'}]);
    await source.query('INSERT INTO archive(kind,data) VALUES($1,$2)',['source',JSON.stringify([{original:'preserved'}])]);
    await source.query("INSERT INTO data_imports(name) VALUES('legacy-admin')");
    await source.query('INSERT INTO media_assets(id,name,mime_type,content) VALUES($1,$2,$3,$4)',['c7aca960-2c4c-45c9-a278-6b9ac829fc05','logo.png','image/png',Buffer.from([137,80,78,71,13,10,26,10])]);
    await createMembers(source).action(42,'balance',{direction:'Credit',amount:'12.34',reason:'Portable fixture',requestId:'portable-request-001'},'test-admin');
    await createMembers(source).action(42,'password',{password:'PortablePassword2026!',confirmation:'PortablePassword2026!'},'test-admin');
    await source.query("INSERT INTO records(id,kind,data) VALUES(43,'orders',$1)",[{customer:'Portable member',userId:42,status:'Pending',amount:1}]);
    await source.query('INSERT INTO member_checkouts(user_id,request_key,fingerprint,order_id) VALUES($1,$2,$3,$4)',[42,'portable-checkout-001','fixture-fingerprint',43]);
    await source.query("INSERT INTO coordinator_assignments(user_id,role,country) VALUES(42,'country','NP')");
    await source.query("INSERT INTO product_categories(id,name) VALUES(25,'Portable Category')");
    await source.query("INSERT INTO product_categories(id,parent_id,name) VALUES(26,25,'Portable Sub-category')");
    await source.query("INSERT INTO shop_coupons(id,code,discount_type,value) VALUES(7,'PORTABLE','Fixed',0.25)");
    await source.query("INSERT INTO member_reward_accounts(user_id,balance) VALUES(42,11.34)");
    await source.query("INSERT INTO member_reward_ledger(id,user_id,amount,balance_after,reference,reason) VALUES(61,42,12.34,12.34,'portable-opening','Portable reward opening')");
    await source.query("INSERT INTO member_reward_ledger(id,user_id,amount,balance_after,reference,reason,order_id) VALUES(62,42,-1,11.34,'redeem:43','Redeemed on order',43)");
    await source.query("INSERT INTO coupon_redemptions(order_id,coupon_id,user_id,discount) VALUES(43,7,42,0.25)");
    const path=join(dir,'backup.json');
    await execute(process.execPath,['scripts/transfer.mjs','export',path],{env:{...process.env,DATABASE_URL:urls[0]}});
    await execute(process.execPath,['scripts/transfer.mjs','restore',path],{env:{...process.env,DATABASE_URL:urls[1]}});
    for(const table of ['records','audit','settings','archive','data_imports','import_staging','media_assets','member_profiles','member_accounts','member_ledger','member_credentials','member_login_history','member_notifications','member_checkouts','coordinator_assignments','product_categories','shop_coupons','member_reward_accounts','member_reward_ledger','coupon_redemptions','mail_settings'])assert.deepEqual((await target.query('SELECT * FROM '+table)).rows,(await source.query('SELECT * FROM '+table)).rows);
    const added=await target.query("INSERT INTO records(kind,data) VALUES('users',$1) RETURNING id",[{name:'Next member'}]);assert.equal(Number(added.rows[0].id),44);
    await assert.rejects(execute(process.execPath,['scripts/transfer.mjs','restore',path],{env:{...process.env,DATABASE_URL:urls[1]}}));
    assert.equal(Number((await target.query('SELECT count(*) FROM records')).rows[0].count),3);
  }finally{for(const c of clients)await c.close();for(const name of names)await admin.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await admin.close();await rm(dir,{recursive:true,force:true});}
});
test('shared PostgreSQL sessions survive app initialization and password rotation revokes them',async()=>{
  const admin=createDatabase(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);const name='dls_auth_'+randomBytes(6).toString('hex');let db;
  try{await admin.query('CREATE DATABASE '+name);const url=new URL(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);url.pathname='/'+name;db=createDatabase(url.toString());await migrate(db);
    await initializeAdmin(db,'admin','OriginalPassword!2026');const token=await createAuth(db,'admin').login('test-ip',{username:'admin',password:'OriginalPassword!2026'});
    await initializeAdmin(db,'admin','OriginalPassword!2026');await createAuth(db,'admin').authenticate('session='+token);
    await initializeAdmin(db,'admin','RotatedPassword!2026');await assert.rejects(createAuth(db,'admin').authenticate('session='+token),e=>e.status===401);
  }finally{if(db)await db.close();await admin.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await admin.close();}
});
