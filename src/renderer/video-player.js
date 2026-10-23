'use strict';
// 两个解码器交替使用：当前动作保持可见，下一段在后台定位到衔接帧。
class PetVideoPlayer {
 constructor(onError){
  this.onError=onError;this.current=null;this.wanted='';this.loadingKey='';this.failedKey='';this.switches=0;
  this.slots=Array.from({length:2},()=>{
   const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
   const slot={video,file:'',key:'',ready:false,serial:0,presented:0,controller:null};
   const frame=()=>{slot.serial++;slot.presented++;video.requestVideoFrameCallback(frame);};video.requestVideoFrameCallback(frame);
   return slot;
  });
 }
 wait(slot,event,signal){
  return new Promise((resolve,reject)=>{
   const video=slot.video,cleanup=()=>{video.removeEventListener(event,done);video.removeEventListener('error',error);signal.removeEventListener('abort',abort);};
   const done=()=>{cleanup();resolve();},error=()=>{cleanup();reject(new Error(`${slot.file}：${video.error?.message||'视频解码失败'}`));},abort=()=>{cleanup();reject(new DOMException('Superseded','AbortError'));};
   video.addEventListener(event,done,{once:true});video.addEventListener('error',error,{once:true});signal.addEventListener('abort',abort,{once:true});
  });
 }
 async prepare(slot,pose,key){
  if(slot.key===key&&slot.ready)return slot;
  slot.controller?.abort();const controller=new AbortController(),signal=controller.signal;slot.controller=controller;
  slot.ready=false;slot.key=key;slot.video.pause();
  if(slot.file!==pose.file||slot.video.readyState<2){
   slot.file=pose.file;const loaded=this.wait(slot,'loadeddata',signal);
   slot.video.src=`../../assets/dsh-pet/${encodeURIComponent(pose.file)}.webm`;slot.video.load();await loaded;
  }
  if(signal.aborted)throw new DOMException('Superseded','AbortError');
  if(Math.abs(slot.video.currentTime-pose.time)>.001){const sought=this.wait(slot,'seeked',signal);slot.video.currentTime=pose.time;await sought;}
  if(signal.aborted)throw new DOMException('Superseded','AbortError');
  slot.ready=true;slot.serial++;return slot;
 }
 control(pose){
  const slot=this.current;if(!slot)return;const video=slot.video;
  if(pose.paused||pose.rate===0){video.pause();return;}
  // Chromium 拒绝低于 1/16 的非零倍速；缓起步的首帧会落入该区间。
  video.playbackRate=Math.max(1/16,pose.rate??1);
  if(video.paused)video.play().catch(error=>{if(error.name!=='AbortError')this.onError(error);});
 }
 async show(pose,key){
  this.suspended=false;
  this.wanted=key;
  if(this.current?.key===key){this.control(pose);return true;}
  this.current?.video.pause();
  // 连续段不重载、不跳播，避免正常收势也被一次 seek 打断。
  if(!pose.paused&&this.current?.file===pose.file&&Math.abs(this.current.video.currentTime-pose.time)<.1){
   this.current.key=key;this.control(pose);return true;
  }
  const slot=this.slots.find(s=>s!==this.current),ready=await this.prepare(slot,pose,key);
  if(this.wanted!==key)return false;
  this.current=ready;this.switches++;this.control(pose);return true;
 }
 request(pose,key){
  if(this.suspended){this.suspended=false;if(this.current)this.current.key='';}
  this.wanted=key;
  if(this.current?.key===key){
   const video=this.current.video;
   if(pose.paused||video.currentTime>=pose.end-1/48)video.pause();
   else this.control(pose);
   return;
  }
  if(this.loadingKey===key||this.failedKey===key)return;
  this.loadingKey=key;
  this.show(pose,key).catch(error=>{if(error.name!=='AbortError'){this.failedKey=key;this.onError(error);}}).finally(()=>{if(this.loadingKey===key)this.loadingKey='';});
 }
 warm(pose,key){
  if(this.loadingKey||this.failedKey===key)return;
  const spare=this.slots.find(s=>s!==this.current);if(spare.key===key)return;
  this.prepare(spare,pose,key).catch(error=>{if(error.name!=='AbortError'){this.failedKey=key;this.onError(error);}});
 }
 pause(){if(this.current&&!this.current.video.paused)this.suspended=true;for(const slot of this.slots)slot.video.pause();}
 stats(){return {buffers:this.slots.length,loaded:this.slots.filter(s=>s.ready).length,switches:this.switches,playing:this.slots.filter(s=>!s.video.paused).length,sources:this.slots.map(s=>s.file)};}
}
