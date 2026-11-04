import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required. Run npm run db:local or configure PostgreSQL.');
  const max = Number(process.env.DB_POOL_MAX || 10);
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('DB_POOL_MAX must be 1–100.');
  const pool = new pg.Pool({connectionString,max,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,
    statement_timeout:15000,application_name:'dynamic-life-success',
    ...(process.env.DATABASE_CA?{ssl:{ca:process.env.DATABASE_CA, rejectUnauthorized:true}}:{})});
  pool.on('error', error => console.error('Idle PostgreSQL connection failed:', error.code || 'connection error'));
  async function transaction(work) {
    const client = await pool.connect();
    try {await client.query('BEGIN');const value = await work(client);await client.query('COMMIT');return value;}
    catch (error) {await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally {client.release();}
  }
  return {pool,query:(...args)=>pool.query(...args),transaction,close:()=>pool.end()};
}

export async function migrate(db) {
  await db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(76241901)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const root = new URL('../migrations/',import.meta.url);
    for (const name of (await readdir(root)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
      const sql=await readFile(new URL(name,root),'utf8');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const existing=await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
      if(existing.rowCount) {if(existing.rows[0].checksum!==checksum)throw new Error(`Applied migration changed: ${name}`);continue;}
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)',[name,checksum]);
    }
  });
}
