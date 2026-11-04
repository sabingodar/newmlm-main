import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
const exec=promisify(execFile),root=resolve('data'),cluster=join(root,'postgres');
const bin=process.env.PG_BIN||(process.platform==='win32'?'C:\\Program Files\\PostgreSQL\\17\\bin':'/usr/lib/postgresql/17/bin');
const exe=name=>join(bin,name+(process.platform==='win32'?'.exe':''));
if(!existsSync(exe('pg_ctl')))throw Error('Install PostgreSQL 17 and set PG_BIN to its bin directory, or use docker compose up -d database.');
mkdirSync(root,{recursive:true});
let password;
if(!existsSync(join(cluster,'PG_VERSION'))){
  password=randomBytes(24).toString('hex');const file=join(root,'postgres-init-password');writeFileSync(file,password,{mode:0o600});
  await exec(exe('initdb'),['-D',cluster,'-U','dls','--pwfile='+file,'--auth=scram-sha-256','--encoding=UTF8','--locale=C'],{windowsHide:true});
}
if(!process.env.DATABASE_URL){
  password??=readFileSync(join(root,'postgres-init-password'),'utf8').trim();
  const url=`postgresql://dls:${password}@127.0.0.1:55432/dynamic_life`;
  const content=existsSync('.env')?readFileSync('.env','utf8'):'';
  writeFileSync('.env',content.replace(/^DATABASE_URL=.*(?:\r?\n|$)/gm,'')+'\nDATABASE_URL='+url+'\n');
  process.env.DATABASE_URL=url;
}
const connection=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(connection.hostname)||connection.port!=='55432')throw Error('db:local manages only localhost port 55432. External DATABASE_URL was not changed.');
try{await exec(exe('pg_ctl'),['-D',cluster,'status'],{windowsHide:true});}
catch{await exec(exe('pg_ctl'),['-D',cluster,'-l',join(root,'postgres-server.log'),'-o','-p 55432 -h 127.0.0.1','-w','start'],{windowsHide:true});}
connection.pathname='/postgres';const pool=new pg.Pool({connectionString:connection.toString()});
try{if(!(await pool.query("SELECT 1 FROM pg_database WHERE datname='dynamic_life'")).rowCount)await pool.query('CREATE DATABASE dynamic_life');}
finally{await pool.end();}
console.log('Local PostgreSQL is ready at 127.0.0.1:55432. Run npm start.');
