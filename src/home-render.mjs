import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Execute only our trusted, local presentation helpers. Templates are shared with
// the browser so the first response and the interactive page have the same design.
const context=vm.createContext({window:{},URL,URLSearchParams});
for(const file of ['dashboard.js','hero.js','about.js','product-editor.js','storefront-markup.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context,{filename:file});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderer=context.window.createStorefrontMarkup({esc,money:v=>'Rs. '+new Intl.NumberFormat('en-NP',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0),icon:name=>context.window.businessIcons[name]||context.window.businessIcons.products,heroMarkup:context.window.heroMarkup,aboutHomeMarkup:context.window.aboutHomeMarkup});
export function renderHomeResponse(markup,data,products,productPath){
 const home=renderer.home(data).html.replace('<div class="sf-product-grid" id="sf-product-grid"></div>',()=>'<div class="sf-product-grid" id="sf-product-grid">'+products.items.map((p,i)=>renderer.productCard(p,i)).join('')+'</div>');
 const frame=renderer.frame(data,'/').replace('<div class="storefront">','<div class="storefront" data-server-home>').replace('<main id="sf-main"></main>',()=>'<main id="sf-main" data-server-rendered="true">'+home+'</main>');
 markup=markup.replace(/<div class="instant-page">[\s\S]*?<\/main><\/div>/,()=>frame);
 const payload=JSON.stringify({storefront:data,[productPath]:products}).replaceAll('<','\\u003c');
 return markup.replace('<head>',()=>'<head><script id="initial-public-data" type="application/json">'+payload+'</script>');
}
