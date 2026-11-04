import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../src/database.mjs';
import {geography,locationOf} from '../src/geography.mjs';
const name='dls_regions_'+randomBytes(6).toString('hex'),base='http://localhost:3205';
const city=geography.cities.find(c=>c.name==='Kathmandu'),otherCity=geography.cities.find(c=>c.districtId===city.districtId&&c.id!==city.id),outsideCity=geography.cities.find(c=>c.provinceId!==city.provinceId);
const loc=c=>({country:'NP',provinceId:c.provinceId,districtId:c.districtId,cityId:c.id,ward:'2',address:'Fixture Tole'});
let adminDb,db,child,adminCookie,a,b,outside,coordinator,cookie;
async function req(path,method='GET',data,auth=adminCookie){return fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});}
async function create(username,location){const r=await req('/api/records/users','POST',{name:username+' Member',username,email:username+'@example.test',status:'Active',...(location?{location}:{} )});assert.equal(r.status,201,await r.clone().text());return r.json();}
before(async()=>{adminDb=createDatabase(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);await adminDb.query('CREATE DATABASE '+name);const url=new URL(process.env.TEST_DATABASE_URL||process.env.DATABASE_URL);url.pathname='/'+name;db=createDatabase(url.toString());child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DATABASE_URL:url.toString(),PORT:'3205',ADMIN_PASSWORD:'RegionAdmin2026!',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Regional server timeout')),45000);child.stdout.on('data',c=>{if(String(c).includes('localhost')){clearTimeout(t);resolve();}});child.on('exit',code=>{clearTimeout(t);reject(Error('Server exit '+code));});});const r=await req('/api/login','POST',{username:'admin',password:'RegionAdmin2026!'},null);assert.equal(r.status,200);adminCookie=r.headers.get('set-cookie').split(';')[0];a=await create('REGION_A',loc(city));b=await create('REGION_B',loc(otherCity));outside=await create('REGION_OUT',loc(outsideCity));coordinator=await create('REGION_COORD');await req('/api/users/'+coordinator.id+'/password','POST',{password:'start6',confirmation:'start6'});let login=await req('/api/member/login','POST',{username:'REGION_COORD',password:'start6'},null);cookie=login.headers.get('set-cookie').split(';')[0];await req('/api/member/password','POST',{currentPassword:'start6',password:'own123',confirmation:'own123'},cookie);login=await req('/api/member/login','POST',{username:'REGION_COORD',password:'own123'},null);cookie=login.headers.get('set-cookie').split(';')[0];});
after(async()=>{child?.kill();if(child&&child.exitCode===null)await new Promise(r=>child.once('exit',r));await db?.close();await adminDb?.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await adminDb?.close();});
test('Nepal catalogue is complete, unique and rejects invalid hierarchy on every save',async()=>{
 assert.equal(geography.provinces.length,7);assert.equal(geography.districts.length,77);assert.equal(geography.cities.length,753);assert.equal(new Set(geography.cities.map(c=>c.id)).size,753);
 const publicData=await req('/api/geography','GET',undefined,null);assert.equal(publicData.status,200);assert.equal((await publicData.json()).cities.length,753);
 assert.throws(()=>locationOf({...loc(city),districtId:outsideCity.districtId}));assert.throws(()=>locationOf({...loc(city),country:'US'}));assert.throws(()=>locationOf({...loc(city),ward:'0'}));
 const r=await req('/api/records/users','POST',{name:'Bad Location',email:'bad@example.test',status:'Active',location:{...loc(city),cityId:outsideCity.id}});assert.equal(r.status,400);
 const detail=await(await req('/api/users/'+a.id)).json();assert.equal(detail.profile.country,'NP');assert.equal(detail.profile.city,city.name+' '+city.type);assert.equal(detail.user.location.cityId,city.id);
});
test('admin-only assignments validate area, enforce unique assignee and do not grant unrelated member access',async()=>{
 assert.equal((await req('/api/member/regions','GET',undefined,cookie)).status,403);
 assert.equal((await req('/api/users/'+coordinator.id+'/coordinators','POST',{role:'city',location:loc(city)},cookie)).status,401);
 assert.equal((await req('/api/users/'+coordinator.id+'/coordinators','POST',{role:'district',location:{country:'NP'}})).status,400);
 assert.equal((await req('/api/users/'+coordinator.id+'/coordinators','POST',{role:'city',location:loc(city)})).status,201);
 assert.equal((await req('/api/users/'+outside.id+'/coordinators','POST',{role:'city',location:loc(city)})).status,409);
 const session=await(await req('/api/member/session','GET',undefined,cookie)).json();assert.equal(session.coordinatorAssignments.length,1);
 assert.equal((await req('/api/coordinators','GET',undefined,cookie)).status,401);
});
test('area business totals are scoped, deduplicated, status-aware, filtered and linked by exact legacy username',async()=>{
 for(const data of [{userId:a.id,amount:113,businessAmount:100,status:'Confirmed'},{userId:a.id,amount:50,status:'Pending'},{userId:a.id,amount:1000,status:'Cancelled'},{userId:b.id,amount:226,businessAmount:200,status:'Delivered'},{userId:outside.id,amount:999,status:'Confirmed'},{customer:'Member\n@REGION_A',amount:10,status:'Dispatched'},{customer:'Member\n@REGION_A_EXTRA',amount:500,status:'Confirmed'}])await db.query("INSERT INTO records(kind,data) VALUES('orders',$1)",[{sortDate:'2026-11-01',...data}]);
 let report=await(await req('/api/member/regions','GET',undefined,cookie)).json();assert.equal(report.totals.members,1);assert.equal(Number(report.totals.purchase),123);assert.equal(Number(report.totals.business),110);assert.equal(report.totals.orders,2);assert.ok(!JSON.stringify(report).includes('REGION_OUT'));
 assert.equal((await req('/api/users/'+coordinator.id+'/coordinators','POST',{role:'province',location:loc(city)})).status,201);
 report=await(await req('/api/member/regions','GET',undefined,cookie)).json();assert.equal(report.totals.members,2);assert.equal(Number(report.totals.purchase),349);assert.equal(report.totals.orders,3);
 const filtered=await(await req('/api/member/regions?q=REGION_B','GET',undefined,cookie)).json();assert.equal(filtered.totals.members,1);assert.equal(Number(filtered.totals.purchase),226);
 const dated=await(await req('/api/member/regions?from=2026-11-02','GET',undefined,cookie)).json();assert.equal(Number(dated.totals.purchase),0);
 assert.equal((await req('/api/member/regions?assignmentId=999999','GET',undefined,cookie)).status,403);assert.equal((await req('/api/member/regions?from=2026-99-99','GET',undefined,cookie)).status,400);
 const cityArea=report.assignments.find(a=>a.role==='city');const own=await(await req('/api/member/regions?assignmentId='+cityArea.id,'GET',undefined,cookie)).json();assert.equal(own.totals.members,1);assert.equal(Number(own.totals.purchase),123);
});
test('member address change moves business into current area, stale changes fail and removal revokes access',async()=>{
 const loginMember=async()=>{await req('/api/users/'+outside.id+'/password','POST',{password:'start6',confirmation:'start6'});let r=await req('/api/member/login','POST',{username:'REGION_OUT',password:'start6'},null);let c=r.headers.get('set-cookie').split(';')[0];await req('/api/member/password','POST',{currentPassword:'start6',password:'own123',confirmation:'own123'},c);r=await req('/api/member/login','POST',{username:'REGION_OUT',password:'own123'},null);return r.headers.get('set-cookie').split(';')[0];};
 const c=await loginMember(),profile=await(await req('/api/member/profile','GET',undefined,c)).json();assert.equal(profile.user.location.cityId,outsideCity.id);
 const payload={version:profile.user.version,location:loc(city),userId:a.id};assert.equal((await req('/api/member/address','POST',payload,c)).status,200);assert.equal((await req('/api/member/address','POST',payload,c)).status,409);
 const report=await(await req('/api/member/regions','GET',undefined,cookie)).json();assert.equal(report.totals.members,3);assert.equal(Number(report.totals.purchase),1348);
 for(const a of report.assignments)assert.equal((await req('/api/users/'+coordinator.id+'/unassign','POST',{assignmentId:a.id})).status,200);
 assert.equal((await req('/api/member/regions','GET',undefined,cookie)).status,403);
});
test('country and district roles select only their hierarchy and removal is owned by the target member',async()=>{
 assert.equal((await req('/api/users/'+coordinator.id+'/coordinators','POST',{role:'country',location:{country:'NP'}})).status,201);
 assert.equal((await req('/api/users/'+coordinator.id+'/coordinators','POST',{role:'district',location:loc(city)})).status,201);
 const report=await(await req('/api/member/regions','GET',undefined,cookie)).json();assert.equal(report.totals.members,3);
 const area=report.assignments.find(a=>a.role==='district');let r=await req('/api/member/regions?assignmentId='+area.id,'GET',undefined,cookie);assert.equal(r.status,200);assert.equal((await r.json()).totals.members,3);
 assert.equal((await req('/api/users/'+a.id+'/unassign','POST',{assignmentId:area.id})).status,404);assert.equal((await req('/api/users/'+coordinator.id+'/unassign','POST',{assignmentId:'abc'})).status,400);
 const p=await create('REGION_PAGE',loc(outsideCity));const district=await(await req('/api/member/regions?assignmentId='+area.id,'GET',undefined,cookie)).json();assert.equal(district.totals.members,3);assert.ok(!district.items.some(u=>Number(u.id)===p.id));
 assert.equal((await(await req('/api/member/regions','GET',undefined,cookie)).json()).totals.members,4);
 const audit=await db.query("SELECT action FROM audit WHERE kind='users' AND record_id=$1 AND action='Assigned regional coordinator'",[coordinator.id]);assert.ok(audit.rowCount>=4);
});
