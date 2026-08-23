import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS=Object.freeze({gsap:'3.15.0',adapter:'replay-cinematic-25d-v1'});

export function createReplayCinematicAdapter(){
  if(!CSSPlugin)throw new Error('REPLAY_CINEMATIC_CSS_PLUGIN_UNAVAILABLE');
  let timeline=null,disposed=false,touched=[];
  function clear(){if(touched.length)gsap.set(touched,{clearProps:'transform,opacity,visibility,will-change'});touched=[];}
  function settle(){if(timeline){timeline.kill();timeline=null;}clear();}
  function run(request={}){
    if(disposed)throw new Error('REPLAY_CINEMATIC_DISPOSED');settle();
    const state=String(request.state||'overview'),overlay=request.overlay,layers=Array.from(request.layers||[]).filter(Boolean);touched=[overlay,...layers].filter(Boolean);
    timeline=gsap.timeline({defaults:{overwrite:'auto'},onStart(){if(touched.length)gsap.set(touched,{willChange:'transform,opacity'});},onComplete(){timeline=null;clear();if(typeof request.onComplete==='function')request.onComplete();}});
    timeline.addLabel('replay-'+state,0);
    if(state==='result')timeline.fromTo(layers,{scale:.96,autoAlpha:.55},{scale:1,autoAlpha:1,duration:.28,ease:'power2.out',stagger:{amount:.08,from:'center'}},0);
    else if(state==='playing'||state==='seeking')timeline.fromTo(layers,{xPercent:state==='seeking'?-1.2:-.6,autoAlpha:.7},{xPercent:0,autoAlpha:1,duration:state==='seeking'?.16:.22,ease:'power2.out',stagger:{amount:.06,from:'start'}},0);
    else if(state==='paused')timeline.to(overlay,{scale:.998,autoAlpha:.92,duration:.16,ease:'power1.out'},0);
    else timeline.fromTo(overlay,{scale:.995,autoAlpha:.82},{scale:1,autoAlpha:1,duration:.2,ease:'power2.out'},0);
    return Object.freeze({kill(){settle();}});
  }
  function dispose(){if(disposed)return;disposed=true;settle();}
  return Object.freeze({run,settle,dispose});
}
