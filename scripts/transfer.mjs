import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createDatabase,migrate} from '../src/database.mjs';
const [mode,file]=process.argv.slice(2);
if(!['export','restore'].includes(mode)||!file)throw Error('Usage: npm run db:export -- data/backup.json OR npm run db:restore -- data/backup.json');
const memberTables=['member_profiles','member_accounts','member_ledger','member_credentials','member_login_history','member_notifications','member_checkouts','coordinator_assignments'];
const tables=['records','audit','settings','archive','data_imports','import_staging','media_assets','product_categories',...memberTables,'shop_coupons','member_reward_accounts','member_reward_ledger','coupon_redemptions','mail_settings'];
const db=createDatabase();
try {
  await migrate(db);
  if(mode==='export') {
    const snapshot=await db.transaction(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const data={};for(const table of tables){const rows=(await client.query(`SELECT * FROM ${table}${table==='product_categories'?' ORDER BY parent_id NULLS FIRST,id':''}`)).rows;data[table]=table==='media_assets'?rows.map(r=>({...r,content:r.content.toString('base64')})):rows;}
      return {format:'dls-postgres-v9',createdAt:new Date().toISOString(),tables:data};
    });
    await writeFile(resolve(file),JSON.stringify(snapshot,null,2),{flag:'wx',mode:0o600});
    console.log('Portable backup created. Keep private: includes member password hashes; administrator credentials and all sessions are excluded.');
  } else {
    const snapshot=JSON.parse(await readFile(resolve(file),'utf8'));
    if(!['dls-postgres-v1','dls-postgres-v2','dls-postgres-v3','dls-postgres-v4','dls-postgres-v5','dls-postgres-v6','dls-postgres-v7','dls-postgres-v8','dls-postgres-v9'].includes(snapshot.format)||!snapshot.tables)throw Error('Unsupported backup format');
    if(snapshot.format==='dls-postgres-v1')snapshot.tables.media_assets=[];
    if(!['dls-postgres-v3','dls-postgres-v4','dls-postgres-v5','dls-postgres-v6','dls-postgres-v7','dls-postgres-v8','dls-postgres-v9'].includes(snapshot.format))for(const table of memberTables)snapshot.tables[table]=[];
    if(!['dls-postgres-v4','dls-postgres-v5','dls-postgres-v6','dls-postgres-v7','dls-postgres-v8','dls-postgres-v9'].includes(snapshot.format))snapshot.tables.member_checkouts=[];
    if(!['dls-postgres-v5','dls-postgres-v6','dls-postgres-v7','dls-postgres-v8','dls-postgres-v9'].includes(snapshot.format))snapshot.tables.coordinator_assignments=[];
    if(!['dls-postgres-v6','dls-postgres-v7','dls-postgres-v8','dls-postgres-v9'].includes(snapshot.format))snapshot.tables.product_categories=[];
    if(!['dls-postgres-v8','dls-postgres-v9'].includes(snapshot.format))for(const table of ['shop_coupons','member_reward_accounts','member_reward_ledger','coupon_redemptions'])snapshot.tables[table]=[];
    if(snapshot.format!=='dls-postgres-v9')snapshot.tables.mail_settings=[];
    for(const row of snapshot.tables.product_categories)row.image_url??='';
    const columns={mail_settings:['id','data'],shop_coupons:['id','code','discount_type','value','minimum_amount','maximum_discount','usage_limit','per_member_limit','starts_at','ends_at','active','version','created_at'],member_reward_accounts:['user_id','balance'],member_reward_ledger:['id','user_id','amount','balance_after','reference','reason','order_id','created_at'],coupon_redemptions:['order_id','coupon_id','user_id','discount','released','created_at'],product_categories:['id','parent_id','name','created_at','image_url'],coordinator_assignments:['id','user_id','role','country','province_id','district_id','city_id','created_at'],records:['id','kind','data','created_at','updated_at','version'],audit:['id','action','kind','record_id','created_at','details'],settings:['id','data'],archive:['kind','data'],data_imports:['name','created_at'],import_staging:['kind','data'],media_assets:['id','name','mime_type','content','created_at'],member_profiles:['user_id','first_name','last_name','address','city','state','postal_code','country','email_verified','mobile_verified','kyc_status','affiliate_rank_id','referrer_id','parent_id','position','notes','ban_reason','permissions'],member_accounts:['user_id','opening_balance','balance'],member_ledger:['id','user_id','direction','amount','balance_after','reason','request_id','actor','created_at'],member_credentials:['user_id','salt','password_hash','version','updated_at','must_change_password'],member_login_history:['id','user_id','ip','user_agent','success','created_at'],member_notifications:['id','user_id','title','message','actor','created_at'],member_checkouts:['user_id','request_key','fingerprint','order_id','created_at']};
    await db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(76241902)');
      for(const table of tables.filter(t=>t!=='settings'))if(Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count)!==0)throw Error('Restore requires an empty database. Existing data will not be overwritten.');
      for(const table of tables){
        if(!Array.isArray(snapshot.tables[table]))throw Error('Missing backup table: '+table);
        const keys=columns[table];
        for(const row of snapshot.tables[table]) {
          const values=keys.map(k=>['data','details','permissions'].includes(k)?JSON.stringify(row[k]??{}):table==='media_assets'&&k==='content'?Buffer.from(row[k],'base64'):row[k]);
          const conflict=table==='settings'?' ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data':['member_profiles','member_accounts'].includes(table)?' ON CONFLICT(user_id) DO UPDATE SET '+keys.filter(k=>k!=='user_id').map(k=>`${k}=EXCLUDED.${k}`).join(','):'';
          await client.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})${conflict}`,values);
        }
      }
      for(const table of ['records','audit','member_ledger','member_login_history','member_notifications','coordinator_assignments','product_categories','shop_coupons','member_reward_ledger'])await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE(MAX(id),1),MAX(id) IS NOT NULL) FROM ${table}`);
      const inconsistent=await client.query("SELECT a.user_id FROM member_accounts a LEFT JOIN member_ledger l ON l.user_id=a.user_id GROUP BY a.user_id,a.balance,a.opening_balance HAVING a.balance<>a.opening_balance+COALESCE(sum(CASE WHEN l.direction='Credit' THEN l.amount ELSE -l.amount END),0) LIMIT 1");
      if(inconsistent.rowCount)throw Error('Backup balance and ledger do not reconcile; restore rolled back.');
      const rewards=await client.query('SELECT a.user_id FROM member_reward_accounts a LEFT JOIN member_reward_ledger l ON l.user_id=a.user_id GROUP BY a.user_id,a.balance HAVING a.balance<>COALESCE(sum(l.amount),0) LIMIT 1');if(rewards.rowCount)throw Error('Reward balance and ledger do not reconcile; restore rolled back.');
    });
    console.log('Portable backup restored. Record IDs, settings, audit history and source archives preserved.');
  }
}finally{await db.close();}
