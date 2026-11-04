import {existsSync} from 'node:fs';
export function mapLegacy(data){
const output=[];const number=v=>Number(String(v).match(/[\d,]+(?:\.\d+)?/)?.[0]?.replaceAll(',','')||0);const first=v=>String(v||'').split('\n')[0];
for(const [kind,rows] of Object.entries(data)){
if(!Array.isArray(rows))throw Error('Invalid import');
     for(const row of rows){const c=row.cells;if(!Array.isArray(c))continue;let r;
      if(kind==='products'&&c.length===9){const legacyId=row.links?.[0]?.url.split('/').pop();const details=data.productDetails?.find(d=>d.url.split('/').pop()===legacyId);const fields=Object.fromEntries((details?.fields||[]).map(f=>[f.name,f.type==='checkbox'?f.checked:f.value]));r={name:fields.name||c[0].replace(/\s+Featured$/,''),category:c[1],price:number(c[2]),stock:number(c[3]),bv:Number(fields.bv_points||0),description:fields.short_description||'',status:c[7]==='Enabled'?'Active':'Inactive',legacyId,legacyCommission:number(c[6]),legacyBvUnknown:!details,legacyDetails:details,brand:fields.brand||'',sku:fields.sku||'',imageUrl:details?.images?.[0]?.match(/url\(["']?(.*?)["']?\)/)?.[1]||''};}
      if(kind==='users'&&c.length===6)r={name:first(c[0]),email:first(c[1]),phone:c[1].split('\n')[1]||'',sponsor:'',status:data.bannedUsers?.some(b=>b.cells?.[0]===c[0])?'Inactive':'Active',legacyUsername:c[0].split('\n')[1]?.replace('@',''),legacyBalance:number(c[4]),country:c[2],legacyJoinedAt:first(c[3])};
      if(kind==='orders'&&c.length===8)r={customer:c[1],productId:0,quantity:0,amount:number(c[2]),status:({'Confirm':'Confirmed','Cancelled':'Cancelled','Delivered':'Delivered','Dispatched':'Dispatched','Unknown':'Unknown'}[c[5]]||'Pending'),legacyOrder:first(c[0]),legacyPayment:c[4],legacyDate:first(c[6]),sortDate:new Date(first(c[6])).toISOString(),legacyReadOnly:true};
      if(['deposits','withdrawals'].includes(kind)&&c.length>=6)r={member:c[2],amount:number(c[3]),reference:c[0].split('\n')[1]||c[0],method:first(c[0]),status:/approved|successful|success/i.test(c[5])?'Approved':/rejected/i.test(c[5])?'Rejected':/initiated/i.test(c[5])?'Initiated':'Pending',legacyStatus:c[5],legacyReadOnly:true};
      if(kind==='ranks'&&c.length===11)r={name:first(c[2]),bv:number(c[5]),reward:number(c[7]),status:c[9]==='Enabled'?'Active':'Inactive',rankType:c[3],legacyReadOnly:true};
      if(kind==='affiliateRanks'&&c.length===8)r={name:first(c[2]),minPurchase:number(c[3]),bonus:number(c[4]),status:c[6]==='Active'?'Active':'Inactive',legacyReadOnly:true};
      if(kind==='leads'&&c.length===10)r={name:first(c[0]),email:c[0].split('\n')[1]||'',phone:c[0].split('\n')[2]||'',notes:c[1],status:c[2],legacyReadOnly:true};

if(r){if(kind==='products'&&existsSync(new URL(`../public/media/${r.legacyId}.img`,import.meta.url)))r.imageUrl=`/media/${r.legacyId}.img`;r.source=row;output.push({kind:kind==='affiliateRanks'?'affiliates':kind,data:r});}
}
}
return output;
}
