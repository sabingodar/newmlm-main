(()=>{
let pending;const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=()=>pending??=fetch('/api/geography').then(async r=>{if(!r.ok)throw Error('Cannot load Nepal address list');return r.json();}).catch(e=>{pending=null;throw e;});
window.addressFields=()=>`<div class="wide-field address-picker" data-address-picker><div class="form-grid"><label>Country<select name="country" required><option value="NP">Nepal / नेपाल</option></select></label><label>Province / प्रदेश<select name="provinceId" required><option value="">Choose province</option></select></label><label>District / जिल्ला<select name="districtId" required disabled><option value="">Choose province first</option></select></label><label>City / Municipality / Palika<select name="cityId" required disabled><option value="">Choose district first</option></select></label><label>Ward / वडा<input name="ward" type="number" min="1" max="99" step="1"></label><label>Street / Tole<input name="address" maxlength="500"></label></div><p class="address-error" role="status"></p></div>`;
window.bindAddress=async(container,value={},role='member')=>{
 const el=container.querySelector('[data-address-picker]');if(!el)return;const data=await load(),get=n=>el.querySelector(`[name="${n}"]`),p=get('provinceId'),d=get('districtId'),c=get('cityId');
 const options=(select,items,label)=>{select.innerHTML=`<option value="">${label}</option>`+items.sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.type?' '+esc(x.type):''} / ${esc(x.nameNe)}${x.typeNe?' '+esc(x.typeNe):''}</option>`).join('');};
 options(p,[...data.provinces],'Choose province');
 const cities=()=>{options(c,data.cities.filter(x=>x.districtId===d.value),'Choose city / palika');c.disabled=!d.value||!['member','city'].includes(role);c.required=['member','city'].includes(role);};
 const districts=()=>{options(d,data.districts.filter(x=>x.provinceId===p.value),'Choose district');d.disabled=!p.value||['country','province'].includes(role);d.required=['member','district','city'].includes(role);cities();};
 p.disabled=role==='country';p.required=role!=='country';p.onchange=districts;d.onchange=cities;
 p.value=value.provinceId||'';districts();d.value=value.districtId||'';cities();c.value=value.cityId||'';get('ward').value=value.ward||'';get('address').value=value.address||'';
 p.closest('label').hidden=role==='country';d.closest('label').hidden=['country','province'].includes(role);c.closest('label').hidden=!['member','city'].includes(role);
 get('ward').closest('label').hidden=role!=='member';get('address').closest('label').hidden=role!=='member';
};
window.addressPayload=form=>{const f=new FormData(form);return Object.fromEntries(['country','provinceId','districtId','cityId','ward','address'].map(k=>[k,String(f.get(k)||'')]));};
window.areaLabel=async a=>{const d=await load();return [a.country==='NP'?'Nepal':'',d.provinces.find(p=>p.id===a.province_id)?.name,d.districts.find(p=>p.id===a.district_id)?.name,d.cities.find(p=>p.id===a.city_id)?.name].filter(Boolean).join(' / ');};
})();
