'use strict';
const assert=require('assert');const c=require('../server/companion');let n=0;function ok(name,fn){try{fn();console.log('PASS  '+name);n++;}catch(error){console.error('FAIL  '+name+' :: '+error.message);process.exitCode=1;}}
ok('三语言白名单与未知语言回退',()=>{assert.equal(c.normalizeRequest({locale:'en-US',message:'hi'}).locale,'en-US');assert.equal(c.normalizeRequest({locale:'xx',message:'hi'}).locale,'zh-CN');});
ok('消息 500 字且控制字符净化',()=>{const r=c.normalizeRequest({message:'a\u0000'+('b'.repeat(600))});assert.equal(r.message.length,500);assert(!r.message.includes('\u0000'));});
ok('历史仅保留六轮与安全角色',()=>{const r=c.normalizeRequest({message:'x',history:Array.from({length:8},(_,i)=>({role:i%2?'assistant':'system',content:String(i)}))});assert.equal(r.history.length,6);assert(r.history.every(x=>['user','assistant'].includes(x.role)));});
ok('空消息拒绝',()=>assert.equal(c.normalizeRequest({message:'   '}).valid,false));
ok('Prompt 禁止实时编造与敏感索取',()=>{const p=c.systemPrompt('zh-CN');assert(/no live web access/i.test(p));assert(/passwords/.test(p));});
ok('严格 JSON 白名单',()=>{const p=c.parseResponse('{"reply":"<b>Hello</b>","mood":"evil","animation":"hack"}','en-US');assert.equal(p.reply,'<b>Hello</b>');assert.equal(p.mood,'neutral');assert.equal(p.animation,'idle');});
ok('坏 JSON 安全回退',()=>assert.equal(c.parseResponse('```bad```','uk-UA').sourceType,'offline'));
ok('新闻天气请求不伪造',()=>{assert.equal(c.fallbackKind('latest news'),'news');assert.equal(c.fallbackKind('今天天气'),'weather');assert(/not enabled/.test(c.fallback('en-US','news').reply));});
if(!process.exitCode)console.log('GHOST_COMPANION_ALL_PASS '+n);
