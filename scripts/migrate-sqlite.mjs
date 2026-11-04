import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {createDatabase,migrate} from '../src/database.mjs';
const source=new DatabaseSync(resolve(process.argv[2]||'data/dynamic.db'),{readOnly:true});
const db=createDatabase();
try {
  await migrate(db);source.exec('BEGIN');
  const records=source.prepare('SELECT * FROM records ORDER BY id').all();
  const audits=source.prepare('SELECT * FROM audit ORDER BY id').all();
  const settings=source.prepare('SELECT * FROM settings').all();
  const archive=source.prepare('SELECT * FROM archive').all();
  const imports=source.prepare('SELECT * FROM migrations').all();
  const summary=await db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(76241902)');
    if((await client.query("SELECT name FROM data_imports WHERE name='sqlite-v1'")).rowCount)throw Error('SQLite migration already completed. Existing PostgreSQL records were not changed.');
    if(Number((await client.query('SELECT count(*) FROM records')).rows[0].count)!==0)throw Error('Target database must be empty. Use a fresh database; no existing data will be overwritten.');
    for(const r of records)await client.query('INSERT INTO records(id,kind,data,created_at,updated_at) VALUES($1,$2,$3,$4,$4)',[r.id,r.kind,JSON.parse(r.data),r.created.replace(' ','T')+'Z']);
    for(const r of audits)await client.query('INSERT INTO audit(id,action,kind,record_id,created_at) VALUES($1,$2,$3,$4,$5)',[r.id,r.action,r.kind,r.record_id,r.created.replace(' ','T')+'Z']);
    for(const r of settings)await client.query('INSERT INTO settings(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[r.id,JSON.parse(r.data)]);
    for(const r of archive)await client.query('INSERT INTO archive(kind,data) VALUES($1,$2)',[r.kind,r.data]);
    for(const r of imports)await client.query('INSERT INTO data_imports(name,created_at) VALUES($1,$2) ON CONFLICT(name) DO NOTHING',[r.name,r.created.replace(' ','T')+'Z']);
    await client.query("INSERT INTO data_imports(name) VALUES('sqlite-v1')");
    for(const table of ['records','audit'])await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE(MAX(id),1),MAX(id) IS NOT NULL) FROM ${table}`);
    return (await client.query('SELECT kind,count(*)::integer AS count FROM records GROUP BY kind ORDER BY kind')).rows;
  });
  source.exec('COMMIT');console.log(JSON.stringify({migrated:true,counts:summary}));
}finally{source.close();await db.close();}
