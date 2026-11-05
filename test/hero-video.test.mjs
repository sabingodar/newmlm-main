import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readHeroVideo,videoRange} from '../src/hero-video.mjs';
import {validateStorefront,storefrontDefaults} from '../src/storefront.mjs';
test('video upload enforces media signatures and size',async()=>{const req=(content,type,length)=>Object.assign(Readable.from([content]),{headers:{'content-type':type,'content-length':length??content.length}});const mp4=Buffer.from('0000ftypisom');assert.equal((await readHeroVideo(req(mp4,'video/mp4'))).mime,'video/mp4');await assert.rejects(readHeroVideo(req(mp4,'text/html')));await assert.rejects(readHeroVideo(req(Buffer.from('bad'),'video/mp4')));await assert.rejects(readHeroVideo(req(mp4,'video/mp4',26214401)));assert.equal((await readHeroVideo(req(Buffer.from([26,69,223,163]),'video/webm'))).mime,'video/webm');});
test('video byte ranges support seeking and reject invalid requests',()=>{assert.deepEqual(videoRange('bytes=2-5',10),{start:2,end:5,status:206});assert.deepEqual(videoRange('bytes=-3',10),{start:7,end:9,status:206});assert.equal(videoRange('bytes=10-',10),null);assert.equal(videoRange('bytes=0-1,3-4',10),null);assert.deepEqual(videoRange(undefined,10),{start:0,end:9,status:200});});
test('hero YouTube settings reject untrusted URLs',async()=>{const client={query:async()=>({rowCount:0})};const base={...storefrontDefaults,heroMode:'youtube',heroYoutubeUrl:'https://www.youtube.com/watch?v=vft3QATH_8k'};assert.equal((await validateStorefront(client,base)).heroMode,'youtube');for(const url of ['https://evil.test/watch?v=vft3QATH_8k','javascript:alert(1)','https://youtube.com/watch?v=bad'])await assert.rejects(validateStorefront(client,{...base,heroYoutubeUrl:url}));});

test('hero markup renders escaped headings and muted autoplay YouTube embeds',async()=>{const vm=await import('node:vm'),fs=await import('node:fs');const window={};vm.runInNewContext(fs.readFileSync('public/hero.js','utf8'),{window,URL});const esc=v=>String(v??'').replaceAll('<','&lt;');const html=window.heroMarkup([],{heroMode:'youtube',heroYoutubeUrl:'https://youtu.be/vft3QATH_8k',heroVideoTitle:'<title>',heroVideoText:'Description',heroVideoKicker:'Hello',heroVideoButtonHref:'/#catalog',heroVideoButtonText:'Shop'},esc,()=> '');assert.match(html,/autoplay=1&mute=1/);assert.match(html,/youtube-nocookie.com/);assert.match(html,/referrerpolicy="strict-origin-when-cross-origin"/);assert.match(html,/allow="autoplay;/);assert.match(html,/&lt;title>/);});

test('inactive single hero media hides the slider without deleting its settings',async()=>{
 const {publishedStorefront}=await import('../src/storefront.mjs');const client={query:async()=>({rowCount:1})};
 const saved=await validateStorefront(client,{...storefrontDefaults,heroEnabled:false,heroMode:'youtube',heroYoutubeUrl:'https://youtu.be/vft3QATH_8k'});
 assert.equal((await validateStorefront(client,{...storefrontDefaults,heroEnabled:false,heroMode:'video',heroVideoUrl:''})).heroEnabled,false);assert.equal(saved.heroMode,'youtube');assert.equal(publishedStorefront(saved).heroMode,'off');assert.equal(publishedStorefront({...saved,heroEnabled:true}).heroMode,'youtube');
 await assert.rejects(validateStorefront(client,{...saved,heroEnabled:'false'}));
});

test('all-off hero renders a hidden slider',async()=>{const vm=await import('node:vm'),fs=await import('node:fs');const window={};vm.runInNewContext(fs.readFileSync('public/hero.js','utf8'),{window,URL});assert.match(window.heroMarkup([],{heroMode:'off'},String,()=>''),/id="sf-hero" hidden/);});
