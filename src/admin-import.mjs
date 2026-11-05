import {randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {fail} from './validation.mjs';
import {adminRoles,permissionKeys} from './admin-permissions.mjs';
const derive=promisify(scrypt),receipt='administrator-reference-v1';
function joinedAt(value){const m=/^(\d{4}-\d{2}-\d{2}) (\d{1,2}):(\d{2}) (AM|PM)\b/.exec(value||'');if(!m)return null;const hour=Number(m[2])%12+(m[4]==='PM'?12:0),date=new Date(m[1]+'T'+String(hour).padStart(2,'0')+':'+m[3]+':00+05:45');if(!Number.isFinite(date.getTime()))fail('Invalid source joined date');return date.toISOString();}
export async function importAdminReference(db,source,password,actor='admin'){
 if(typeof password!=='string'||password.length<6||password.length>256)fail('Provide a temporary password of 6–256 characters');
 if(!source||!Array.isArray(source.admins)||!source.admins.length||source.admins.length>1000||!Array.isArray(source.centers))fail('Invalid admin reference snapshot');
 const names=new Set();for(const a of source.admins){if(!/^[A-Za-z0-9_.-]{3,60}$/.test(a.username)||names.has(a.username.toLowerCase())||typeof a.name!=='string'||!a.name||a.name.length>150||!adminRoles.includes(a.role)||!['Active','Inactive'].includes(a.status)||typeof a.email!=='string'||a.email.length>254||a.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email))fail('Invalid or duplicate source administrator');names.add(a.username.toLowerCase());if(a.role.includes('Center Manager')&&!a.sourceCenterId)fail('A manager is missing its verified source center');}
 return db.transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(76241902)');await c.query('SELECT pg_advisory_xact_lock(76241905)');
  if((await c.query('SELECT name FROM data_imports WHERE name=$1',[receipt])).rowCount)fail('Administrator reference was already imported; local edits and passwords were preserved',409);
  const centers=(await c.query("SELECT * FROM records WHERE kind='centers' FOR UPDATE")).rows,centerMap=new Map(),used=new Set(source.admins.map(a=>String(a.sourceCenterId||'')).filter(Boolean));let createdCenters=0;
  await c.query('SELECT pg_advisory_xact_lock(76241906)');
  for(const id of used){const matches=centers.filter(r=>String(r.data.sourceCenterId||'')===id);if(matches.length>1)fail('Duplicate source center mapping');if(matches.length===1){centerMap.set(id,Number(matches[0].id));continue;}const data=source.centers.find(r=>String(r.sourceId)===id);if(!data||!data.name||!data.location||!['Active','Inactive'].includes(data.status))fail('Verified source center details are missing');const type=source.admins.find(a=>String(a.sourceCenterId)===id)?.role==='Service Center Manager'?'Service Center':'Dispatch Center';const code=String(data.code||'').trim().toUpperCase();if(code&&(!/^[A-Z0-9_-]{2,40}$/.test(code)||(await c.query("SELECT id FROM records WHERE kind='centers' AND lower(data->>'code')=lower($1)",[code])).rowCount))fail('Source center code conflicts with a local center');const row=(await c.query("INSERT INTO records(kind,data) VALUES('centers',$1) RETURNING id",[{name:data.name,location:data.location,phone:data.phone||'',code,centerType:type,status:data.status,sourceCenterId:id}])).rows[0];centerMap.set(id,Number(row.id));createdCenters++;}
  const report={sourceRows:source.admins.length,created:0,ownerProfilesUpdated:0,skippedExisting:0,assignedManagers:0,permissionReviews:0,createdCenters};
  for(const a of source.admins){
   const old=(await c.query('SELECT * FROM administrators WHERE lower(username)=lower($1) FOR UPDATE',[a.username])).rows[0];
   const metadata={source:source.source,sourceId:a.sourceId,sourceRole:a.sourceRole,sourceRoleLabel:a.sourceRoleLabel,sourceStatus:a.status,sourceJoinedAt:a.sourceJoinedAt,sourceCenterId:a.sourceCenterId||null,accessReview:!!a.accessReview,capturedAt:source.capturedAt};
   if(old){if(old.is_owner){const before=[old.salt,old.password_hash,old.credential_version,old.role,old.status,old.must_change_password];const updated=(await c.query('UPDATE administrators SET name=$2,email=$3,import_metadata=$4,version=version+1,updated_at=now() WHERE username=$1 RETURNING *',[old.username,a.name,a.email,JSON.stringify(metadata)])).rows[0];if(JSON.stringify(before)!==JSON.stringify([updated.salt,updated.password_hash,updated.credential_version,updated.role,updated.status,updated.must_change_password]))throw Error('Primary administrator credentials changed unexpectedly');report.ownerProfilesUpdated++;}else report.skippedExisting++;continue;}
   const centerId=a.sourceCenterId?centerMap.get(String(a.sourceCenterId)):null;if(a.role.includes('Center Manager')&&!centerId)fail('Source center mapping is incomplete');
   if(centerId){const center=(await c.query('SELECT data FROM records WHERE id=$1',[centerId])).rows[0];const type=a.role==='Service Center Manager'?'Service Center':'Dispatch Center';if((center.data.centerType||'Dispatch Center')!==type)fail('Source center type does not match manager role');}
   const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex'),overrides={allow:[],deny:a.accessReview?[...permissionKeys]:[]};
   await c.query('INSERT INTO administrators(username,name,email,role,status,center_id,salt,password_hash,credential_version,permission_overrides,must_change_password,import_metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,COALESCE($12::timestamptz,now()))',[a.username,a.name,a.email,a.role,a.status,centerId,salt,hash,randomBytes(16).toString('hex'),JSON.stringify(overrides),JSON.stringify(metadata),joinedAt(a.sourceJoinedAt)]);
   report.created++;if(centerId)report.assignedManagers++;if(a.accessReview)report.permissionReviews++;
  }
  await c.query('INSERT INTO archive(kind,data) VALUES($1,$2)',[receipt,JSON.stringify([{source:source.source,capturedAt:source.capturedAt,admins:source.admins,centers:source.centers}])]);
  await c.query('INSERT INTO data_imports(name) VALUES($1)',[receipt]);await c.query("INSERT INTO audit(action,kind,details) VALUES('Imported administrator reference','administrators',$1)",[{actor,...report,source:source.source,temporaryPasswordRequiresChange:true}]);return report;
 });
}
