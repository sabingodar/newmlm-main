import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../data/source-data.json',import.meta.url),'utf8'));
const target=new URL('../public/media/',import.meta.url);mkdirSync(target,{recursive:true});
let index=0,success=0;const failed=[];
async function worker(){while(index<data.products.length){const p=data.products[index++];const id=p.links[0].url.split('/').pop();const url=p.images?.[0];if(!url||new URL(url).hostname!=='dynamiclifesuccess.com'){failed.push(id);continue;}try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('Invalid image');writeFileSync(new URL(id+'.img',target),Buffer.from(await r.arrayBuffer()));success++;}catch{failed.push(id);}}}
await Promise.all(Array.from({length:4},worker));console.log(JSON.stringify({downloaded:success,failed}));
