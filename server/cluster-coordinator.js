'use strict';

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const TOPICS = Object.freeze(['direct_message','direct_message_read']);
const BANNED_KEY = /^(body|text|message|password|pin|token|secret|prompt|authorization)$/i;

function safeId(value, fallback){
  const text=String(value||'').trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(text)?text:fallback;
}
function privateAddress(address){
  if(net.isIPv4(address)){
    const parts=address.split('.').map(Number);
    return parts[0]===10||parts[0]===127||parts[0]===0||parts[0]===169&&parts[1]===254||
      parts[0]===172&&parts[1]>=16&&parts[1]<=31||parts[0]===192&&parts[1]===168||parts[0]>=224;
  }
  if(net.isIPv6(address)){
    const value=address.toLowerCase();
    if(value.startsWith('::ffff:'))return privateAddress(value.slice(7));
    return value==='::1'||value==='::'||value.startsWith('fc')||value.startsWith('fd')||value.startsWith('fe8')||
      value.startsWith('fe9')||value.startsWith('fea')||value.startsWith('feb')||value.startsWith('ff');
  }
  return true;
}
function safeMetrics(input){
  const output={generatedAt:String(input&&input.generatedAt||new Date().toISOString())};
  for(const [key,value] of Object.entries(input||{})){
    if(key==='generatedAt'||BANNED_KEY.test(key)||!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key))continue;
    const number=Number(value);if(Number.isFinite(number))output[key]=number;
  }
  return output;
}

class TelemetryExporter {
  constructor(options={}){
    this.url=String(options.url||'').trim();
    this.token=String(options.token||'');
    this.allowlist=new Set(String(options.allowlist||'').split(',').map(item=>item.trim().toLowerCase()).filter(Boolean));
    this.fetch=options.fetchImpl||globalThis.fetch;
    this.onError=typeof options.onError==='function'?options.onError:()=>{};
    this.inFlight=false;
  }
  async validate(){
    if(!this.url)return false;
    let parsed;try{parsed=new URL(this.url);}catch{throw new Error('telemetry_url_invalid');}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port&&parsed.port!=='443'||
       !this.allowlist.has(parsed.hostname.toLowerCase()))throw new Error('telemetry_destination_not_allowed');
    if(net.isIP(parsed.hostname)||parsed.hostname==='localhost'||parsed.hostname.endsWith('.local'))throw new Error('telemetry_private_destination');
    const records=await dns.lookup(parsed.hostname,{all:true,verbatim:true});
    if(!records.length||records.some(record=>privateAddress(record.address)))throw new Error('telemetry_private_destination');
    return true;
  }
  async send(snapshot,metadata={}){
    if(!this.url||this.inFlight)return false;
    this.inFlight=true;
    try{
      await this.validate();
      const body=JSON.stringify({version:'telemetry-export-v1',instanceId:String(metadata.instanceId||''),
        deploymentId:String(metadata.deploymentId||'').slice(0,160),metrics:safeMetrics(snapshot)});
      if(Buffer.byteLength(body)>65536)throw new Error('telemetry_batch_too_large');
      let lastError;
      for(let attempt=0;attempt<3;attempt++){
        try{
          const response=await this.fetch(this.url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(5000),
            headers:{'Content-Type':'application/json','User-Agent':'ghost-game-telemetry-v1',...(this.token?{Authorization:'Bearer '+this.token}:{})},body});
          if(response.status>=300&&response.status<400)throw new Error('telemetry_redirect_rejected');
          if(!response.ok)throw new Error('telemetry_http_'+response.status);
          return true;
        }catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*Math.pow(2,attempt)));}
      }
      throw lastError||new Error('telemetry_delivery_failed');
    }catch(error){this.onError('telemetry_export',error);return false;}
    finally{this.inFlight=false;}
  }
}

