import {locationOf} from './geography.mjs';
import {fail} from './validation.mjs';
export const regionalRoles={country:'Country Coordinator',province:'Province Coordinator',district:'District Coordinator',city:'City Franchise Partner'};
export function createRegions(db){
 const assignments=async userId=>(await db.query('SELECT * FROM coordinator_assignments WHERE user_id=$1 ORDER BY id',[userId])).rows;
 async function assign(userId,input){
  if(!Object.hasOwn(regionalRoles,input.role))fail('Choose a coordinator role');
  const loc=locationOf(input.location,{partial:true}),role=input.role;
  if(role!=='country'&&!loc.provinceId||['district','city'].includes(role)&&!loc.districtId||role==='city'&&!loc.cityId)fail('Choose the complete area for this role');
  return db.transaction(async c=>{
   const user=(await c.query("SELECT id FROM records WHERE id=$1 AND kind='users' AND data->>'status'='Active' FOR UPDATE",[userId])).rows[0];if(!user)fail('Choose an active member',400);
   const area=[role,'NP',role==='country'?'':loc.provinceId,['district','city'].includes(role)?loc.districtId:'',role==='city'?loc.cityId:''];
   await c.query('SELECT pg_advisory_xact_lock(76241906)');
   const existing=(await c.query('SELECT * FROM coordinator_assignments WHERE role=$1 AND country=$2 AND province_id=$3 AND district_id=$4 AND city_id=$5',area)).rows[0];
   if(existing&&Number(existing.user_id)!==Number(userId))fail('This area already has an assignee. Remove the existing assignment first.',409);
   if(existing)return existing;
   const row=(await c.query('INSERT INTO coordinator_assignments(user_id,role,country,province_id,district_id,city_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[userId,...area])).rows[0];
   await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Assigned regional coordinator','users',$1,$2)",[userId,{assignment:row}]);return row;
  });
 }
 async function remove(userId,input){if(!/^\d+$/.test(String(input.assignmentId))||!Number.isSafeInteger(Number(input.assignmentId))||Number(input.assignmentId)<1)fail('Invalid assignment ID');return db.transaction(async c=>{const row=(await c.query('DELETE FROM coordinator_assignments WHERE id=$1 AND user_id=$2 RETURNING *',[input.assignmentId,userId])).rows[0];if(!row)fail('Assignment not found',404);await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Removed regional coordinator','users',$1,$2)",[userId,{assignment:row}]);return {ok:true};});}
 async function all(){return (await db.query("SELECT a.*,r.data->>'name' AS name,COALESCE(r.data->>'username',r.data->>'legacyUsername') AS username FROM coordinator_assignments a JOIN records r ON r.id=a.user_id ORDER BY a.id")).rows;}
 async function report(userId,input={}){
  const areas=await assignments(userId);if(!areas.length)fail('No coordinator area is assigned to your account',403);
  const page=Number(input.page||1);if(!Number.isInteger(page)||page<1||page>100000)fail('Invalid page');
  const params=[JSON.stringify(areas)],filters=[];
  const add=(value,sql)=>{params.push(value);filters.push(sql.replace('?', '$'+params.length));};
  if(input.assignmentId){if(!areas.some(a=>String(a.id)===String(input.assignmentId)))fail('Area is outside your assignments',403);add(String(input.assignmentId),"a.id::text=?");}
  if(input.q)add('%'+String(input.q).slice(0,100).replace(/[\\%_]/g,'\\$&')+'%',"(u.data->>'name'||' '||COALESCE(u.data->>'username',u.data->>'legacyUsername','')) ILIKE ?");
  for(const key of ['from','to'])if(input[key]){const date=new Date(input[key]+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(input[key])||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==input[key])fail('Invalid date');}
  if(input.from&&input.to&&input.from>input.to)fail('Date range is reversed');
  const dates=[];if(input.from){params.push(input.from);dates.push(`COALESCE(o.data->>'sortDate',o.created_at::text)>=$${params.length}`);}if(input.to){params.push(input.to+'T23:59:59.999999Z');dates.push(`COALESCE(o.data->>'sortDate',o.created_at::text)<=$${params.length}`);}
  const base=`WITH areas AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS a(id text,role text,country text,province_id text,district_id text,city_id text)), scoped AS (
   SELECT DISTINCT u.id,u.data,u.created_at FROM records u JOIN areas a ON u.kind='users' AND u.data->'location'->>'country'=a.country
    AND (a.role='country' OR u.data->'location'->>'provinceId'=a.province_id)
    AND (a.role IN ('country','province') OR u.data->'location'->>'districtId'=a.district_id)
    AND (a.role<>'city' OR u.data->'location'->>'cityId'=a.city_id) ${filters.length?'WHERE '+filters.join(' AND '):''}
  ), purchase AS (
   SELECT u.id,COALESCE(sum((o.data->>'amount')::numeric),0) AS purchase,COALESCE(sum(COALESCE((o.data->>'businessAmount')::numeric,(o.data->>'amount')::numeric)),0) AS business,count(o.id)::integer AS orders
   FROM scoped u LEFT JOIN records o ON o.kind='orders' AND o.data->>'status' IN ('Confirmed','Dispatched','Out for delivery','Delivered') AND
    (o.data->>'userId'=u.id::text OR (NOT o.data ? 'userId' AND COALESCE(u.data->>'username',u.data->>'legacyUsername','')<>'' AND COALESCE(u.data->>'username',u.data->>'legacyUsername')=ANY(regexp_split_to_array(replace(COALESCE(o.data->>'customer',''),'@',''),E'\\n')))) ${dates.length?'AND '+dates.join(' AND '):''}
   GROUP BY u.id
  )`;
  const totals=(await db.query(base+' SELECT count(*)::integer AS members,COALESCE(sum(purchase),0) AS purchase,COALESCE(sum(business),0) AS business,COALESCE(sum(orders),0)::integer AS orders FROM purchase',params)).rows[0];
  const rows=(await db.query(base+` SELECT u.id,u.data->>'name' AS name,COALESCE(u.data->>'username',u.data->>'legacyUsername') AS username,u.data->>'status' AS status,u.data->'location' AS location,p.purchase,p.business,p.orders FROM scoped u JOIN purchase p ON p.id=u.id ORDER BY u.id DESC LIMIT 25 OFFSET $${params.length+1}`,[...params,(page-1)*25])).rows;
  return {assignments:areas,totals,items:rows,page,limit:25};
 }
 return {assignments,assign,remove,all,report};
}
