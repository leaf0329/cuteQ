'use strict';
const {app,BrowserWindow,screen}=require('electron');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {spawn}=require('node:child_process');let fixture=null;
const nativeMain=require('../src/main/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<400;i++){const value=await fn();if(value)return value;await sleep(100);}throw new Error('UI condition timed out');}
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{let text='';req.on('data',c=>text+=c);req.on('end',()=>{
  const body=JSON.parse(text);assert.equal(body.model,'mock-whale');assert.equal(body.response_format.type,'json_object');
  const input=body.messages.at(-1).content;
  const report=typeof input==='string'&&input.includes('汇报');
  const voice=typeof input==='string'&&input.includes('9点');
  const result={reply:voice?'听到了，时间记下了。':'我在这里，我们慢慢来。',expression:'think',memories:report?[{topic:'汇报安排',text:'用户提到周五汇报还未准备。',kind:'plan',evidence:'周五汇报还没准备'}]:[]};
  res.setHeader('Content-Type','application/json');
  const timer=setTimeout(()=>res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]})),input==='取消测试'?4000:100);
  res.on('close',()=>clearTimeout(timer));
 });});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
 const panel=await wait(()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('companion.html')));
 const pet=await wait(()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html')));
 await wait(()=>panel.webContents.executeJavaScript('Boolean(window.petApi && document.querySelector("#focus"))'));
 await wait(()=>pet.webContents.executeJavaScript('assetsReady'));
 const decoderCheck=await pet.webContents.executeJavaScript('player.stats()');
 assert.equal(decoderCheck.buffers,2);assert.ok(decoderCheck.loaded>=1);assert.ok(decoderCheck.playing<=1);
 console.log('Bounded video decoder cache:',decoderCheck);
 const errors=[];for(const w of [pet,panel])w.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
 const initial=pet.getBounds();
 assert.equal((await panel.webContents.executeJavaScript('api.settings()')).value.settings.backendStatus,'已连接');
 await panel.webContents.executeJavaScript(`document.querySelector('[data-tab="settings"]').click();document.querySelector('[name="baseUrl"]').value='http://127.0.0.1:${server.address().port}/v1';document.querySelector('[name="model"]').value='mock-whale';document.querySelector('[name="apiKey"]').value='local-test-fixture-key';document.querySelector('#settings-form').requestSubmit();`);
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#notice").textContent.includes("设置已保存")'));
 await panel.webContents.executeJavaScript('document.querySelector("#start-chat").click();document.querySelector("#prompt").value="你好";document.querySelector("#chat-form").requestSubmit();');
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#messages").textContent.includes("我们慢慢来")'));
 await wait(()=>panel.webContents.executeJavaScript('!busy'));
 await panel.webContents.executeJavaScript('document.querySelector("#prompt").value="取消测试";document.querySelector("#chat-form").requestSubmit();');
 await wait(()=>panel.webContents.executeJavaScript('busy'));
 await panel.webContents.executeJavaScript('document.querySelector("#cancel").click()');
 await wait(()=>panel.webContents.executeJavaScript('!busy && document.querySelector("#messages").textContent.includes("这次回复已取消")'));
 assert.equal(await panel.webContents.executeJavaScript('(async()=> (await api.settings()).value.history.length)()'),2);
 await panel.webContents.executeJavaScript('document.querySelector("#prompt").value="周五汇报还没准备";document.querySelector("#chat-form").requestSubmit();');
 await wait(()=>panel.webContents.executeJavaScript('!busy && document.querySelector("#prompt").value === ""'));
 await panel.webContents.executeJavaScript('document.querySelector("[data-tab=memories]").click()');
 await wait(()=>panel.webContents.executeJavaScript('document.querySelectorAll(".memory-card").length === 1'));
 await panel.webContents.executeJavaScript('document.querySelector(".memory-card textarea").value="汇报改到下周一";document.querySelector(".memory-actions button").click()');
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#notice").textContent.includes("记忆已更新")'));
 assert.equal((await panel.webContents.executeJavaScript('api.memories()')).value[0].text,'汇报改到下周一');
 fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'../artifacts/cuteq-memory.png'),(await panel.webContents.capturePage()).toPNG());
 await panel.webContents.executeJavaScript('document.querySelector("[data-tab=chat]").click();document.querySelector("#listen").click()');
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#listen").getAttribute("aria-pressed") === "true"'));
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#speech-text").textContent.includes("9点")'));
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#messages").textContent.includes("听到了，时间记下了")'));
 await panel.webContents.executeJavaScript('document.querySelector("#listen").click()');
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#listen").getAttribute("aria-pressed") === "false"'));
 assert.equal(await panel.webContents.executeJavaScript('microphone === null'),true);
 await sleep(200);fs.writeFileSync(path.join(__dirname,'../artifacts/cuteq-chat.png'),(await panel.webContents.capturePage()).toPNG());
 const maskReport=await pet.webContents.executeJavaScript('({width:hitCanvas.width,height:hitCanvas.height,bytes:hitPixels?.byteLength||0})');
 assert.deepEqual([maskReport.width,maskReport.height],[96,96]);assert.ok(maskReport.bytes<=96*96*4);
 await panel.webContents.executeJavaScript('document.querySelector("#feed").click()');await sleep(200);
 assert.equal(await pet.webContents.executeJavaScript('state.action'),'eat');
 await panel.webContents.executeJavaScript('document.querySelector("#focus").click()');await sleep(200);
 assert.equal(await pet.webContents.executeJavaScript('state.mode'),'focus');
 await pet.webContents.executeJavaScript('window.petApi.drag("start",{x:500,y:500});window.petApi.drag("move",{x:520,y:530});');await sleep(200);
 assert.equal(await pet.webContents.executeJavaScript('document.querySelector("#chat")===null'),true);
 assert.equal(await pet.webContents.executeJavaScript('getComputedStyle(bubble).fontSize'),'15px');
 fs.writeFileSync(path.join(__dirname,'../docs/bubble-preview.png'),(await pet.webContents.capturePage()).toPNG());
 await pet.webContents.executeJavaScript('window.petApi.drag("end");');await sleep(200);
 // Windows 在分数显示缩放下会对透明宿主的外框取整；同时检查画布尺寸，避免把取整当作角色缩放。
 const moved=pet.getBounds();for(const bounds of [initial,moved]){assert.ok(Math.abs(bounds.width-300)<=3);assert.ok(Math.abs(bounds.height-360)<=3);}
 assert.equal(await pet.webContents.executeJavaScript('canvas.getBoundingClientRect().width'),300);
 await panel.webContents.executeJavaScript('document.querySelector("[data-tab=play]").click();document.querySelector("#game-start").click();document.querySelector("#token").click();');
 assert.equal(await panel.webContents.executeJavaScript('score'),1);
 for(const percent of [42,1,0,100]){
  const result=await panel.webContents.executeJavaScript(`api.scale(${percent/100})`);assert.equal(result.ok,true);
  await wait(()=>pet.webContents.executeJavaScript(`settings.scale===${percent/100}`));
  if(percent===0)assert.equal(pet.isVisible(),false);else{
   assert.ok(Math.abs(pet.getBounds().width-Math.max(32,Math.round(300*percent/100)))<=3);assert.equal(pet.isVisible(),true);
   assert.equal(await pet.webContents.executeJavaScript('canvas.getBoundingClientRect().width'),300*percent/100);
  }
 }
 await panel.webContents.executeJavaScript('document.querySelector("[data-tab=settings]").click();document.querySelector("#size-slider").value=42;document.querySelector("#size-slider").dispatchEvent(new Event("input"));');
 await wait(()=>pet.webContents.executeJavaScript('settings.scale===.42'));
 assert.equal(await panel.webContents.executeJavaScript('document.querySelector("#size-output").textContent'),'42%');
 fs.writeFileSync(path.join(__dirname,'../docs/size-settings-preview.png'),(await panel.webContents.capturePage()).toPNG());
 await panel.webContents.executeJavaScript('document.querySelector("#size-slider").value=100;document.querySelector("#size-slider").dispatchEvent(new Event("input"));');
 await wait(()=>pet.webContents.executeJavaScript('settings.scale===1'));
 await panel.webContents.executeJavaScript('document.querySelector("[data-tab=company]").click()');
 await wait(()=>panel.webContents.executeJavaScript('document.querySelector("#company").classList.contains("active")'));
 for(const width of [720,930]){
  panel.setSize(width,740);await sleep(150);
  const layout=await panel.webContents.executeJavaScript(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {input:box('#minutes'),label:box('.minutes'),focus:box('#focus'),quiet:box('#quiet')};})()`);
  assert.ok(Math.abs(layout.input.y-layout.focus.y)<1,'Focus input and button must align');
  assert.ok(Math.abs(layout.label.height-layout.input.height)<1,'Minutes unit must stay beside input');
  assert.ok(layout.quiet.x>=layout.focus.x+layout.focus.width,'Focus buttons must not overlap');
 }
 await sleep(350);
 fs.writeFileSync(path.join(__dirname,'../docs/preview-v2.png'),(await panel.webContents.capturePage()).toPNG());
 fs.writeFileSync(path.join(__dirname,'../docs/qa-pet-v2.png'),(await pet.webContents.capturePage()).toPNG());
 const sharp=require('sharp'),landingFrames=[];
 for(let i=0;i<20;i++){
  const png=await pet.webContents.executeJavaScript(`renderAt('land',${i*100})`);
  landingFrames.push(await sharp(Buffer.from(png.split(',')[1],'base64')).resize(300,300).flatten({background:'#edf1f8'}).ensureAlpha().raw().toBuffer());
 }
 assert.notDeepEqual(landingFrames[0],landingFrames[8]);
 await pet.webContents.executeJavaScript('previewing=false;true;');
 await sharp(Buffer.concat(landingFrames),{raw:{width:300,height:6000,channels:4,pageHeight:300}}).webp({quality:85,loop:0,delay:50}).toFile(path.join(__dirname,'../docs/landing-preview.webp'));
 if(process.env.PET_TEST_EDGES){
  panel.hide();
  const area=screen.getDisplayMatching(pet.getBounds()).workArea;
  const target={x:area.x+Math.round(area.width*.3),y:area.y+Math.round(area.height*.6),width:640,height:200};
  fixture=spawn(process.execPath,[path.join(__dirname,'window-fixture.cjs'),path.join(app.getPath('userData'),'fixture'),JSON.stringify(target)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture timeout')),10000);fixture.stdout.on('data',b=>{if(b.toString().includes('"ready":true')){clearTimeout(timer);resolve();}});});
  await wait(()=>nativeMain.nativeGeometry().windows.some(w=>w.pid===fixture.pid));
  // 只验收真实可见顶边；被其他窗口遮住时先报告测试前置条件，不将落地面误判为穿窗。
  await wait(()=>{const g=nativeMain.nativeGeometry(),w=g.windows.find(w=>w.pid===fixture.pid);return w&&require('../src/main/physics.cjs').platforms(g.windows,area,pet.getBounds()).some(s=>s.handle===w.handle&&s.left<=target.x+200&&s.right>=target.x+200);});
  const b=pet.getBounds(),foot=require('../src/main/physics.cjs').footOffset(b);
  const dx=target.x+200-b.width/2-b.x,dy=target.y-75-foot-b.y;
  await pet.webContents.executeJavaScript(`api.drag('start',{x:500,y:500});api.drag('move',{x:${500+dx},y:${500+dy}});`);
  // 停住鼠标后释放，不带人为测试移动的甩动速度。
  await sleep(250);await pet.webContents.executeJavaScript(`api.drag('move',{x:${500+dx},y:${500+dy}});api.drag('end');`);
  await wait(()=>pet.webContents.executeJavaScript("state.action === 'land'"));
  assert.ok(Math.abs(pet.getBounds().y+foot-target.y)<12,`Expected external window landing: target=${JSON.stringify(target)}, pet=${JSON.stringify(pet.getBounds())}, foot=${foot}, geometry=${JSON.stringify(nativeMain.nativeGeometry())}`);
  const beforeMove=pet.getBounds();fs.writeFileSync(path.join(app.getPath('userData'),'fixture','move.json'),JSON.stringify({...target,x:target.x+80,y:target.y+30}));
  try { await wait(()=>Math.abs(pet.getBounds().x-beforeMove.x-80)<5&&Math.abs(pet.getBounds().y-beforeMove.y-30)<5); }
  catch(e){throw new Error(`Window following failed: before=${JSON.stringify(beforeMove)}, after=${JSON.stringify(pet.getBounds())}`);}
  fixture.kill();fixture=null;await sleep(800);
  await wait(()=>Math.abs(pet.getBounds().y+foot-(area.y+area.height))<3);
  console.log('Native window edge test passed: external window landing, moving support, and support removal.');
  pet.showInactive();panel.show();
 }
 // 跳过启动时 CPU 零基线；短窗采样仅作诊断，不能代替长时间资源验收。
 const sample=()=>app.getAppMetrics().map(m=>({type:m.type,cpu:m.cpu.percentCPUUsage,memoryKB:m.memory.workingSetSize}));
 sample();const metrics={visible:[],hidden:[]};
 for(let i=0;i<3;i++){await sleep(2000);metrics.visible.push(sample());}
 pet.hide();panel.hide();
 for(let i=0;i<3;i++){await sleep(2000);metrics.hidden.push(sample());}
 fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/integration-metrics.json'),JSON.stringify(metrics,null,2));
 assert.deepEqual(errors,[]);const marker=process.argv.find(a=>a.startsWith('--integration-complete='));if(marker)fs.writeFileSync(marker.slice('--integration-complete='.length),'{}');console.log('Integration passed: local speech input, microphone release, mock chat, memory editing, settings, transparent videos, feeding, focus, drag size, game and screenshots.');
 }catch(e){console.error(e);const panel=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('companion.html'));if(panel){console.error('UI diagnostic:',await panel.webContents.executeJavaScript('({notice:document.querySelector("#notice").textContent,speechResult:document.querySelector("#speech-result").textContent,listenState:document.querySelector("#listen-state").textContent})'));fs.writeFileSync(path.join(__dirname,'../artifacts/cuteq-failure.png'),(await panel.webContents.capturePage()).toPNG());}process.exitCode=1;}finally{fixture?.kill();server.closeAllConnections();server.close();app.once('will-quit',()=>app.exit(process.exitCode||0));app.quit();}
});