class ClusterCoordinator {
  constructor(options={}){
    this.enabled=options.enabled===true;
    this.rpc=options.rpc;
    this.onEvent=typeof options.onEvent==='function'?options.onEvent:async()=>{};
    this.onError=typeof options.onError==='function'?options.onError:()=>{};
    this.instanceId=safeId(options.instanceId,'mg-'+crypto.randomBytes(12).toString('hex'));
    this.deploymentId=String(options.deploymentId||'').slice(0,160);
    this.leaseKey='maintenance:outbox';
    this.leaseToken='0';
    this.leader=false;
    this.running=false;
    this.polling=false;
    this.cleaning=false;
    this.timers=[];
    this.exporter=new TelemetryExporter({url:options.telemetryUrl,token:options.telemetryToken,
      allowlist:options.telemetryAllowlist,fetchImpl:options.fetchImpl,onError:this.onError});
  }
  async call(name,payload){
    if(!this.enabled||typeof this.rpc!=='function')return null;
    return this.rpc(name,payload);
  }
  isLeader(){return !this.enabled||this.leader;}
  async maintainLease(){
    try{
      let result;
      if(this.leader&&this.leaseToken!=='0')result=await this.call('renew_cluster_lease_v1',{
        p_lease_key:this.leaseKey,p_instance_id:this.instanceId,p_fencing_token:this.leaseToken,p_ttl_seconds:30});
      if(!result||result.renewed!==true){
        result=await this.call('claim_cluster_lease_v1',{p_lease_key:this.leaseKey,p_instance_id:this.instanceId,p_ttl_seconds:30,
          p_deployment_id:this.deploymentId,p_metadata:{runtime:'node',protocol:'cluster-coordinator-v1'}});
        this.leader=!!(result&&result.claimed===true);this.leaseToken=String(result&&result.fencingToken||'0');
      }else this.leader=true;
    }catch(error){this.leader=false;this.onError('cluster_lease',error);}
  }
  async publish(topic,dedupeKey,payload,leaseProtected=false){
    if(!this.enabled)return null;
    let lastError;
    for(let attempt=0;attempt<3;attempt++){
      try{return await this.call('append_platform_event_v1',{p_topic:topic,p_dedupe_key:String(dedupeKey),p_payload:payload,
        p_origin_instance_id:this.instanceId,p_lease_key:leaseProtected?this.leaseKey:null,
        p_fencing_token:leaseProtected?this.leaseToken:null});}
      catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,100*Math.pow(2,attempt)));}
    }
    throw lastError||new Error('platform_event_publish_failed');
  }
  publishDirectMessage(messageId,senderUid,recipientUid){
    return this.publish('direct_message','dm:'+messageId,{messageId:String(messageId),senderUid:String(senderUid),recipientUid:String(recipientUid)});
  }
  publishDirectMessageRead(conversationId,readerUid,peerUid,throughSeq){
    const dedupe=['dmr',conversationId,readerUid,throughSeq].join(':').replace(/[^A-Za-z0-9._:-]/g,'_').slice(0,160);
    return this.publish('direct_message_read',dedupe,{conversationId:String(conversationId),readerUid:String(readerUid),peerUid:String(peerUid),throughSeq:String(throughSeq)});
  }
  async poll(){
    if(!this.enabled||this.polling)return;this.polling=true;
    try{
      for(const topic of TOPICS){
        const events=await this.call('list_platform_events_v1',{p_consumer_id:this.instanceId,p_topic:topic,p_limit:100});
        let lastId='0';
        for(const event of Array.isArray(events)?events:[]){
          if(event&&event.originInstanceId!==this.instanceId)await this.onEvent(topic,event.payload||{},event);
          lastId=String(event&&event.id||lastId);
        }
        if(lastId!=='0')await this.call('commit_cluster_cursor_v1',{p_consumer_id:this.instanceId,p_topic:topic,p_last_event_id:lastId});
      }
    }catch(error){this.onError('cluster_poll',error);}
    finally{this.polling=false;}
  }
  async recordMetrics(snapshot){
    if(!this.enabled)return false;
    const safe=safeMetrics(snapshot),generatedAt=safe.generatedAt;
    try{
      const stored=await this.call('append_metrics_snapshot_v1',{p_instance_id:this.instanceId,p_generated_at:generatedAt,p_payload:safe});
      if(this.leader)await this.publish('metrics_snapshot','metrics:'+String(stored&&stored.id||crypto.createHash('sha256').update(generatedAt).digest('hex').slice(0,16)),
        {snapshotId:String(stored&&stored.id||''),generatedAt},true);
      if(this.leader)await this.exporter.send(safe,{instanceId:this.instanceId,deploymentId:this.deploymentId});
      return true;
    }catch(error){this.onError('cluster_metrics',error);return false;}
  }
  async cleanup(){
    if(!this.enabled||!this.leader||this.cleaning)return false;this.cleaning=true;
    try{await this.call('cleanup_cluster_data_v1',{p_instance_id:this.instanceId,p_fencing_token:this.leaseToken});return true;}
    catch(error){this.onError('cluster_cleanup',error);return false;}
    finally{this.cleaning=false;}
  }
  async start(){
    if(!this.enabled||this.running)return;this.running=true;
    await this.maintainLease();await this.poll();await this.cleanup();
    const lease=setInterval(()=>this.maintainLease(),10000),poll=setInterval(()=>this.poll(),1500),cleanup=setInterval(()=>this.cleanup(),60*60*1000);
    for(const timer of [lease,poll,cleanup]){if(timer.unref)timer.unref();this.timers.push(timer);}
  }
  stop(){this.running=false;for(const timer of this.timers)clearInterval(timer);this.timers=[];this.leader=false;}
}

module.exports={ClusterCoordinator,TelemetryExporter,safeMetrics,privateAddress};
