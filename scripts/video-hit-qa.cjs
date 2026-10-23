'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
if(!process.versions.electron){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cuteq-video-hit-'));
 const child=require('child_process').spawn(require('electron'),[__filename,`--test-user-data=${profile}`],{stdio:'inherit',windowsHide:true});
 const timer=setTimeout(()=>child.kill(),20000);
 child.on('exit',code=>{clearTimeout(timer);fs.rmSync(profile,{recursive:true,force:true});process.exitCode=code??1;});
}else{
 const {app,BrowserWindow}=require('electron');require('../src/main/main.cjs');
 app.whenReady().then(async()=>{try{
  let pet;for(let i=0;i<100;i++){pet=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));if(pet&&await pet.webContents.executeJavaScript('assetsReady'))break;await new Promise(r=>setTimeout(r,50));}
  const report=[];
  for(const action of ['idle','left','right','drag']){
   const result=await pet.webContents.executeJavaScript(`(async()=>{
    await renderAt(${JSON.stringify(action)},2000);
    if(${JSON.stringify(action)}==='drag'){lastPose={...lastPose,rotation:.18,scaleX:.96,scaleY:1.08};ctx.clearRect(0,0,600,600);paint(lastPose);}
    down=null;hitAt=0;const rect=canvas.getBoundingClientRect(),rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,checks=[];
    const alpha=(x,y)=>rgba[(y*canvas.width+x)*4+3];
    const hit=(x,y)=>{pointer={x:rect.left+(x+.5)/canvas.width*rect.width,y:rect.top+(y+.5)/canvas.height*rect.height};updateHit();return lastHit;};
    let inside=0;
    for(let y=20;y<canvas.height-20;y+=20)for(let x=20;x<canvas.width-20;x+=20){
     if(alpha(x,y)>200&&alpha(x-8,y)>200&&alpha(x+8,y)>200&&alpha(x,y-8)>200&&alpha(x,y+8)>200){checks.push({expected:true,actual:hit(x,y)});inside++;}
    }
    for(const [x,y]of [[4,4],[canvas.width-5,4],[4,canvas.height-5],[canvas.width-5,canvas.height-5]])checks.push({expected:false,actual:hit(x,y)});
    return {action:${JSON.stringify(action)},inside,checks};
   })()`);
   assert.ok(result.inside>=10,action);for(const c of result.checks)assert.equal(c.actual,c.expected,action);report.push({action,samples:result.checks.length});
  }
  fs.writeFileSync(path.join(__dirname,'../artifacts/animation-qa-v04/hit-report.json'),JSON.stringify(report,null,2));console.log('Visible body and transparent-corner hit tests passed, including both mirrors and drag deformation:',report);
 }catch(error){console.error(error);process.exitCode=1;}finally{app.once('will-quit',()=>app.exit(process.exitCode||0));app.quit();}});
}
