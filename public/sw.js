'use strict';

const CACHE_VERSION='ghost-game-shell-v14-20260816';
const RENDERER_CACHE_VERSION='ghost-game-renderer-v17-20260819';
const LOCALE_FILES=['./locales/zh-CN.json','./locales/en-US.json','./locales/uk-UA.json'];
const LOCALE_URLS=new Set(LOCALE_FILES.map(file=>new URL(file,self.location.href).href));
const SHELL=['./','./index.html','./manifest.webmanifest','./assets/brand/ghost-game-mark.svg','./assets/brand/honru-mascot-v1.svg','./assets/brand/pwa/ghost-game-192.png','./assets/brand/pwa/ghost-game-512.png','./assets/brand/pwa/ghost-wake-v1/ghost-game-maskable-192-v1.png','./assets/brand/pwa/ghost-wake-v1/ghost-game-maskable-512-v1.png','./assets/ui/loading/ghost-boot-v1/honru-boot-controller-hug-320-v1.webp'];
const CACHEABLE_DESTINATIONS=new Set(['image','style','script','font','manifest']);
const WARMUP_TYPE='GAME_MODULE_WARMUP_V1';
const DESCRIPTOR_CHECK_TYPE='GAME_MODULE_DESCRIPTOR_CHECK_V1';
const DESCRIPTOR_RESULT_TYPE='GAME_MODULE_DESCRIPTOR_RESULT_V1';
const RENDERER_RESOURCE='renderer';
const RENDERER_VARIANT='primary';
const RENDERER_RETRY_VARIANT='retry1';
// These descriptors are deliberately data-only and closed. A Client can ask
// for a game/resource/variant tuple, never a URL. Full source hashes are used
// before a renderer entry enters its cache; the short prefix only versions the
// request URL for the current release.
const RENDERER_ENTRY_ALLOWLIST=Object.freeze({
  gomoku:Object.freeze({gameId:'gomoku',resource:'renderer',variant:'primary',url:'./three/gomoku-entry.js?v=sha256-adf60207928f61ee',sha256:'adf60207928f61eefc4d1725f9587f3d1827c131ece70a700136da17a6dfc6e9',exports:Object.freeze(['isGomoku3DSupported','createGomoku3DAdapter'])}),
  ludo:Object.freeze({gameId:'ludo',resource:'renderer',variant:'primary',url:'./three/ludo-entry.js?v=sha256-9b3e5829abf61c79',sha256:'9b3e5829abf61c790421da598b845895a9bd07dff924b7c7a60c2379c149c365',exports:Object.freeze(['isLudo3DSupported','createLudo3DAdapter'])}),
  monopoly:Object.freeze({gameId:'monopoly',resource:'renderer',variant:'primary',url:'./three/monopoly-entry.js?v=sha256-27a68efbf31c9aff',sha256:'27a68efbf31c9aff52ed994daa1d49578a148f4541228f0c6ecd56edb0da5b70',exports:Object.freeze(['isMonopoly3DSupported','createMonopoly3DAdapter'])}),
  xiangqi:Object.freeze({gameId:'xiangqi',resource:'renderer',variant:'primary',url:'./three/xiangqi-entry.js?v=sha256-f12d77cdd9896a2b',sha256:'f12d77cdd9896a2ba3db1ad9c5eef0bcb9ba728b504ad28b73c9c13cb82e0995',exports:Object.freeze(['isXiangqi3DSupported','createXiangqi3DAdapter'])}),
  tetris:Object.freeze({gameId:'tetris',resource:'renderer',variant:'primary',url:'./three/tetris-entry.js?v=sha256-ce7c38dec42b212f',sha256:'ce7c38dec42b212fca6dbcfefe0b3ce073165f85a2d0c6a78cc625b87d044ddd',exports:Object.freeze(['isTetris3DSupported','createTetris3DAdapter'])}),
  tank:Object.freeze({gameId:'tank',resource:'renderer',variant:'primary',url:'./three/tank-entry.js?v=sha256-5858d98dd19650f7',sha256:'5858d98dd19650f78b272e9d703977b10233839d842f686192f60e3e8d33a733',exports:Object.freeze(['isTank3DSupported','createTank3DAdapter'])})
});
const TANK_RETRY_DESCRIPTOR=Object.freeze({gameId:'tank',resource:'renderer',variant:'retry1',url:'./three/tank-entry.js?v=sha256-5858d98dd19650f7-retry1',sha256:'5858d98dd19650f78b272e9d703977b10233839d842f686192f60e3e8d33a733',exports:Object.freeze(['isTank3DSupported','createTank3DAdapter'])});
const RENDERER_URL_ALLOWLIST=new Map(Object.keys(RENDERER_ENTRY_ALLOWLIST).map(gameId=>{
  const descriptor=RENDERER_ENTRY_ALLOWLIST[gameId];
  return [new URL(descriptor.url,self.location.href).href,descriptor];
}).concat([[new URL(TANK_RETRY_DESCRIPTOR.url,self.location.href).href,TANK_RETRY_DESCRIPTOR]]));
const RENDERER_WARMUP_PENDING=new Map();

