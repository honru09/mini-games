'use strict';

(function expose(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MonopolyCharacterPresentation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMonopolyCharacterPresentation(){
  const SCHEMA_VERSION = 'monopoly-character-presentation-v1';
  const PLAYER_CHARACTER_SCHEMA = 'player-character-v1';
  const BOARD_SIZE = 24;
  const SLOT_NAMES = Object.freeze(['body','face','hair','top','bottom','footwear','accessory']);
  const CATALOG = Object.freeze({
    characters:Object.freeze(['character-base-01']),
    slots:Object.freeze({
      body:Object.freeze(['body-paper-01']), face:Object.freeze(['face-dot-01']),
      hair:Object.freeze(['hair-none']), top:Object.freeze(['top-hoodie-01']),
      bottom:Object.freeze(['bottom-shorts-01']), footwear:Object.freeze(['footwear-sneakers-01']),
      accessory:Object.freeze(['accessory-none']),
    }),
  });
  const DEFAULT_CHARACTER = Object.freeze({
    schemaVersion:PLAYER_CHARACTER_SCHEMA,
    characterId:'character-base-01',
    slots:Object.freeze({body:'body-paper-01',face:'face-dot-01',hair:'hair-none',top:'top-hoodie-01',bottom:'bottom-shorts-01',footwear:'footwear-sneakers-01',accessory:'accessory-none'}),
  });
  const SOURCES = new Set(['live','snapshot','reconnect','spectator','replay']);

  function safeRecord(value){
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try { const proto=Object.getPrototypeOf(value); return proto===Object.prototype||proto===null; } catch { return false; }
  }
  function defaultCharacter(){return {schemaVersion:DEFAULT_CHARACTER.schemaVersion,characterId:DEFAULT_CHARACTER.characterId,slots:{...DEFAULT_CHARACTER.slots}};}
  function normalizeCharacter(value){
    const out=defaultCharacter();
    if(!safeRecord(value)||value.schemaVersion!==PLAYER_CHARACTER_SCHEMA)return out;
    if(CATALOG.characters.includes(value.characterId))out.characterId=value.characterId;
    if(!safeRecord(value.slots))return out;
    for(const slot of SLOT_NAMES){const id=value.slots[slot];if(CATALOG.slots[slot].includes(id))out.slots[slot]=id;}
    return out;
  }
  function position(value){const number=Number(value);return Number.isInteger(number)?((number%BOARD_SIZE)+BOARD_SIZE)%BOARD_SIZE:0;}
  function cardinal(dx,dy){return Math.abs(dx)>=Math.abs(dy)?(dx>=0?'east':'west'):(dy>=0?'south':'north');}
  function facingAt(pos,direction,moving){
    const angle=(-90+position(pos)*360/BOARD_SIZE)*Math.PI/180;
    if(moving){const sign=direction<0?-1:1;return cardinal(-Math.sin(angle)*sign,Math.cos(angle)*sign);}
    return cardinal(-Math.cos(angle),-Math.sin(angle));
  }
  function stateFor(player,seatId,current,phase,over,winner){
    if(player.alive===false)return 'bankrupt';
    if(over||phase==='finished')return seatId===winner?'winner':'settled';
    if(seatId!==current)return 'idle';
    if(phase==='moving'||phase==='resolving')return 'moving';
    if(phase==='chance')return 'event';
    if(phase==='buy')return 'purchase';
    if(phase==='auction')return 'auction';
    if(phase==='roll')return 'turn';
    return 'active';
  }
  function seatFor(seats,index){
    const direct=seats.find(seat=>safeRecord(seat)&&Number(seat.seatId)===index);
    return direct||safeRecord(seats[index])?direct||seats[index]:null;
  }

  // The single external Interface. It hides input validation, privacy-safe
  // character fallback, authority/display position selection and motion policy.
  function project(input){
    const source=safeRecord(input)&&SOURCES.has(input.source)?input.source:'live';
    const players=safeRecord(input)&&Array.isArray(input.players)?input.players.slice(0,5):[];
    const seats=safeRecord(input)&&Array.isArray(input.seats)?input.seats.slice(0,5):[];
    const current=safeRecord(input)&&Number.isInteger(Number(input.current))?Number(input.current):-1;
    const phase=safeRecord(input)&&typeof input.phase==='string'?input.phase:'idle';
    const over=!!(safeRecord(input)&&input.over),winner=safeRecord(input)&&Number.isInteger(Number(input.winner))?Number(input.winner):-1;
    const reducedMotion=!!(safeRecord(input)&&input.reducedMotion);
    const synchronized=source!=='live';
    return players.map((raw,index)=>{
      const player=safeRecord(raw)?raw:{},seat=seatFor(seats,index);
      const authorityPosition=position(player.pos),visualPosition=synchronized?authorityPosition:position(player.visualPos===undefined?player.pos:player.visualPos);
      const state=stateFor(player,index,current,phase,over,winner),direction=Number(player.motionDirection)<0?-1:1;
      return {
        schemaVersion:SCHEMA_VERSION,seatId:index,authorityPosition,displayPosition:visualPosition,
        visible:player.alive!==false,state,facing:facingAt(visualPosition,direction,state==='moving'),
        transition:state==='moving'&&!reducedMotion&&!synchronized?'step':'instant',
        renderMode:'code-fallback',character:normalizeCharacter(seat&&seat.playerCharacter),
      };
    });
  }

  return Object.freeze({SCHEMA_VERSION,BOARD_SIZE,project});
});
