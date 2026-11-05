import {fail} from './validation.mjs';
import {can,requirePermission,centerScope} from './admin-permissions.mjs';
import {randomBytes} from 'node:crypto';
export const centerModule=type=>type==='Dispatch Center'?'dispatch-centers':'service-centers';
export function createCenters(db,repository){
 async function list(actor,filters){
  if(!['Dispatch Center','Service Center'].includes(filters.centerType))fail('Choose a center type');
  requirePermission(actor,'centers.view','centers.manage',centerModule(filters.centerType)+'.view',centerModule(filters.centerType)+'.manage');
  const result=await repository.list('centers',{...filters,page:filters.page||1,limit:15},centerScope(actor));
  const ids=result.items.map(r=>r.id),managers=ids.length?(await db.query("SELECT username,name,role,status,center_id,version FROM administrators WHERE center_id=ANY($1::bigint[]) AND deleted_at IS NULL",[ids])).rows:[];
  const counts=ids.length?(await db.query("SELECT data->>'centerId' AS center,count(*)::integer AS total FROM records WHERE kind='tasks' AND data->>'centerId'=ANY($1::text[]) GROUP BY data->>'centerId'",[ids.map(String)])).rows:[];
  return {...result,items:result.items.map(r=>({...r,taskCount:counts.find(c=>c.center===String(r.id))?.total||0,managers:managers.filter(m=>Number(m.center_id)===r.id)}))};
 }
 async function save(actor,id,input){
  const old=id?(await db.query("SELECT data FROM records WHERE id=$1 AND kind='centers'",[id])).rows[0]:null;
  if(id&&!old)fail('Center not found',404);
  const type=input.centerType||old?.data.centerType||'Dispatch Center';if(!['Dispatch Center','Service Center'].includes(type))fail('Choose a center type');
  if(old&&(old.data.centerType||'Dispatch Center')!==type)fail('The center type cannot change after creation');
  requirePermission(actor,'centers.manage',centerModule(type)+'.manage');
  return repository.save('centers',id,{...input,centerType:type},{...centerScope(actor),actor:actor.username});
 }
 async function assign(actor,id,input){
  if(actor.role!=='Admin')fail('Only an Admin can assign center managers',403);
  return db.transaction(async c=>{
   const center=(await c.query("SELECT * FROM records WHERE id=$1 AND kind='centers' FOR SHARE",[id])).rows[0];if(!center||center.data.status!=='Active')fail('Choose an active center');
   const role=(center.data.centerType||'Dispatch Center')==='Dispatch Center'?'Dispatch Center Manager':'Service Center Manager';
   const manager=(await c.query('SELECT * FROM administrators WHERE username=$1 FOR UPDATE',[input.username])).rows[0];
   if(!manager||manager.deleted_at||manager.role!==role||manager.status!=='Active')fail('Choose an active '+role);
   if(Number(input.version)!==manager.version)fail('Manager changed. Reload before assigning.',409);
   await c.query('UPDATE administrators SET center_id=$2,version=version+1,updated_at=now(),credential_version=$3 WHERE username=$1',[manager.username,id,randomBytes(16).toString('hex')]);
   await c.query('DELETE FROM sessions WHERE username=$1',[manager.username]);
   await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Assigned center manager','centers',$1,$2)",[id,{actor:actor.username,username:manager.username,role}]);return {ok:true};
  });
 }
 return {list,save,assign};
}