function privateRequest(request,url){
  return request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('authorization')||
    /(?:^|\/)api(?:\/|$)/.test(url.pathname)||/(?:^|\/)ws(?:\/|$)/.test(url.pathname)||
    /(?:token|session|message|chat)/i.test(url.search);
}
function offlineLocaleRequest(request,url){
  return request.method==='GET'&&url.search===''&&LOCALE_URLS.has(url.href);
}
function validLocaleResponse(response){
  const contentType=response&&response.headers.get('content-type')||'';
  return !!(response&&response.ok&&response.type==='basic'&&/^application\/json(?:;|$)/i.test(contentType)&&!/no-store/i.test(response.headers.get('cache-control')||''));
}
function validRendererResponse(response){
  const contentType=response&&response.headers.get('content-type')||'';
  return !!(response&&response.ok&&response.type==='basic'&&/^(?:application|text)\/(?:javascript|ecmascript)(?:;|$)/i.test(contentType)&&!/no-store/i.test(response.headers.get('cache-control')||''));
}
function rendererDescriptorForUrl(url){
  return url&&url.search&&RENDERER_URL_ALLOWLIST.get(url.href)||null;
}
function rendererDescriptor(gameId,resource,variant){
  const descriptor=typeof gameId==='string'?RENDERER_ENTRY_ALLOWLIST[gameId]:null;
  if(!descriptor||resource!==RENDERER_RESOURCE)return null;
  if(variant===RENDERER_VARIANT)return descriptor;
  return gameId==='tank'&&variant===RENDERER_RETRY_VARIANT?TANK_RETRY_DESCRIPTOR:null;
}
function rendererEntryRequest(url){
  return !!(url&&url.origin===self.location.origin&&/(?:^|\/)three\/[a-z0-9-]+-entry\.js$/i.test(url.pathname));
}
function plainRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  try{
    const prototype=Object.getPrototypeOf(value);
    if(prototype===null)return true;
    if(Object.prototype.toString.call(value)!=='[object Object]')return false;
    const constructor=Object.prototype.hasOwnProperty.call(prototype,'constructor')&&prototype.constructor;
    return typeof constructor==='function'&&constructor.name==='Object';
  }catch(_error){return false;}
}
function sameOriginClient(event){
  const source=event&&event.source;
  if(!source||typeof source.id!=='string'||!source.id||typeof source.url!=='string'||typeof source.postMessage!=='function')return false;
  try{
    const clientUrl=new URL(source.url);
    return clientUrl.origin===self.location.origin&&
      (!(typeof event.origin==='string'&&event.origin)||event.origin===self.location.origin);
  }catch(_error){return false;}
}
function warmupDescriptorFromEvent(event){
  if(!sameOriginClient(event)||!plainRecord(event.data))return null;
  let keys;
  try{keys=Object.keys(event.data);}catch(_error){return null;}
  const allowed=new Set(['type','gameId','resource','variant']);
  if(keys.length!==allowed.size||keys.some(key=>!allowed.has(key)))return null;
  try{
    if(event.data.type!==WARMUP_TYPE)return null;
    return rendererDescriptor(event.data.gameId,event.data.resource,event.data.variant);
  }catch(_error){return null;}
}
function replyDescriptorCheck(event){
  if(!sameOriginClient(event)||!plainRecord(event.data))return false;
  let keys;
  try{keys=Object.keys(event.data);}catch(_error){return false;}
  const allowed=new Set(['type','gameId','resource','variant','sha256']);
  if(keys.length!==allowed.size||keys.some(key=>!allowed.has(key))||event.data.type!==DESCRIPTOR_CHECK_TYPE)return false;
  const port=event.ports&&event.ports[0];
  if(!port||typeof port.postMessage!=='function')return false;
  let descriptor=null;
  try{descriptor=rendererDescriptor(event.data.gameId,event.data.resource,event.data.variant);}catch(_error){descriptor=null;}
  const ok=!!(descriptor&&event.data.sha256===descriptor.sha256);
  try{
    port.postMessage({
      type:DESCRIPTOR_RESULT_TYPE,
      ok,
      cacheVersion:RENDERER_CACHE_VERSION,
      gameId:descriptor?descriptor.gameId:null,
      resource:descriptor?descriptor.resource:null,
      variant:descriptor?descriptor.variant:null,
      url:descriptor?descriptor.url:null,
      sha256:descriptor?descriptor.sha256:null,
    });
    return true;
  }catch(_error){return false;}
}
function rendererFailureResponse(){
  return new Response('',{status:503,headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
}
function digestHex(buffer){
  const bytes=new Uint8Array(buffer);
  let value='';
  for(let index=0;index<bytes.length;index+=1)value+=bytes[index].toString(16).padStart(2,'0');
  return value;
}
async function verifiedRendererResponse(response,descriptor){
  if(!validRendererResponse(response)||!descriptor||typeof descriptor.sha256!=='string')return false;
  try{
    const subtle=self.crypto&&self.crypto.subtle;
    if(!subtle||typeof subtle.digest!=='function')return false;
    const digest=await subtle.digest('SHA-256',await response.clone().arrayBuffer());
    return digestHex(digest)===descriptor.sha256;
  }catch(_error){return false;}
}
async function cacheFirstRenderer(request,descriptor){
  let cache=null;
  try{
    cache=await caches.open(RENDERER_CACHE_VERSION);
    const hit=await cache.match(request);
    if(hit)return hit;
  }catch(_error){cache=null;}
  let response;
  try{response=await fetch(request,{cache:'no-cache'});}catch(_error){return rendererFailureResponse();}
  if(!await verifiedRendererResponse(response,descriptor))return rendererFailureResponse();
  if(cache){try{await cache.put(request,response.clone());}catch(_error){}}
  return response;
}
async function warmRendererOnce(descriptor){
  const url=new URL(descriptor.url,self.location.href).href;
  let cache;
  try{
    cache=await caches.open(RENDERER_CACHE_VERSION);
    if(await cache.match(url))return true;
  }catch(_error){return false;}
  let response;
  try{response=await fetch(url,{cache:'no-cache'});}catch(_error){return false;}
  if(!await verifiedRendererResponse(response,descriptor))return false;
  try{await cache.put(url,response.clone());return true;}catch(_error){return false;}
}
async function warmRenderer(descriptor){
  if(!descriptor||typeof descriptor.gameId!=='string')return Promise.resolve(false);
  const key=descriptor.gameId+':'+descriptor.variant;
  const pending=RENDERER_WARMUP_PENDING.get(key);
  if(pending)return pending;
  const work=warmRendererOnce(descriptor);
  RENDERER_WARMUP_PENDING.set(key,work);
  work.then(()=>{if(RENDERER_WARMUP_PENDING.get(key)===work)RENDERER_WARMUP_PENDING.delete(key);},()=>{if(RENDERER_WARMUP_PENDING.get(key)===work)RENDERER_WARMUP_PENDING.delete(key);});
  return work;
}
async function installShell(){
  const cache=await caches.open(CACHE_VERSION);
  try{
    await cache.addAll(SHELL);
    for(const file of LOCALE_FILES){
      const url=new URL(file,self.location.href).href;
      const response=await fetch(url,{cache:'no-cache'});
      if(!validLocaleResponse(response))throw new Error('invalid_locale_response');
      await cache.put(url,response.clone());
    }
  }catch(error){
    await caches.delete(CACHE_VERSION);
    throw error;
  }
}
async function networkFirstNavigation(request){
  const cache=await caches.open(CACHE_VERSION);
  try{
    const response=await fetch(request);
    const contentType=response&&response.headers.get('content-type')||'';
    if(response&&response.ok&&response.type==='basic'&&/^text\/html(?:;|$)/i.test(contentType)&&!/no-store/i.test(response.headers.get('cache-control')||''))await cache.put('./index.html',response.clone());
    return response;
  }catch{
    return await cache.match('./index.html')||await cache.match('./')||new Response('<!doctype html><meta charset="utf-8"><title>Ghost Game</title><main><h1>Ghost Game</h1><p>当前离线，请恢复网络后重试。</p></main>',{
      status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}
    });
  }
}
async function networkFirstLocale(request){
  const cache=await caches.open(CACHE_VERSION);
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(validLocaleResponse(response)){
      try{await cache.put(request,response.clone());}catch{}
      return response;
    }
  }catch{}
  return await cache.match(request)||new Response('{}',{
    status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
async function cacheFirstStatic(request){
  const cache=await caches.open(CACHE_VERSION),hit=await cache.match(request);
  if(hit)return hit;
  const response=await fetch(request);
  if(response&&response.ok&&response.type==='basic'&&!/no-store/i.test(response.headers.get('cache-control')||''))await cache.put(request,response.clone());
  return response;
}

self.addEventListener('install',event=>event.waitUntil(installShell()));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ghost-game-')&&key!==CACHE_VERSION&&key!==RENDERER_CACHE_VERSION).map(key=>caches.delete(key)))),
  self.clients.claim(),
])));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  const descriptor=rendererDescriptorForUrl(url);
  if(descriptor){event.respondWith(cacheFirstRenderer(request,descriptor));return;}
  if(rendererEntryRequest(url)){event.respondWith(Promise.resolve(rendererFailureResponse()));return;}
  if(privateRequest(request,url))return;
  if(request.mode==='navigate'){event.respondWith(networkFirstNavigation(request));return;}
  if(offlineLocaleRequest(request,url)){event.respondWith(networkFirstLocale(request));return;}
  if(CACHEABLE_DESTINATIONS.has(request.destination)&&!url.pathname.toLowerCase().endsWith('.json'))event.respondWith(cacheFirstStatic(request));
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING'){self.skipWaiting();return;}
  if(event.data&&event.data.type===DESCRIPTOR_CHECK_TYPE){replyDescriptorCheck(event);return;}
  const descriptor=warmupDescriptorFromEvent(event);
  if(descriptor&&typeof event.waitUntil==='function')event.waitUntil(warmRenderer(descriptor).catch(()=>false));
});
