'use strict';

const CACHE_VERSION='ghost-game-shell-v22-20260824';
const LOCALE_FILES=['./locales/zh-CN.json','./locales/en-US.json','./locales/uk-UA.json'];
const LOCALE_URLS=new Set(LOCALE_FILES.map(file=>new URL(file,self.location.href).href));
const PRESENTATION_STYLES=['./styles/00-platform-foundation.css','./styles/05-game-tabletops.css','./styles/08-responsive-accessibility.css','./styles/10-outcome-profile.css','./styles/12-motion-design.css','./styles/14-brand-shell.css','./styles/20-game-stage-base.css','./styles/22-game-stage-wave.css','./styles/24-depth-spatial.css','./styles/26-immersive-stage.css','./styles/28-game-icon-system.css','./styles/community-ai-surfaces.css','./styles/identity-broadcast.css','./styles/profile-adaptive-hero.css','./styles/tank-controls.css'];
const SHELL=['./','./index.html','./ghost-layout.css','./styles/00-layout-tokens.css','./styles/10-layout-shell.css','./styles/20-layout-surfaces.css','./styles/30-layout-commerce.css','./styles/40-layout-content.css','./manifest.webmanifest','./assets/brand/ghost-game-mark.svg','./assets/brand/honru-mascot-v1.svg','./assets/brand/pwa/ghost-game-192.png','./assets/brand/pwa/ghost-game-512.png','./assets/brand/pwa/ghost-wake-v1/ghost-game-maskable-192-v1.png','./assets/brand/pwa/ghost-wake-v1/ghost-game-maskable-512-v1.png','./assets/ui/loading/ghost-boot-v1/honru-boot-controller-hug-320-v1.webp'];
const CACHEABLE_DESTINATIONS=new Set(['image','style','script','font','manifest']);
SHELL.unshift(...PRESENTATION_STYLES);

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
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ghost-game-')&&key!==CACHE_VERSION).map(key=>caches.delete(key)))),
  self.clients.claim(),
])));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(privateRequest(request,url))return;
  if(request.mode==='navigate'){event.respondWith(networkFirstNavigation(request));return;}
  if(offlineLocaleRequest(request,url)){event.respondWith(networkFirstLocale(request));return;}
  if(CACHEABLE_DESTINATIONS.has(request.destination)&&!url.pathname.toLowerCase().endsWith('.json'))event.respondWith(cacheFirstStatic(request));
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING'){self.skipWaiting();return;}
});
