'use strict';

const LOCALES=new Set(['zh-CN','en-US','uk-UA']);
const MOODS=new Set(['neutral','happy','sad','frustrated','curious','tired','supportive']);
const ANIMATIONS=new Set(['idle','wave','bounce','listen','comfort','think']);
const FALLBACKS={
  'zh-CN':{normal:'我在这里。网络伙伴暂时走远了，不过我们仍可以先选一款游戏。',news:'实时新闻源暂未启用，我不会拿旧消息冒充今天的新闻。',weather:'天气需要你主动提供城市，并且当前天气服务尚未启用。'},
  'en-US':{normal:'I am right here. My online brain is resting, but we can still choose a game.',news:'Live news is not enabled, so I will not present old information as current.',weather:'Weather needs a city you choose, and the weather service is not enabled yet.'},
  'uk-UA':{normal:'Я поруч. Онлайн-помічник зараз відпочиває, але ми можемо вибрати гру.',news:'Джерело актуальних новин ще не ввімкнено, тому я не видаватиму старі дані за свіжі.',weather:'Для погоди потрібне місто, яке ви вкажете самі; сервіс погоди ще не ввімкнено.'},
};
function locale(value){return LOCALES.has(value)?value:'zh-CN';}
function cleanText(value,max){return String(value==null?'':value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max);}
function normalizeRequest(body){
  body=body&&typeof body==='object'?body:{};const selected=locale(body.locale),message=cleanText(body.message,500);
  const history=(Array.isArray(body.history)?body.history:[]).slice(-6).map(item=>({role:item&&item.role==='assistant'?'assistant':'user',content:cleanText(item&&item.content,500)})).filter(item=>item.content);
  return {valid:!!message.trim(),locale:selected,message,history,reason:message.trim()?'':'message_required'};
}
function systemPrompt(selected){
  const language=selected==='en-US'?'English':selected==='uk-UA'?'Ukrainian':'Simplified Chinese';
  return 'You are Honru, the original black-and-white ghost-controller mascot of Ghost Game. Be warm, playful, concise, and suitable for all ages. Reply in '+language+'. Never ask for passwords, tokens, payment details, exact location, or other secrets. Do not diagnose mental health; acknowledge feelings gently. You have no live web access. Never invent current weather or news. If asked for current weather, say the user must provide a city and the service may be unavailable. If asked for news, clearly say live news is unavailable unless verified headlines are supplied by the server. Recommend only these games when helpful: Gomoku, Ludo, Mini Monopoly, Tank Battle, Tetris, Xiangqi. Return JSON only with keys reply, mood, animation. mood must be neutral, happy, sad, frustrated, curious, tired, or supportive. animation must be idle, wave, bounce, listen, comfort, or think.';
}
function parseResponse(content,selected){
  let value=null;try{value=JSON.parse(String(content||'').replace(/```json|```/g,'').trim());}catch{}
  if(!value||typeof value.reply!=='string'||!value.reply.trim())return fallback(selected,'normal');
  return {reply:cleanText(value.reply,600),mood:MOODS.has(value.mood)?value.mood:'neutral',animation:ANIMATIONS.has(value.animation)?value.animation:'idle',sourceType:'model'};
}
function fallback(selected,kind){const table=FALLBACKS[locale(selected)],key=kind==='news'?'news':kind==='weather'?'weather':'normal';return{reply:table[key],mood:key==='normal'?'supportive':'neutral',animation:key==='normal'?'wave':'think',sourceType:'offline'};}
function fallbackKind(message){const text=String(message||'').toLowerCase();if(/新闻|news|новин/.test(text))return'news';if(/天气|weather|погод/.test(text))return'weather';return'normal';}
module.exports=Object.freeze({LOCALES,MOODS,ANIMATIONS,normalizeRequest,systemPrompt,parseResponse,fallback,fallbackKind});
