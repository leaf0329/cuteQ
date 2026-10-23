'use strict';
const api=window.petApi,canvas=document.querySelector('#pet'),ctx=canvas.getContext('2d');
const bubble=document.querySelector('#bubble'),motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let state={action:'idle',started:Date.now(),until:0,message:''},settings={},pointer=null,down=null,clickTimer=null;
let lastHit=false,lastClick=0,lastFrameAt=0,lastDraw='',nextFrameAt=0;
let kinetics={vx:0,vy:0},kineticsAt=0,sway=0,stretch=0;
let walkOffset=0,walkElapsed=null;
const images={},masks={},spriteFrames={},spriteBounds={};let assetsReady=false,lastPose=null;
let poseKey='',transitionFrom=null,transitionAt=0;
let clockOffset=Date.now()-performance.now();
// 直接按显示尺寸与屏幕 DPI 绘制，避免固定 600px 画布再次被浏览器缩放。
function resizeCanvas(){
 const width=300*(settings.scale??1),pixels=Math.max(1,Math.round(width*devicePixelRatio));
 canvas.style.width=`${width}px`;canvas.style.height=`${width}px`;canvas.style.bottom=`${width*8/300}px`;
 if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=pixels;canvas.height=pixels;}
 ctx.setTransform(pixels/600,0,0,pixels/600,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';lastDraw='';
}
window.addEventListener('resize',resizeCanvas);
async function loadAssets(){
 const used=new Map();
 const include=(atlas,frame,columns)=>{if(!used.has(atlas))used.set(atlas,{columns,frames:new Set()});used.get(atlas).frames.add(frame);};
 for(const clip of Object.values(PetMotion.clips))for(const frame of clip.frames){const location=PetMotion.frameLocation(clip.atlas,frame);include(location.atlas,location.frame,location.columns);}
 for(const [name,selection]of used)await new Promise((resolve,reject)=>{
 const img=new Image();img.onload=async()=>{
  try{
  const surface=document.createElement('canvas');surface.width=img.width;surface.height=img.height;
  const pixels=surface.getContext('2d',{willReadFrequently:true});pixels.drawImage(img,0,0);
  // 命中只需要是否超过阈值，以位图保存；逐条带读取，避免整张 RGBA 拷贝的内存峰值。
  const columns=selection.columns,cell=img.width/columns,needed=selection.frames;
  const bounds={};for(const frame of needed)bounds[frame]={left:cell,top:cell,right:0,bottom:0};
  const alpha=new Uint8Array(Math.ceil(img.width*img.height/8));
  for(let y=0;y<img.height;y+=64){
   const rgba=pixels.getImageData(0,y,img.width,Math.min(64,img.height-y)).data;
   for(let i=0;i<rgba.length/4;i++)if(rgba[i*4+3]){
    const bit=y*img.width+i;if(rgba[i*4+3]>40)alpha[bit>>3]|=1<<(bit&7);
    const x=i%img.width,py=y+Math.floor(i/img.width),frame=Math.floor(py/cell)*columns+Math.floor(x/cell),b=bounds[frame];
    if(b){const sx=x%cell,sy=py%cell;b.left=Math.min(b.left,sx);b.right=Math.max(b.right,sx);b.top=Math.min(b.top,sy);b.bottom=Math.max(b.bottom,sy);}
   }
  }
  masks[name]=alpha;
  // 大图集第一次 drawImage 会同步上传整张纹理；启动时裁为实际使用的小纹理。
  // 释放源图和临时画布后，仅保留尺寸、命中位图与完整角色单帧。
  spriteFrames[name]={};spriteBounds[name]={};
  for(const frame of needed){
   const b=bounds[frame],left=Math.max(0,b.left-2),top=Math.max(0,b.top-2),width=Math.min(cell,b.right+3)-left,height=Math.min(cell,b.bottom+3)-top;
   spriteBounds[name][frame]={left,top,width,height,cell};
   spriteFrames[name][frame]=await createImageBitmap(surface,frame%columns*cell+left,Math.floor(frame/columns)*cell+top,width,height,{premultiplyAlpha:'none'});
  }
  images[name]={width:img.width,height:img.height};
  surface.width=surface.height=1;img.src='';resolve();
  }catch(error){reject(error);}
 };img.onerror=reject;img.src=`../../assets/whale/${name}.png`;
});}
loadAssets().then(()=>{assetsReady=true;}).catch(()=>{bubble.textContent='角色素材暂时无法加载，可从托盘打开设置。';bubble.classList.add('visible');});
function paint(p,alpha=1){
 const frame=p.frame,img=spriteFrames[p.atlas][frame],b=spriteBounds[p.atlas][frame],ratio=600/b.cell;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(300+p.x,560+p.y);ctx.rotate(p.rotation);ctx.scale((p.flip?-1:1)*p.scaleX,p.scaleY);
 // 每一帧都是完整角色，头、躯干和四肢一起活动；眨眼也不叠加局部眼片。
 ctx.drawImage(img,-300+b.left*ratio,-560+b.top*ratio,b.width*ratio,b.height*ratio);
 ctx.restore();
}
function draw(now){
 requestAnimationFrame(draw);
 const reduced=settings.reducedMotion||motionPreference.matches;
 if(document.hidden||!assetsReady){nextFrameAt=now;return;}
 if(now<nextFrameAt-1)return;
 const interval=reduced?250:1000/60,sampleAt=nextFrameAt;
 nextFrameAt+=interval;if(nextFrameAt<now-interval)nextFrameAt=now+interval;
 const dt=Math.min(.1,(now-lastFrameAt)/1000);lastFrameAt=now;
 // 使用计划刷新时刻采样；实际回调的数毫秒浮动不应让 30 帧原画交替停留 16/50ms。
 let elapsed=sampleAt+clockOffset-state.started;
 if(['left','right'].includes(state.action)&&elapsed>=600&&walkElapsed!==null)elapsed=600+walkElapsed;
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
 const key=JSON.stringify(pose);
 if(key!==lastDraw){lastDraw=key;ctx.clearRect(0,0,600,600);
  // 每帧只绘制一个实像；动作过渡不再叠加前后两张角色，以免留下双轮廓残影。
  paint(pose);lastPose=pose;updateHit();
 }
 bubble.classList.toggle('visible',Boolean(state.message)&&Date.now()<(state.messageUntil||state.until));
}
function updateHit(){
 if(!pointer||!assetsReady)return;
 const rect=canvas.getBoundingClientRect(),x=Math.floor((pointer.x-rect.left)/rect.width*600),y=Math.floor((pointer.y-rect.top)/rect.height*600);
 // 从预载 alpha 掩码做逆变换命中，不每帧回读正在绘制的 GPU Canvas。
 let opaque=false;
 if(lastPose){const p=lastPose,dx=x-300-p.x,dy=y-560-p.y,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
  let sx=(c*dx+s*dy)/((p.flip?-1:1)*p.scaleX)+300,sy=(-s*dx+c*dy)/p.scaleY+560;
  if(sx>=0&&sx<600&&sy>=0&&sy<600){const img=images[p.atlas],cell=img.width/p.columns;
   const hitFrame=p.frame;
   const px=hitFrame%p.columns*cell+Math.floor(sx/600*cell),py=Math.floor(hitFrame/p.columns)*cell+Math.floor(sy/600*cell);
   const bit=py*img.width+px;opaque=Boolean(masks[p.atlas][bit>>3]&(1<<(bit&7)));}
 }
 const hit=Boolean(down||opaque);
 if(hit!==lastHit){lastHit=hit;api?.hit(hit);}
}
api?.onHitPoint(p=>{pointer={x:p.localX,y:p.localY};updateHit();});
api?.onKinetics(value=>{kinetics=value;kineticsAt=performance.now();});
api?.onWalkOffset(value=>{walkOffset=Number.isFinite(value?.offset)?value.offset:0;walkElapsed=Number.isFinite(value?.elapsed)?value.elapsed:null;});
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

