import {readFile} from 'node:fs/promises';
import {createDatabase,migrate} from '../src/database.mjs';
const capture=JSON.parse(await readFile(process.argv[2]||'data/binary-tree-source.json','utf8'));
const observed=new Map(),edges=new Map(),coverage=new Map();
for(const page of capture.pages){
 for(let depth=0;depth<page.length;depth++)for(let index=0;index<page[depth].length;index++){
  const n=page[depth][index];if(!n?.url)continue;observed.set(n.username,n);
  if(depth<page.length-1)coverage.set(n.username,[page[depth+1][index*2],page[depth+1][index*2+1]]);
  if(depth){const parent=page[depth-1][Math.floor(index/2)];if(!parent?.url)throw Error('Member has no observed parent');const edge={parent:parent.username,position:index%2?'Right':'Left'};if(edges.has(n.username)&&JSON.stringify(edges.get(n.username))!==JSON.stringify(edge))throw Error('Conflicting source placement for '+n.username);edges.set(n.username,edge);}
 }
}
for(const name of edges.keys()){const seen=new Set([name]);let next=edges.get(name)?.parent;while(next){if(seen.has(next))throw Error('Source tree contains a cycle');seen.add(next);next=edges.get(next)?.parent;}}
const db=createDatabase();try{await migrate(db);const report=await db.transaction(async c=>{
 await c.query('SELECT pg_advisory_xact_lock(76241905)');
 const members=(await c.query("SELECT r.id,r.data,p.parent_id,p.position FROM records r JOIN member_profiles p ON p.user_id=r.id WHERE kind='users' FOR UPDATE OF r,p")).rows;
 const byName=new Map(members.map(r=>[r.data.username||r.data.legacyUsername,r]));let linked=0,covered=0;const missing=[...observed.keys()].filter(n=>!byName.has(n));if(missing.length)throw Error('Source contains members missing locally; review before importing: '+missing.join(', '));
 // Never overwrite members created by local referrals or move existing local placements silently.
 for(const [name,edge] of edges){const n=byName.get(name),parent=byName.get(edge.parent);if(n.data.createdVia==='Member referral')throw Error('Source import would overwrite a local referral');if(n.parent_id&&(Number(n.parent_id)!==Number(parent.id)||(n.position!==null&&n.position!==edge.position)))throw Error('Existing placement differs from source for '+name);const occupant=members.find(r=>Number(r.parent_id)===Number(parent.id)&&r.position===edge.position&&Number(r.id)!==Number(n.id));if(occupant)throw Error('A local member already occupies source position '+edge.parent+' '+edge.position);}
 for(const [name,edge] of edges){const n=byName.get(name),parent=byName.get(edge.parent);await c.query('UPDATE member_profiles SET parent_id=$1,position=$2 WHERE user_id=$3',[parent.id,edge.position,n.id]);linked++;}
 for(const [name,n] of observed){const local=byName.get(name),children=coverage.get(name);await c.query("UPDATE records SET data=jsonb_set(data,'{sourceTree}',$1::jsonb),version=version+1,updated_at=now() WHERE id=$2",[JSON.stringify({childrenKnown:!!children,source:'Authorized member binary tree',capturedAt:capture.capturedAt,membershipStatus:n.status,plan:n.plan,leftFree:Number(n.leftFree)||0,rightFree:Number(n.rightFree)||0,leftPaid:Number(n.leftPaid)||0,rightPaid:Number(n.rightPaid)||0,leftPoint:Number(n.leftPoint)||0,rightPoint:Number(n.rightPoint)||0}),local.id]);if(children)covered++;}
 // Direct referrer and placement parent are distinct. Only exact usernames from the observed referral list are used.
 const root=byName.get('root');if(root){const refs=root.data.recordedMetrics?.referralMembers||[];for(const r of refs){const local=byName.get(r.username);if(local){const existing=(await c.query('SELECT referrer_id FROM member_profiles WHERE user_id=$1',[local.id])).rows[0];if(existing.referrer_id&&Number(existing.referrer_id)!==Number(root.id))throw Error('Conflicting direct referrer');await c.query('UPDATE member_profiles SET referrer_id=$1 WHERE user_id=$2',[root.id,local.id]);}}}
 await c.query("INSERT INTO audit(action,kind,record_id,details) VALUES('Imported observed binary placements','users',$1,$2)",[byName.get('root')?.id||members[0].id,{members:observed.size,placements:linked,verifiedParents:covered,sourcePages:capture.pages.length,financialCredit:false}]);
 return {members:observed.size,placements:linked,verifiedParents:covered,sourcePages:capture.pages.length};
});console.log(JSON.stringify(report));}finally{await db.close();}
