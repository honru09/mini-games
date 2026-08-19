import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS=Object.freeze({gsap:'3.15.0',adapter:'depth-motion-25d-v1'});

export function createDepthMotionAdapter(){
  if(!CSSPlugin)throw new Error('DEPTH_MOTION_CSS_PLUGIN_UNAVAILABLE');
  let timeline=null,disposed=false;
  const touched=new Set();
  function own(node){if(node)touched.add(node);return node;}
  function clear(){for(const node of touched){if(node)gsap.set(node,{clearProps:'transform,opacity,visibility,will-change'});}touched.clear();}
  function kill(){if(timeline){timeline.kill();timeline=null;}}
  function settle(){kill();clear();}
  function run(request={}){
    if(disposed)throw new Error('DEPTH_MOTION_DISPOSED');settle();
    const mode=String(request.mode||'overview'),target=own(request.target),stage=own(request.stage),mascot=own(request.mascot),duration=Number.isFinite(Number(request.duration))?Math.max(0,Number(request.duration)):null;
    timeline=gsap.timeline({defaults:{overwrite:'auto'},onComplete(){timeline=null;clear();if(typeof request.onComplete==='function')request.onComplete();}});
    if(mode==='enter'){
      if(target)timeline.to(target,{y:-8,scale:1.06,rotationX:-1.5,rotationY:2.2,duration:duration||.42,ease:'power3.inOut'},0);
      if(mascot&&target){const from=mascot.getBoundingClientRect(),to=target.getBoundingClientRect();timeline.set(mascot,{x:0,y:0,scale:1,autoAlpha:1},0).to(mascot,{x:to.left+to.width*.5-(from.left+from.width*.5),y:to.top+to.height*.5-(from.top+from.height*.5),scale:.16,rotation:18,autoAlpha:0,duration:duration||.72,ease:'power3.in'},0);}
      if(stage)timeline.fromTo(stage,{scale:.94,autoAlpha:0},{scale:1,autoAlpha:1,duration:duration||.58,ease:'power3.out'},.12);
    }else if(mode==='impact'){
      if(target){const force=Number(request.intensity)||1.5;timeline.to(target,{x:force,scale:1.008,duration:.055,ease:'power1.out'}).to(target,{x:-force,scale:1.014,duration:.055}).to(target,{x:0,scale:1,duration:.09,ease:'power2.out'});}
    }else if(mode==='focus'){
      if(target)timeline.fromTo(target,{scale:1},{scale:1.018,duration:duration||.14,ease:'power2.out'}).to(target,{scale:1,duration:duration||.18,ease:'power2.inOut'});
    }else if(mode==='result'){
      if(target)timeline.fromTo(target,{scale:1,rotationX:0},{scale:1.025,rotationX:-1.2,duration:duration||.28,ease:'back.out(1.25)'}).to(target,{scale:1,rotationX:0,duration:.3,ease:'power2.inOut'});
    }else if(mode==='exit'){
      if(target)timeline.to(target,{scale:.965,autoAlpha:.72,duration:duration||.32,ease:'power2.inOut'});
    }else if(target){
      timeline.fromTo(target,{y:6,autoAlpha:.88},{y:0,autoAlpha:1,duration:duration||.34,ease:'power2.out'});
    }
    return Object.freeze({kill(){settle();}});
  }
  function dispose(){if(disposed)return;disposed=true;settle();}
  return Object.freeze({run,settle,dispose});
}
