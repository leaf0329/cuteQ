/* 时间轴单位为毫秒，视频时间为秒；动作保持原视频速度。 */
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.PetMotion=value;})(globalThis,function(){
 'use strict';
 const END=9.96,START=.25,turnDuration=1750;
 const segment=(file,start=START,end=END)=>({file,start,end,duration:(end-start)*1000});
 const clip=(file,start=START,end=END,options={})=>({parts:[segment(file,start,end)],times:[(end-start)*1000],...options});
 const idle=clip('待机呼吸休闲',END,END,{hold:true,times:[1]});
 const foodParts=[segment('吃白饭',START,6.5),...Array.from({length:4},()=>segment('吃白饭',2.5,6.5)),segment('吃白饭',6.5)];
 const meal={parts:foodParts,times:foodParts.map(p=>p.duration)};
 const walk=flip=>({parts:[segment('螃蟹走路',START,2),segment('螃蟹走路',2,6.75),segment('螃蟹走路',5.208333333,6.75)],times:[1750,4750,1541.666667],loop:true,walking:true,flip});
 const clips={
  idle,breathe:clip('待机呼吸休闲',START,5.2),shift:clip('待机呼吸休闲',START,5.2),settle:clip('待机呼吸休闲',START,5.2),
  eat:meal,'meal-break':meal,sneak:clip('偷吃零食被抓住'),hungry:clip('偷吃零食被抓住'),satisfied:clip('偷吃零食被抓住',5.2),
  happy:clip('点击回应-挠痒咯咯笑'),wave:clip('点击回应-元气挥手'),
  protest:clip('点击回应-傲娇生气'),pout:clip('点击回应-傲娇生气'),
  surprise:clip('点击回应-害羞惊讶'),shock:clip('被吓一跳'),
  sad:clip('点击回应-害羞惊讶'),sorry:clip('女仆屈膝礼仪'),
  proud:clip('工作状态-雀跃庆祝'),think:clip('工作状态-思考冒泡'),review:clip('轻快记录'),
  peek:clip('原地漂浮踏步'),dance:clip('轻快摇摆舞'),stretch:clip('超大伸懒腰'),
  hum:clip('悠闲哼歌'),'token-game':clip('原地专心玩魔方'),'tail-sway':clip('用鲸鱼尾巴拍打地面'),
  sleep:clip('原地小憩沉眠',START,7.5,{hold:true}),curl:clip('原地小憩沉眠',START,7.5,{hold:true}),wake:clip('原地小憩沉眠',7.5),
  drag:clip('被鼠标拖拽悬空反馈',START,5.5,{hold:true}),fall:clip('被鼠标拖拽悬空反馈',5.5,5.5,{hold:true,times:[1]}),
  land:clip('原地重力下蹲压缩',6.9),jump:clip('点击回应-开心跃动'),
  left:walk(false),right:walk(true),
  'turn-left':clip('螃蟹走路',START,2),'turn-right':clip('螃蟹走路',START,2,{flip:true}),
  'stop-left':clip('螃蟹走路',7.2),'stop-right':clip('螃蟹走路',7.2,END,{flip:true}),
  'story-recover':idle,
 };
 function duration(action){return clips[action].times.reduce((a,b)=>a+b,0);}
 function sample(action,elapsed,reduced=false){
  if(!clips[action])action='idle';
  const c=clips[action],length=duration(action);
  let t=Math.max(0,Number.isFinite(elapsed)?elapsed:0),index=0,cycle=0;
  if(reduced)return {...sample('idle',0),duration:length};
  if(c.walking&&t>=6500){cycle=1+Math.floor((t-6500)/c.times[2]);t=6500+(t-6500)%c.times[2];}
  else if(!c.hold&&!c.loop&&t>=length)return sample('idle',0);
  for(;index<c.parts.length-1&&t>=c.times[index];index++)t-=c.times[index];
  const part=c.parts[index],hold=part.start===part.end||(c.hold&&t>=part.duration);
  const time=hold?part.end:part.start+t/1000;
  const seconds=Math.max(0,elapsed)/1000,squash=action==='land'?.035*Math.exp(-seconds*5)*Math.cos(seconds*22):0;
  return {action,file:part.file,time,end:part.end,section:`${action}:${index}:${cycle}`,remaining:Math.max(0,part.duration-t),paused:hold,
   walking:Boolean(c.walking&&elapsed>=turnDuration),flip:Boolean(c.flip),x:0,y:0,scaleX:1+squash,scaleY:1-squash,rotation:0,index,duration:length};
 }
 function transition(from,to,elapsed,length=180){
  if(!from||elapsed>=length)return to;
  const t=Math.max(0,elapsed/length),weight=t*t*(3-2*t),result={...to};
  for(const key of ['x','y','scaleX','scaleY','rotation'])result[key]=from[key]+(to[key]-from[key])*weight;
  return result;
 }
 return {clips,sample,transition,duration,turnDuration,source:{width:640,height:360,anchorX:315,anchorY:329,ratio:1.8,floorY:238/256*600}};
});
