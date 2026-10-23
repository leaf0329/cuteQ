'use strict';
const api=window.petApi,canvas=document.querySelector('#pet'),ctx=canvas.getContext('2d');
const bubble=document.querySelector('#bubble'),motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let state={action:'idle',started:Date.now(),until:0,message:''},settings={},pointer=null,down=null,clickTimer=null;
let lastHit=false,lastClick=0,lastFrameAt=0,lastDraw='',nextFrameAt=0;
let kinetics={vx:0,vy:0},kineticsAt=0,sway=0,stretch=0;
let walkOffset=0,walkElapsed=null;
let assetsReady=false,lastPose=null,previewing=false,previewSequence=0,walkRate=1;
let poseKey='',transitionFrom=null,transitionAt=0;
let clockOffset=Date.now()-performance.now();
const player=new PetVideoPlayer(error=>{bubble.textContent='动作加载失败：'+error.message;bubble.classList.add('visible');});
const hitCanvas=document.createElement('canvas');hitCanvas.width=160;hitCanvas.height=90;
const hitContext=hitCanvas.getContext('2d',{willReadFrequently:true});let hitPixels=null,hitSerial=-1,hitSlot=null,hitAt=0;
function resizeCanvas(){
 const width=300*(settings.scale??1),pixels=Math.max(1,Math.round(width*devicePixelRatio));
 canvas.style.width=width+'px';canvas.style.height=width+'px';canvas.style.bottom=width*8/300+'px';
 if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=pixels;canvas.height=pixels;}
 ctx.setTransform(pixels/600,0,0,pixels/600,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';lastDraw='';
}
window.addEventListener('resize',resizeCanvas);
function paint(p){
 const video=player.current?.video;if(!video)return;
 const source=PetMotion.source;
 ctx.save();ctx.translate(300+p.x,source.floorY+p.y);ctx.rotate(p.rotation);ctx.scale((p.flip?-1:1)*p.scaleX,p.scaleY);
 ctx.drawImage(video,-source.anchorX*source.ratio,-source.anchorY*source.ratio,source.width*source.ratio,source.height*source.ratio);ctx.restore();
}
async function renderAt(action,time){
 previewing=true;const pose=PetMotion.sample(action,time),key='preview:'+(++previewSequence);await player.show({...pose,paused:true},key);
 ctx.clearRect(0,0,600,600);paint(pose);lastPose=pose;lastDraw='';return canvas.toDataURL();
}
async function loadAssets(){const pose=PetMotion.sample('idle',0);await player.show(pose,'initial');paint(pose);lastPose=pose;assetsReady=true;}
loadAssets().catch(error=>{bubble.textContent='角色素材无法加载：'+error.message;bubble.classList.add('visible');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause();});
function draw(now){
 requestAnimationFrame(draw);
 const reduced=settings.reducedMotion||motionPreference.matches;
 if(document.hidden||previewing||!assetsReady){player.pause();nextFrameAt=now;return;}
 if(now<nextFrameAt-1)return;
 const interval=reduced?250:1000/60,sampleAt=nextFrameAt;
 nextFrameAt+=interval;if(nextFrameAt<now-interval)nextFrameAt=now+interval;
 const dt=Math.min(.1,(now-lastFrameAt)/1000);lastFrameAt=now;
 // 计划时钟决定动作与位移阶段，视频帧由解码器的呈现通知驱动画面更新。
 let elapsed=sampleAt+clockOffset-state.started;
 if(['left','right'].includes(state.action)&&elapsed>=PetMotion.turnDuration&&walkElapsed!==null)elapsed=PetMotion.turnDuration+walkElapsed;
 let pose=PetMotion.sample(state.action,elapsed,reduced,state.recovery);
 const identity=`${state.action}:${state.started}`;
 if(identity!==poseKey){poseKey=identity;transitionFrom=lastPose;transitionAt=now;}
 // 鼠标抓取点带动身体，惯性用阻尼追随；释放后缓慢回正，不直接跳回零角度。
 const dragging=state.action==='drag',follow=1-Math.exp(-12*dt);
 if(now-kineticsAt>140)kinetics={vx:0,vy:0};
 sway+=((dragging?-kinetics.vx/4000:0)-sway)*follow;
 stretch+=((dragging?.045+Math.abs(kinetics.vy)/16000:0)-stretch)*follow;
 if(!reduced){pose.rotation+=sway;pose.scaleY+=stretch;pose.scaleX-=stretch*.5;}
 if(!reduced)pose=PetMotion.transition(transitionFrom,pose,now-transitionAt);
 // 窗口坐标只能是整数；在画布补上未满一像素的路程，使低速散步连续移动。
 if(pose.walking)pose.x+=walkOffset*2/Math.max(.01,settings.scale??1);
 const mediaKey=identity+':'+pose.section;
 pose.rate=pose.walking?walkRate:1;player.request(pose,mediaKey);
 if(player.current?.key!==mediaKey)return;
 if(!pose.paused&&pose.remaining<750){const next=PetMotion.sample(state.action,elapsed+pose.remaining+1,reduced);if(next.section!==pose.section)player.warm({...next,time:next.time-.001},identity+':'+next.section);}
 const key=player.current.serial+':'+JSON.stringify([pose.flip,pose.x,pose.y,pose.scaleX,pose.scaleY,pose.rotation]);
 if(key!==lastDraw){lastDraw=key;ctx.clearRect(0,0,600,600);
  // 每帧只绘制一个实像；动作过渡不再叠加前后两张角色，以免留下双轮廓残影。
  paint(pose);lastPose=pose;updateHit();
 }
 bubble.classList.toggle('visible',Boolean(state.message)&&Date.now()<(state.messageUntil||state.until));
}
function updateHit(){
 if(!pointer||!assetsReady)return;
 const rect=canvas.getBoundingClientRect(),x=Math.floor((pointer.x-rect.left)/rect.width*600),y=Math.floor((pointer.y-rect.top)/rect.height*600);
 let opaque=false;
 if(lastPose&&player.current){const p=lastPose,source=PetMotion.source,dx=x-300-p.x,dy=y-source.floorY-p.y,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
  const sx=((c*dx+s*dy)/((p.flip?-1:1)*p.scaleX))/source.ratio+source.anchorX,sy=((-s*dx+c*dy)/p.scaleY)/source.ratio+source.anchorY;
  if(sx>=0&&sx<640&&sy>=0&&sy<360){
   const slot=player.current,now=performance.now();
   // 仅鼠标经过角色时读取小尺寸透明掩码；视频纹理和命中缓存都有固定上限。
   if(!hitPixels||hitSlot!==slot||(slot.serial!==hitSerial&&now-hitAt>=100)){
    hitContext.clearRect(0,0,160,90);hitContext.drawImage(slot.video,0,0,160,90);hitPixels=hitContext.getImageData(0,0,160,90).data;hitSlot=slot;hitSerial=slot.serial;hitAt=now;
   }
   opaque=hitPixels[(Math.floor(sy/4)*160+Math.floor(sx/4))*4+3]>40;
  }
 }
 const hit=Boolean(down||opaque);
 if(hit!==lastHit){lastHit=hit;api?.hit(hit);}
}
api?.onHitPoint(p=>{pointer={x:p.localX,y:p.localY};updateHit();});
api?.onKinetics(value=>{kinetics=value;kineticsAt=performance.now();});
api?.onWalkOffset(value=>{walkOffset=Number.isFinite(value?.offset)?value.offset:0;walkElapsed=Number.isFinite(value?.elapsed)?value.elapsed:null;walkRate=Number.isFinite(value?.rate)?value.rate:1;});
api?.onState(value=>{
 state=value;clockOffset=Date.now()-performance.now();bubble.textContent=value.message;lastDraw='';
});
api?.onSettings(value=>{
 settings=value;lastDraw='';
 resizeCanvas();
 updateHit();
});
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);pointer={x:e.clientX,y:e.clientY};
 down={id:e.pointerId,x:e.screenX,y:e.screenY,moved:false};updateHit();
});
canvas.addEventListener('pointermove',e=>{
 pointer={x:e.clientX,y:e.clientY};updateHit();
 if(!down||down.id!==e.pointerId)return;
 if(!down.moved&&Math.hypot(e.screenX-down.x,e.screenY-down.y)>5){down.moved=true;clearTimeout(clickTimer);api?.drag('start',{x:down.x,y:down.y});}
 if(down.moved)api?.drag('move',{x:e.screenX,y:e.screenY});
});
function release(cancel=false){
 if(!down)return;const moved=down.moved;down=null;
 if(moved)api?.drag('end');
 else if(!cancel){if(Date.now()-lastClick<300){clearTimeout(clickTimer);api?.open();lastClick=0;}
 else{lastClick=Date.now();clickTimer=setTimeout(()=>api?.interact('pet'),310);}}
 updateHit();
}
canvas.addEventListener('pointerup',()=>release());
canvas.addEventListener('pointercancel',()=>release(true));
canvas.addEventListener('lostpointercapture',()=>release(true));
canvas.addEventListener('contextmenu',e=>{e.preventDefault();api?.menu();});
canvas.addEventListener('keydown',e=>{if(['Enter',' ','f','F'].includes(e.key)){e.preventDefault();if(e.key==='Enter')api?.open();else api?.interact(e.key===' '?'pet':'feed');}});
requestAnimationFrame(draw);api?.ready();

