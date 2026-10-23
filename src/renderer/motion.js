/* 按经过时间采样预生成原画，渲染频率不会改变动作速度。 */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetMotion=value;})(globalThis,function(){
 'use strict';
 const painted=typeof module==='object'?require('../../assets/whale/painted-motion.js'):globalThis.PetPaintData;
 const clips=painted.clips;
 function frameLocation(atlas,frame){
  if(typeof frame==='object')return frameLocation(frame.atlas,frame.frame);
  return {atlas:atlas+'-'+Math.floor(frame/64),frame:frame%64,columns:8};
 }
 function sample(action,elapsed,reduced=false){
  const walking=['left','right'].includes(action);
  if(walking&&!reduced&&elapsed<600)return {...sample('turn-'+action,elapsed),walking:false};
  if(walking&&!reduced)elapsed=Math.max(0,elapsed-600);
  const c=clips[action]||clips.idle,duration=c.times.reduce((a,b)=>a+b,0);
  let t=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  if(!c.loop&&!c.hold&&t>=duration)return sample('idle',t-duration,reduced);
  if(reduced)t=0;else if(c.loop)t%=duration;else t=Math.min(t,duration-1);
  let index=0;while(index<c.times.length-1&&t>=c.times[index]){t-=c.times[index];index++;}
  const location=frameLocation(c.atlas,c.frames[index]);
  const phase=elapsed/1000,spring=reduced?0:Math.exp(-phase*5)*Math.cos(phase*22);
  // 原画已画出落地压缩，仅增加轻微回弹；脚底锚点保持不动。
  const squash=action==='land'?.035*spring:0;
  const air=clips.jump.stages.find(s=>s.name==='airborne');
  const jumpPhase=Math.max(0,Math.min(1,(elapsed-air.start)/(air.end-air.start)));
  const micro=!reduced&&['shift','settle','breathe'].includes(action)?Math.sin(Math.PI*Math.min(1,Math.max(0,elapsed/duration)))**2:0;
  return {...location,flip:action==='left',walking,
   // 左向镜像围绕实际脚底中心，不围绕画布中心，避免转身后横跳。
   x:action==='left'?600*(2*painted.anchorX-1):0,
   y:reduced?0:action==='jump'?(jumpPhase>0&&jumpPhase<1?-Math.sin(jumpPhase*Math.PI)*42:0):walking?-Math.abs(Math.sin(elapsed/duration*Math.PI*2))*1.5:0,
   scaleX:1+squash+(action==='breathe'?-.001*micro:0),scaleY:1-squash+(action==='breathe'?.003:action==='settle'?-.002:0)*micro,
   rotation:reduced?0:action==='shift'?Math.sin(phase*Math.PI*2/3.2)*micro*.018:0,index,duration};
 }
 function transition(from,to,elapsed,duration=180){
  if(!from||elapsed>=duration)return to;
  const t=Math.max(0,elapsed/duration),weight=t*t*(3-2*t),result={...to};
  for(const key of ['x','y','scaleX','scaleY','rotation'])result[key]=from[key]+(to[key]-from[key])*weight;
  return result;
 }
 return {clips,sample,transition,frameLocation};
});
