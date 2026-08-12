'use strict';

const CACHE_VERSION='ghost-game-shell-v5-20260812';
const SHELL=['./','./index.html','./manifest.webmanifest','./assets/brand/ghost-game-mark.svg','./assets/brand/honru-mascot-v1.svg','./assets/brand/pwa/ghost-game-192.png','./assets/brand/pwa/ghost-game-512.png'];
const CACHEABLE_DESTINATIONS=new Set(['image','style','script','font','manifest']);

function privateRequest(request,url){
  return request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('authorization')||
    /(?:^|\/)api(?:\/|$)/.test(url.pathname)||/(?:^|\/)ws(?:\/|$)/.test(url.pathname)||
    /(?:token|session|message|chat)/i.test(url.search);
}
async function networkFirstNavigation(request){
  const cache=await caches.open(CACHE_VERSION);
  try{
    const response=await fetch(request);
    if(response&&response.ok&&response.type==='basic'&&!/no-store/i.test(response.headers.get('cache-control')||''))await cache.put('./index.html',response.clone());
    return response;
  }catch{
    return await cache.match('./index.html')||await cache.match('./')||new Response('<!doctype html><meta charset="utf-8"><title>Ghost Game</title><main><h1>Ghost Game</h1><p>当前离线，请恢复网络后重试。</p></main>',{
      status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}
    });
  }
}
async function cacheFirstStatic(request){
  const cache=await caches.open(CACHE_VERSION),hit=await cache.match(request);
  if(hit)return hit;
  const response=await fetch(request);
  if(response&&response.ok&&response.type==='basic'&&!/no-store/i.test(response.headers.get('cache-control')||''))await cache.put(request,response.clone());
  return response;
}

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ghost-game-')&&key!==CACHE_VERSION).map(key=>caches.delete(key)))),
  self.clients.claim(),
])));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(privateRequest(request,url))return;
  if(request.mode==='navigate'){event.respondWith(networkFirstNavigation(request));return;}
  if(CACHEABLE_DESTINATIONS.has(request.destination))event.respondWith(cacheFirstStatic(request));
});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();});
