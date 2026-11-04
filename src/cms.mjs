import {fail} from './validation.mjs';
export const contentDefaults={googleMapsUrl:'',latitude:'',longitude:'',logoUrl:'/brand/logo.jpg',heroTitle:'Dynamic business. Infinite success.',heroDescription:'Discover wellness, lifestyle and everyday essentials. Connect with a community that grows together.',aboutTitle:'A better life begins with a shared vision.',aboutText:'Dynamic Life Success brings people and everyday essentials together, with a focus on community, quality and long-term relationships.',seoTitle:'',seoDescription:'',facebookUrl:'',instagramUrl:'',footerText:'Dynamic Business. Infinite Success.'};
export function validateContent(input,current={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid settings');
  const result={...contentDefaults,...current,currency:'NPR'};
  for(const key of ['siteName','tagline','email','phone','address',...Object.keys(contentDefaults)]) {
    if(input[key]===undefined)continue;
    const limit=['heroDescription','aboutText','seoDescription'].includes(key)?4000:500;
    const value=String(input[key]).trim();if(value.length>limit)fail(`${key} is too long`);result[key]=value;
  }
  if(!result.siteName)fail('Business name is required');
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))fail('Enter a valid contact email');
  if(!/^\/assets\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(result.logoUrl)&&result.logoUrl!=='/brand/logo.jpg')fail('Upload a logo using the logo field');
  for(const key of ['facebookUrl','instagramUrl'])if(result[key]){try{const u=new URL(result[key]);if(u.protocol!=='https:'||u.username||u.password)fail('Social links must use HTTPS');}catch{fail('Enter a valid HTTPS social link');}}
  if(Boolean(result.latitude)!==Boolean(result.longitude))fail('Enter both latitude and longitude');
  for(const [key,limit] of [['latitude',90],['longitude',180]])if(result[key]!==''&&(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(result[key])||!Number.isFinite(Number(result[key]))||Math.abs(Number(result[key]))>limit))fail('Invalid '+key);
  if(result.googleMapsUrl){let u;try{u=new URL(result.googleMapsUrl);}catch{fail('Enter a valid Google Maps HTTPS link');}const host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||!(['google.com','www.google.com','maps.google.com','maps.app.goo.gl'].includes(host)||(host==='goo.gl'&&u.pathname.startsWith('/maps')))||(['google.com','www.google.com'].includes(host)&&!u.pathname.startsWith('/maps')))fail('Use a Google Maps HTTPS link');}
  return result;
}
export function decodeImage(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid upload');
  if(typeof input.data!=='string'||input.data.length>2800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.data))fail('Invalid image data');
  const content=Buffer.from(input.data,'base64');
  if(!content.length||content.length>2097152)fail('Image must be smaller than 2 MB');
  let mime;
  if(content.subarray(0,3).equals(Buffer.from([255,216,255])))mime='image/jpeg';
  else if(content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
  else if(['GIF87a','GIF89a'].includes(content.toString('ascii',0,6)))mime='image/gif';
  else if(content.toString('ascii',0,4)==='RIFF'&&content.toString('ascii',8,12)==='WEBP')mime='image/webp';
  else fail('Use a JPG, PNG, WebP or GIF image');
  return {content,mime};
}
