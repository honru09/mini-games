import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS=Object.freeze({gsap:'3.15.0',adapter:'depth-motion-25d-v3'});

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
    const intensity=Math.max(.55,Math.min(2.4,Number(request.intensity)||1)),direction=Number(request.direction)<0?-1:1;
    timeline=gsap.timeline({defaults:{overwrite:'auto'},onStart(){for(const node of touched)gsap.set(node,{willChange:'transform,opacity'});},onComplete(){timeline=null;clear();if(typeof request.onComplete==='function')request.onComplete();}});
    if(mode==='enter'){
      timeline.addLabel('stage-enter',0);
      if(target)timeline.to(target,{y:-4,scale:1.025,rotationX:-.6,rotationY:.6,duration:duration||.36,ease:'power3.inOut'},0);
      if(mascot&&target){const from=mascot.getBoundingClientRect(),to=target.getBoundingClientRect();timeline.set(mascot,{x:0,y:0,scale:1,autoAlpha:1},0).to(mascot,{x:to.left+to.width*.5-(from.left+from.width*.5),y:to.top+to.height*.5-(from.top+from.height*.5),scale:.16,rotation:18,autoAlpha:0,duration:duration||.72,ease:'power3.in'},0);}
      if(stage)timeline.fromTo(stage,{scale:.94,autoAlpha:0},{scale:1,autoAlpha:1,duration:duration||.58,ease:'power3.out'},.12);
    }else if(mode==='impact'){
      if(target){const beat=duration||.14,pulse=1+.0025*intensity;timeline.addLabel('impact',0).to(target,{scale:pulse,duration:beat*.38,ease:'power2.out'},'impact').to(target,{scale:1,duration:beat*.62,ease:'power2.inOut'});}
    }else if(mode==='focus'){
      if(target)timeline.addLabel('focus',0).fromTo(target,{y:0,scale:1},{y:-.6*intensity,scale:1+.004*intensity,duration:duration||.14,ease:'power2.out'},'focus').to(target,{y:0,scale:1,duration:duration||.16,ease:'power2.inOut'});
    }else if(mode==='result'){
      if(target)timeline.addLabel('result',0).fromTo(target,{y:1,scale:.996,rotationX:0},{y:-1,scale:1.012,rotationX:-.5,duration:duration||.26,ease:'power2.out'},'result').to(target,{y:0,scale:1,rotationX:0,duration:.28,ease:'power2.inOut'});
    }else if(mode==='exit'){
      if(target)timeline.to(target,{scale:.965,autoAlpha:.72,duration:duration||.32,ease:'power2.inOut'});
    }else if(target){
      timeline.to(target,{x:0,y:0,scale:1,rotation:0,autoAlpha:1,duration:duration||.24,ease:'power2.out'});
    }
    return Object.freeze({kill(){settle();}});
  }
  function dispose(){if(disposed)return;disposed=true;settle();}
  return Object.freeze({run,settle,dispose});
}
