'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),assert=require('node:assert/strict');
require('../src/main/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 try{
  const loading=Date.now();let pet,ready=false;
  for(let i=0;i<200;i++){pet=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));if(pet&&await pet.webContents.executeJavaScript('assetsReady')){ready=true;break;}await sleep(50);}
  assert.ok(ready,'Video decoding did not start');for(const w of BrowserWindow.getAllWindows())if(w!==pet)w.hide();
  const errors=[];pet.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  await pet.webContents.executeJavaScript("api.mode('quiet')");
  const directory=path.join(__dirname,'../artifacts/animation-qa-v04');fs.mkdirSync(directory,{recursive:true});
  const definitions=await pet.webContents.executeJavaScript('PetMotion.clips'),actions=Object.keys(definitions),report={startupMs:Date.now()-loading,actions:{},pacing:{}};
  const neutral=await pet.webContents.executeJavaScript("renderAt('idle',0)");
  await sharp(Buffer.from(neutral.split(',')[1],'base64')).toFile(path.join(directory,'idle.png'));
  const overview=[];
  for(const [index,action]of actions.entries()){
   const c=definitions[action],duration=c.times.reduce((a,b)=>a+b,0),frames=[],stats=[];
   for(const fraction of [0,.25,.5,.75,.999]){
    const image=await pet.webContents.executeJavaScript(`renderAt(${JSON.stringify(action)},${duration*fraction})`),png=Buffer.from(image.split(',')[1],'base64');
    const {data,info}=await sharp(png).raw().toBuffer({resolveWithObject:true});let background=0,foreground=0,left=info.width,right=0,top=info.height,bottom=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a<=4)background++;if(a>64){foreground++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
    assert.ok(foreground>info.width*info.height*.08,action+': empty character');assert.ok(background>info.width*info.height*.35,action+': alpha was lost');
    stats.push({fraction,bounds:{left,top,right,bottom},background,foreground});
    frames.push(await sharp(png).resize(240,240).flatten({background:'#edf1f8'}).png().toBuffer());
   }
   await sharp({create:{width:1200,height:240,channels:3,background:'#edf1f8'}}).composite(frames.map((input,i)=>({input,left:i*240,top:0}))).png().toFile(path.join(directory,action+'-contact.png'));
   overview.push({input:frames[2],left:index%8*240,top:Math.floor(index/8)*240});report.actions[action]={duration,stats};
  }
  await sharp({create:{width:1920,height:Math.ceil(actions.length/8)*240,channels:3,background:'#edf1f8'}}).composite(overview).png().toFile(path.join(directory,'all-actions.png'));
  // 连续切换动作，以及切回正在显示的动作时，已取消的解码不能抢回画面。
  const race=await pet.webContents.executeJavaScript(`(async()=>{
   for(let i=0;i<12;i++){const name=['wave','eat','sleep','dance'][i%4];player.request(PetMotion.sample(name,500),'race:'+i);}
   await new Promise(r=>setTimeout(r,400));const latest=player.current.file;
   const key=player.current.key,pose={...PetMotion.sample('dance',500),paused:true};player.request(PetMotion.sample('wave',500),'stale');player.request(pose,key);
   await new Promise(r=>setTimeout(r,400));return {latest,current:player.current.file,...player.stats()};
  })()`);
  assert.equal(race.latest,'own-dance');assert.equal(race.current,'own-dance');assert.equal(race.buffers,2);assert.ok(race.playing<=1);report.race=race;
  const resumed=await pet.webContents.executeJavaScript(`(async()=>{
   previewing=true;await player.show(PetMotion.sample('wave',1000),'resume');await new Promise(r=>setTimeout(r,100));player.pause();
   player.request({...PetMotion.sample('wave',4000),paused:true},'resume');
   for(let i=0;i<100&&player.current.key!=='resume';i++)await new Promise(r=>setTimeout(r,10));
   return {time:player.current.video.currentTime,key:player.current.key};
  })()`);assert.equal(resumed.key,'resume');assert.ok(Math.abs(resumed.time-4)<.08,JSON.stringify(resumed));report.resumed=resumed;
  // 用真实视频时钟记录绘制间隔，包含吃饭的循环接缝。
  await pet.webContents.executeJavaScript(`window.qaTimes=[];window.qaPaint=paint;paint=function(p){qaTimes.push(performance.now());return qaPaint(p);};true;`);
  for(const [action,offset,span]of [['eat',5000,2200],['dance',800,2200],['wave',2000,2200],['sleep',1000,2200],['hum',2000,2200],['token-game',2000,2200],['cube',6000,2200],['curtsy',1800,2200],['land',100,1200]]){
   await pet.webContents.executeJavaScript(`previewing=false;state={action:${JSON.stringify(action)},started:Date.now()-${offset},message:''};poseKey='';lastDraw='';qaTimes=[];true;`);
   await sleep(span);
   const result=await pet.webContents.executeJavaScript(`(()=>{const times=qaTimes.slice(3),d=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);return {draws:times.length,fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95:d[Math.floor(d.length*.95)],max:d.at(-1),cache:player.stats()};})()`);
   report.pacing[action]=result;console.log('Pacing',action,JSON.stringify(result));
   assert.ok(result.fps>=27&&result.p95<85,action+': '+JSON.stringify(result));assert.equal(result.cache.buffers,2);assert.ok(result.cache.playing<=1);
  }
  await pet.webContents.executeJavaScript(`previewing=true;paint=qaPaint;true;`);
  // 完整播放自己的饭团动作，检查长停留和收势均保留。
  const meal=await pet.webContents.executeJavaScript(`(async()=>{
   previewing=false;const start=Date.now();state={action:'eat',started:start,message:''};poseKey='';lastDraw='';const samples=[];
   while(Date.now()-start<26000){await new Promise(r=>setTimeout(r,80));samples.push({elapsed:Date.now()-start,time:player.current.video.currentTime,file:player.current.file,section:player.current.key,buffers:player.slots.length});}
   previewing=true;return samples;
  })()`);
  assert.ok(meal.some(s=>s.elapsed>20000&&s.file==='own-eat'));assert.equal(meal.at(-1).file,'own-idle');
  const eating=meal.filter(s=>s.file==='own-eat');for(let i=1;i<eating.length;i++)assert.ok(eating[i].time>=eating[i-1].time,'the full meal must advance continuously');report.meal=meal;
  // 待机必须停止解码，减少动画也必须停在同一张中性姿势。
  await pet.webContents.executeJavaScript(`(async()=>{await renderAt('idle',0);previewing=false;state={action:'idle',started:Date.now(),message:''};})()`);
  await sleep(300);const idleA=await pet.webContents.executeJavaScript('({frames:player.current.presented,...player.stats()})');await sleep(1200);
  const idleB=await pet.webContents.executeJavaScript('({frames:player.current.presented,...player.stats()})');assert.equal(idleB.playing,0);assert.equal(idleA.frames,idleB.frames);report.idle=idleB;
  await pet.webContents.executeJavaScript(`settings.reducedMotion=true;state={action:'dance',started:Date.now(),message:''};true;`);await sleep(300);assert.equal(await pet.webContents.executeJavaScript('player.current.video.paused'),true);
  report.processes=app.getAppMetrics().map(m=>({type:m.type,workingSetMB:Math.round(m.memory.workingSetSize/1024)}));report.errors=errors;
  fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));assert.deepEqual(errors,[]);
  console.log('Animation QA passed',JSON.stringify({actions:actions.length,startupMs:report.startupMs,processes:report.processes}));
 }catch(error){console.error(error);process.exitCode=1;}
 finally{app.once('will-quit',()=>app.exit(process.exitCode||0));app.quit();}
});
