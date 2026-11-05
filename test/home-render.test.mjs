import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderHomeResponse} from '../src/home-render.mjs';
import {storefrontDefaults} from '../src/storefront.mjs';
test('the initial homepage contains real navigation, hero and products and safely embeds CMS text',()=>{
 const attack='</script><script>alert(1)</script> $& $`',product={id:1,name:attack,price:10,originalPrice:12,stock:5,minimumQuantity:1};
 const data={settings:{siteName:attack,tagline:'Everyday',heroTitle:'Real homepage',heroDescription:'First response',aboutTitle:'Vision',aboutText:'Our story',phone:'',email:'',address:'',footerText:''},content:{...storefrontDefaults,slides:[],posts:[],testimonials:[]},heroProducts:[product],categories:[],featured:[],about:null};
 const template='<html><head></head><body><div id="app"><div class="instant-page"><header>Temporary</header><main><h1>Placeholder</h1></main></div></div></body></html>',products={items:[product],total:1,page:1,limit:12,priceMaximum:10};
 const html=renderHomeResponse(template,data,products,'storefront/products?sort=latest&page=1');assert.doesNotMatch(html,/instant-page|<header>Temporary/);assert.match(html,/data-server-home/);assert.match(html,/id="sf-hero"/);assert.match(html,/class="sf-product-card"/);assert.doesNotMatch(html,/<script>alert\(1\)/);
 const json=html.match(/<script id="initial-public-data" type="application\/json">([\s\S]*?)<\/script>/)[1],initial=JSON.parse(json);assert.equal(initial.storefront.settings.siteName,attack);assert.equal(initial['storefront/products?sort=latest&page=1'].items[0].name,attack);assert.ok(!json.includes('<'));
});
