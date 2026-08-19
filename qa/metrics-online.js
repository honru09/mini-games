'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),DATA=fs.mkdtempSync(path.join(ROOT,'data','metrics-')),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let PORT=Number(process.env.METRICS_PORT)||0;
const failures=[];function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
function request(target,headers={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:PORT,path:target,headers},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});}
function freePort(){return new Promise((resolve,reject)=>{const probe=http.createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const address=probe.address(),port=address&&address.port;probe.close(error=>error?reject(error):resolve(port));});});}
async function main(){
  if(!PORT)PORT=await freePort();
  fs.writeFileSync(path.join(DATA,'leaderboard.json'),JSON.stringify({opsIncidents:[{fingerprint:'0123456789abcdef',context:'Bearer secret-token-value',kind:'Bearer secret-token-value',count:'Infinity',firstAt:'Infinity',lastAt:-1}]}));
  const token='metrics-test-token-123456789',server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',METRICS_ADMIN_TOKEN:token,SUPABASE_URL:'',SUPABASE_KEY:''},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
  try{
    for(let i=0;i<100&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
    const dashboard=await request('/admin-metrics.html'),dashboardText=dashboard.body.toString('utf8');check('Metrics：只读仪表盘可加载且不内嵌管理令牌',dashboard.status===200&&dashboardText.includes('/api/metrics/history')&&!dashboardText.includes(token));
    for(const endpoint of ['/api/metrics','/api/metrics/history','/api/metrics/export']){const denied=await request(endpoint);check('Metrics：'+endpoint+' 拒绝未鉴权读取',denied.status===401);}
    const headers={Authorization:'Bearer '+token},current=await request('/api/metrics',headers);let payload={};try{payload=JSON.parse(current.body.toString('utf8'));}catch{}
    const safe=current.status===200&&payload.version==='metrics-v2'&&payload.data&&payload.data.activeMatches===0&&Array.isArray(payload.alerts)&&Array.isArray(payload.incidents)&&!JSON.stringify(payload).match(/pin|session|profile/i);check('Metrics：管理员只读返回脱敏聚合、告警与错误闭环',safe,JSON.stringify(payload));
    const persistedIncident=payload.incidents&&payload.incidents.find(item=>item.fingerprint==='0123456789abcdef');check('Metrics：恶意持久 incident 在回显前重新净化',persistedIncident&&persistedIncident.context==='unknown'&&persistedIncident.kind==='Error'&&persistedIncident.count===1&&persistedIncident.firstAt===0&&persistedIncident.lastAt===0&&!JSON.stringify(payload).includes('secret-token-value')&&!JSON.stringify(payload).includes('Infinity'),JSON.stringify(persistedIncident));
    const history=await request('/api/metrics/history',headers);let historyPayload={};try{historyPayload=JSON.parse(history.body.toString('utf8'));}catch{}const historySafe=history.status===200&&Array.isArray(historyPayload.history)&&historyPayload.history.length>=1&&historyPayload.history.every(item=>item.generatedAt&&Object.entries(item).every(([key,value])=>key==='generatedAt'||Number.isFinite(Number(value))));check('Metrics：历史快照有界且只含时间与数值',historySafe,JSON.stringify(historyPayload.history));
    const exported=await request('/api/metrics/export',headers),csv=exported.body.toString('utf8');check('Metrics：CSV 导出受鉴权且不含敏感字段',exported.status===200&&/^text\/csv/.test(String(exported.headers['content-type']))&&csv.includes('generatedAt')&&!/pin|session|profile|metrics-test-token/i.test(csv),csv.slice(0,200));
    await sleep(80);const db=JSON.parse(fs.readFileSync(path.join(DATA,'leaderboard.json'),'utf8')),reads=(db.events||[]).filter(item=>item.event==='metrics_read');check('Metrics：访问审计只保存路径与不可逆 IP 摘要',reads.length>=3&&reads.every(item=>/^\/api\/metrics/.test(item.metadata.path)&&/^[a-f0-9]{16}$/.test(item.metadata.ipHash)&&!JSON.stringify(item).includes(token)),JSON.stringify(reads));
    if(!failures.length)console.log('METRICS_ONLINE_ALL_PASS');
  }finally{server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
  if(failures.length){console.error('METRICS_ONLINE_FAILED:',failures.join('、'));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
