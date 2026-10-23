/* 同一套原画与动作时钟，使用透明视频播放，不预载全部 PNG。 */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetMotion=value;})(globalThis,function(){
 'use strict';
 const data=typeof module==='object'?require('../../assets/whale-video/motion-data.js'):globalThis.PetVideoData;
 const {clips,source,turnDuration,fps}=data;
 function duration(action){return clips[action].times.reduce((a,b)=>a+b,0);}
 function sample(action,elapsed,reduced=false){
  if(!clips[action])action='idle';
  const walking=['left','right'].includes(action),c=clips[action],length=duration(action);
  let t=Math.max(0,Number.isFinite(elapsed)?elapsed:0),cycle=0;
  if(reduced)return {...sample('idle',0),duration:length};
  if(walking&&t<turnDuration)return {...sample('turn-'+action,t),walking:false};
  if(walking)t-=turnDuration;
  if(action==='idle')t=0;
  else if(c.loop){cycle=Math.floor(t/length);t%=length;}
  else if(!c.hold&&t>=length)return sample('idle',0);
  const held=c.hold&&t>=length,time=c.still?0:Math.min(t/1000,c.mediaDuration-1/fps);
  const seconds=Math.max(0,elapsed)/1000,squash=action==='land'?.035*Math.exp(-seconds*5)*Math.cos(seconds*22):0;
  const micro=['breathe','shift','settle'].includes(action)?Math.sin(Math.PI*Math.min(1,t/length))**2:0;
  const air=clips.jump.stages.find(s=>s.name==='airborne'),jump=Math.max(0,Math.min(1,(elapsed-air.start)/(air.end-air.start)));
  return {action,file:c.file,time,end:c.mediaDuration-1/fps,section:`${action}:${cycle}`,remaining:Math.max(0,length-t),paused:Boolean(c.still||held),walking,
   flip:action==='left',x:0,y:action==='jump'?-Math.sin(jump*Math.PI)*42:0,
   scaleX:1+squash-(action==='breathe'?.001*micro:0),scaleY:1-squash+(action==='breathe'?.003:0)*micro,
   rotation:action==='shift'?Math.sin(seconds*Math.PI*2/3.2)*micro*.018:0,index:0,duration:length};
 }
 function transition(from,to,elapsed,length=180){
  if(!from||elapsed>=length)return to;
  const t=Math.max(0,elapsed/length),weight=t*t*(3-2*t),result={...to};
  for(const key of ['x','y','scaleX','scaleY','rotation'])result[key]=from[key]+(to[key]-from[key])*weight;
  return result;
 }
 return {clips,sample,transition,duration,turnDuration,source,fps};
});
