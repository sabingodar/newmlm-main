export const schemas = {
 users: {name:'text',username:'text?',email:'email',phone:'text?',sponsor:'text?',status:['Active','Inactive']},
 affiliates: {name:'text',minPurchase:'money',bonus:'money',status:['Active','Inactive']},
 plans: {name:'text',price:'money',bv:'money',referralCommission:'money',treeCommission:'money',status:['Active','Inactive']},
 products: {name:'text',category:'text',price:'money',bv:'money',stock:'integer',description:'text?',status:['Active','Inactive'],showOnWebsite:'boolean?',showInDiscount:'boolean?',showInWholesale:'boolean?',showInQuickOrder:'boolean?',originalPrice:'money?',discountPrice:'money?',wholesalePrice:'money?',wholesaleMinQty:'integer?',businessValue:'money?',vatRate:'money?',vatIncluded:'boolean?',imageUrl:'text?',features:'text?',shortDescription:'text?',weight:'money?',unit:'text?',color:'text?',youtubeUrl:'text?',manageStock:'boolean?',featured:'boolean?',warrantyEnabled:'boolean?',warrantyPeriod:'integer?',warrantyUnit:'text?',rewardsEnabled:'boolean?',salesRewardPoints:'money?',purchaseRewardPoints:'money?',dispatchCommission:'money?',featuredImageUrl:'text?'},
 orders: {dispatchCenterId:'integer?',customer:'text',productId:'integer',quantity:'positive',amount:'money',status:['Pending','Confirmed','Partially dispatched','Dispatched','Out for delivery','Delivered','Cancelled','Unknown'],paymentStatus:'payment?',deliveryOption:'text?',courier:'text?',trackingNumber:'text?',trackingUrl:'text?',estimatedDelivery:'text?',deliveryNotes:'text?'},
 deposits: {member:'text',amount:'positive',reference:'text',method:'text',status:['Initiated','Pending','Approved','Rejected']},
 withdrawals: {member:'text',amount:'positive',reference:'text',method:'text',status:['Pending','Approved','Rejected']},
 tickets: {name:'text',subject:'text',message:'text',reply:'text?',status:['Open','In progress','Resolved']},
 leads: {name:'text',email:'email',phone:'text?',notes:'text?',status:['New','Contacted','Converted','Closed']},
 ranks: {name:'text',minPurchase:'money?',skyBv:'money?',earthBv:'money?',reward:'money',status:['Active','Inactive']},
 pins: {code:'text',plan:'text',assignedTo:'text?',status:['Available','Assigned','Used']},
 centers: {code:'text?',name:'text',location:'text',phone:'text?',centerType:'centerType?',status:['Active','Inactive']},
 tasks: {name:'text',assignedTo:'text',centerId:'integer?',notes:'text?',status:['Pending','In progress','Completed']}
};
export const fail = (message, status=400) => { const e = new Error(message); e.status=status; throw e; };
export function validate(kind, input) {
 const schema=schemas[kind]; if(!schema) fail('Unknown module',404);
 const out={};
 for(const [key,type] of Object.entries(schema)) {
  const value=input[key],base=typeof type==='string'?type.replace(/\?$/,''):type;
  if(base==='centerType'){if(value!==undefined&&!['Dispatch Center','Service Center'].includes(value))fail('Choose a valid center type');if(value!==undefined)out[key]=value;continue;}
  if(typeof type==='string'&&type.endsWith('?')&&value===undefined)continue;
  if(base==='payment'){if(!['Pending','Paid','Failed','Refunded'].includes(value))fail('Invalid payment status');out[key]=value;continue;}
  if(base==='boolean'){if(typeof value!=='boolean')fail('Invalid '+key);out[key]=value;continue;}
  if(typeof type==='string'&&type.endsWith('?')&&['money','integer'].includes(base)&&(value===null||value==='')){out[key]=null;continue;}
  if(Array.isArray(type)) { if(!type.includes(value)) fail(`Invalid ${key}`); out[key]=value; }
  else if(['money','integer','positive'].includes(base)) { const n=Number(value); if(value==='' || value==null || !Number.isFinite(n)||n<0||n>1e10||(base==='integer'&&!Number.isInteger(n))||(base==='positive'&&n<=0)) fail(`Invalid ${key}`); out[key]=n; }
  else { const str=String(value??'').trim(); if((!type.endsWith('?')&&!str)||str.length>4000) fail(`Invalid ${key}`); if(type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) fail('Invalid email'); out[key]=str; }
 }
 return out;
}
