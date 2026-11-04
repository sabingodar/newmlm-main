import {readFileSync} from 'node:fs';
import {fail} from './validation.mjs';
export const geography=JSON.parse(readFileSync(new URL('../public/geo/nepal.json',import.meta.url),'utf8'));
export function locationOf(input,{partial=false,optional=false}={}){
 if(optional&&input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input)||input.country!=='NP')fail('Choose Nepal as country');
 const p=geography.provinces.find(x=>x.id===input.provinceId),d=geography.districts.find(x=>x.id===input.districtId),c=geography.cities.find(x=>x.id===input.cityId);
 if(!p&&!partial)fail('Choose a province');
 if(input.provinceId&&!p)fail('Invalid province');
 if(input.districtId&&(!d||d.provinceId!==p?.id))fail('District does not belong to this province');
 if(input.cityId&&(!c||c.districtId!==d?.id))fail('City / palika does not belong to this district');
 if(!partial&&(!d||!c))fail('Choose district and city / palika');
 const ward=String(input.ward??'').trim(),address=String(input.address??'').trim();
 if(ward&&(!/^[1-9]\d?$/.test(ward)))fail('Ward must be 1–99');if(address.length>500)fail('Address is too long');
 return {country:'NP',provinceId:p?.id||'',districtId:d?.id||'',cityId:c?.id||'',province:p?.name||'',district:d?.name||'',city:c?c.name+' '+c.type:'',ward,address};
}
export async function persistLocation(client,userId,location){
 await client.query('UPDATE member_profiles SET country=$1,state=$2,city=$3,address=$4 WHERE user_id=$5',['NP',location.province,location.city,[location.address,location.ward?'Ward '+location.ward:'',location.district].filter(Boolean).join(', '),userId]);
}
