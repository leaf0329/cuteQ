'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),sharp=require('sharp');
if(!process.versions.electron){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cuteq-handoff-'));
 const child=require('child_process').spawn(require('electron'),[__filename,`--test-user-data=${profile}`],{stdio:'inherit',windowsHide:true});const timer=setTimeout(()=>child.kill(),25000);
 child.on('exit',code=>{clearTimeout(timer);fs.rmSync(profile,{recursive:true,force:true});process.exitCode=code??1;});
}else{
 const {app,BrowserWindow}=require('electron');require('../src/main/main.cjs');
 app.whenReady().then(async()=>{try{
  let pet;for(let i=0;i<200;i++){pet=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));if(pet&&await pet.webContents.executeJavaScript('assetsReady'))break;await new Promise(r=>setTimeout(r,50));}
  const capture=async(action,time)=>{const url=await pet.webContents.executeJavaScript(`renderAt(${JSON.stringify(action)},${time})`);return sharp(Buffer.from(url.split(',')[1],'base64')).raw().toBuffer({resolveWithObject:true});};
  function difference(a,b,rows=a.info.height){let sum=0;const count=a.info.width*rows;for(let i=0;i<count;i++){const p=i*4;for(let c=0;c<3;c++)sum+=Math.abs(a.data[p+c]*a.data[p+3]-b.data[p+c]*b.data[p+3])/255;sum+=Math.abs(a.data[p+3]-b.data[p+3]);}return sum/(count*4);}
  function foot(image){const {data,info}=image;let bottom=0,total=0,sum=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>160)bottom=Math.max(bottom,y);for(let y=bottom-5;y<=bottom;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a>160){sum+=x*a;total+=a;}}return {x:sum/total,y:bottom};}
  const asleep=await capture('sleep',60000),awake=await capture('wake',0),sleepError=difference(asleep,awake);assert.ok(sleepError<2,'sleep-to-wake pose changed: '+sleepError);
  const idle=await capture('idle',0),cube=await capture('cube',6000),faceError=difference(idle,cube,Math.floor(idle.info.height*.43));assert.ok(faceError<2,'cube changed the face/hair: '+faceError);
  const walks=[];for(const direction of ['left','right']){const before=foot(await capture(direction,599.9)),after=foot(await capture(direction,600));assert.ok(Math.abs(before.x-after.x)<6,JSON.stringify({direction,before,after}));assert.ok(Math.abs(before.y-after.y)<4,JSON.stringify({direction,before,after}));walks.push({direction,before,after});}
  const endErrors={};for(const action of ['cube','curtsy','eat','review']){const duration=await pet.webContents.executeJavaScript(`PetMotion.duration(${JSON.stringify(action)})`),end=await capture(action,duration-1);endErrors[action]=difference(idle,end);assert.ok(endErrors[action]<2,action+': neutral end changed '+endErrors[action]);}
  const report={sleepError,faceError,walks,endErrors};fs.writeFileSync(path.join(__dirname,'../artifacts/animation-qa-v04/handoff-report.json'),JSON.stringify(report,null,2));console.log('Own identity and visual handoffs passed',JSON.stringify(report));
 }catch(error){console.error(error);process.exitCode=1;}finally{app.once('will-quit',()=>app.exit(process.exitCode||0));app.quit();}});
}
