import {fail} from './validation.mjs';
import {uploadedImage} from './storefront.mjs';
export const commissionDefaults={dispatchCommission:0,rankCommissions:[],regionalCommissions:{country:0,province:0,district:0,city:0}};
const money=(v,label)=>{const n=Number(v);if(v===''||v==null||!Number.isFinite(n)||n<0||n>1e10||Math.abs(n*100-Math.round(n*100))>0.00001)fail('Invalid '+label);return n;};
export async function commissions(client,input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid commission settings');
 const dispatchCommission=money(input.dispatchCommission??0,'dispatch center commission');
 if(!Array.isArray(input.rankCommissions)||input.rankCommissions.length>100)fail('Invalid rank commissions');
 const seen=new Set(),rankCommissions=[];
 for(const row of input.rankCommissions){const rankId=Number(row.rankId);if(!Number.isSafeInteger(rankId)||rankId<1||seen.has(rankId))fail('Invalid or duplicate commission rank');seen.add(rankId);const rank=(await client.query("SELECT id FROM records WHERE kind='affiliates' AND id=$1",[rankId])).rows[0];if(!rank)fail('Commission rank does not exist');rankCommissions.push({rankId,amount:money(row.amount,'rank commission')});}
 if(input.regionalCommissions!==undefined&&(!input.regionalCommissions||typeof input.regionalCommissions!=='object'||Array.isArray(input.regionalCommissions)))fail('Invalid regional commissions');
 const regionalCommissions={};for(const key of ['country','province','district','city'])regionalCommissions[key]=money(input.regionalCommissions?.[key]??0,key+' coordinator/franchise commission');
 return {dispatchCommission,rankCommissions:rankCommissions.sort((a,b)=>a.rankId-b.rankId),regionalCommissions};
}
export async function validateProductDetails(client,data,input,{isNew=false}={}){
 const id=value=>{if(!Number.isSafeInteger(Number(value))||Number(value)<1)fail('Invalid category');return Number(value);};
 if(input.categoryId!==undefined&&input.categoryId!==''){
  const cat=(await client.query('SELECT * FROM product_categories WHERE id=$1 AND parent_id IS NULL',[id(input.categoryId)])).rows[0];if(!cat)fail('Choose a category');
  data.categoryId=Number(cat.id);data.category=cat.name;data.subcategoryId=null;data.subcategory='';
  if(input.subcategoryId){const child=(await client.query('SELECT * FROM product_categories WHERE id=$1 AND parent_id=$2',[id(input.subcategoryId),cat.id])).rows[0];if(!child)fail('Sub-category does not belong to this category');data.subcategoryId=Number(child.id);data.subcategory=child.name;}
  else if((await client.query('SELECT id FROM product_categories WHERE parent_id=$1 LIMIT 1',[cat.id])).rowCount)fail('Choose a sub-category');
 }else if(input.subcategoryId)fail('Choose category before sub-category');
 if(isNew){const settings=(await client.query('SELECT data FROM settings WHERE id=1')).rows[0]?.data;Object.assign(data,commissionDefaults,settings?.productCommissionDefaults||{},...(input.dispatchCommission===undefined?[]:[{dispatchCommission:input.dispatchCommission}]),...(input.rankCommissions===undefined?[]:[{rankCommissions:input.rankCommissions}]),...(input.regionalCommissions===undefined?[]:[{regionalCommissions:input.regionalCommissions}]));}
 if(input.dispatchCommission!==undefined)data.dispatchCommission=input.dispatchCommission;
 if(input.rankCommissions!==undefined)data.rankCommissions=input.rankCommissions;
 if(input.regionalCommissions!==undefined)data.regionalCommissions=input.regionalCommissions;
 Object.assign(data,await commissions(client,{...commissionDefaults,...data}));
 data.manageStock??=true;data.featured??=false;data.warrantyEnabled??=false;data.rewardsEnabled??=false;
 for(const key of ['manageStock','featured','warrantyEnabled','rewardsEnabled'])if(typeof data[key]!=='boolean')fail('Invalid '+key);
 for(const key of ['salesRewardPoints','purchaseRewardPoints'])data[key]=money(data[key]??0,key);
 if(!data.rewardsEnabled){data.salesRewardPoints=0;data.purchaseRewardPoints=0;}
 if(data.originalPrice!=null&&data.originalPrice<data.price)fail('MRP must be at least the sales price');
 if(data.weight!=null&&(!Number.isFinite(Number(data.weight))||Number(data.weight)<0||Number(data.weight)>1e8))fail('Invalid weight');
 if(data.warrantyEnabled){if(!Number.isInteger(Number(data.warrantyPeriod))||Number(data.warrantyPeriod)<1||Number(data.warrantyPeriod)>10000)fail('Warranty period must be 1–10,000');if(!['Day','Month','Year'].includes(data.warrantyUnit))fail('Choose warranty unit');data.warrantyPeriod=Number(data.warrantyPeriod);}else{data.warrantyPeriod=null;data.warrantyUnit='Month';}
 if(data.youtubeUrl){let u;try{u=new URL(data.youtubeUrl);}catch{fail('Enter a valid YouTube URL');}if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)||u.username||u.password)fail('Use an HTTPS YouTube video URL');}
 const image=v=>!v||/^\/(?:media\/\d+\.img|assets\/[a-f0-9-]{36})$/.test(v);
 if(input.images!==undefined){if(!Array.isArray(input.images)||input.images.length>3||input.images.some(v=>typeof v!=='string'||!v||!image(v))||new Set(input.images).size!==input.images.length)fail('Choose up to three uploaded product images');data.images=input.images;data.imageUrl=input.images[0]||'';}
 data.images??=data.imageUrl?[data.imageUrl]:[];
 if(!image(data.featuredImageUrl))fail('Upload a valid featured image');
 for(const url of [...data.images,data.featuredImageUrl].filter(Boolean))if(url.startsWith('/assets/')&&!(await client.query('SELECT id FROM media_assets WHERE id=$1',[url.slice(8)])).rowCount)fail('Product image is missing. Upload it again.');
 return data;
}
export function createCategories(db){
 const list=async()=>(await db.query('SELECT * FROM product_categories ORDER BY lower(name),id')).rows.map(r=>({...r,id:Number(r.id),parentId:r.parent_id?Number(r.parent_id):null,imageUrl:r.image_url}));
 async function create(input){const name=String(input.name??'').trim();if(!name||name.length>120)fail('Category name must be 1–120 characters');return db.transaction(async c=>{const parentId=input.parentId?Number(input.parentId):null;if(input.parentId&&(!Number.isSafeInteger(parentId)||parentId<1||!(await c.query('SELECT id FROM product_categories WHERE id=$1 AND parent_id IS NULL',[parentId])).rowCount))fail('Choose a parent category');const imageUrl=await uploadedImage(c,input.imageUrl||''),row=(await c.query('INSERT INTO product_categories(name,parent_id,image_url) VALUES($1,$2,$3) RETURNING *',[name,parentId,imageUrl])).rows[0];await c.query("INSERT INTO audit(action,kind,details) VALUES('Created product category','categories',$1)",[{categoryId:Number(row.id),name,parentId}]);return {...row,id:Number(row.id),parentId};});}
 async function updateImage(id,input){if(!/^\d+$/.test(String(id)))fail('Invalid category');return db.transaction(async c=>{const imageUrl=await uploadedImage(c,input.imageUrl||''),row=(await c.query('UPDATE product_categories SET image_url=$1 WHERE id=$2 RETURNING *',[imageUrl,id])).rows[0];if(!row)fail('Category not found',404);await c.query("INSERT INTO audit(action,kind,details) VALUES('Updated category image','categories',$1)",[{categoryId:Number(id),imageUrl}]);return {id:Number(id),imageUrl};});}
 return {list,create,updateImage};
}
