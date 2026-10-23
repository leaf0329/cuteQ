'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),root=path.join(__dirname,'..'),cell=384,columns=8,pageSize=64;
const vendor=path.join(root,'tmp/rife/rife-ncnn-vulkan-20221029-windows');
const definitions={...require('../design/animation-source.cjs'),...require('../design/fusion-motion.cjs')};
const dataFile=path.join(root,'assets/whale/painted-motion.json');
const data=fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,'utf8')):{clips:{}};
async function interpolate(input,output,count){
 fs.mkdirSync(output,{recursive:true});
 await run(path.join(vendor,'rife-ncnn-vulkan.exe'),['-i',input,'-o',output,'-n',String(count*2),'-m',path.join(vendor,'rife-v4.6'),'-j','2:1:2'],{windowsHide:true,maxBuffer:1024*1024});
}
async function bake(name){
 const definition=definitions[name];if(!definition)throw Error('Unknown animation: '+name);
 const directory=path.join(root,'artifacts/baked',name);fs.mkdirSync(directory,{recursive:true});
 const sourceFrames=new Map(),frames=[],times=[],pairCache=new Map();
 async function source(frame){
  if(!sourceFrames.has(frame))sourceFrames.set(frame,await sharp(path.join(root,'assets/whale',definition.atlas+'.png')).extract({left:frame%definition.columns*definition.cell,top:Math.floor(frame/definition.columns)*definition.cell,width:definition.cell,height:definition.cell}).resize(cell,cell).ensureAlpha().raw().toBuffer());
  return sourceFrames.get(frame);
 }
 async function add(frame,ms){frames.push(frame);times.push(ms);}
 for(let index=0;index<definition.frames.length;index++){
  const a=definition.frames[index],b=definition.frames[index+1]??(definition.loop?definition.frames[0]:a),ms=definition.times[index];
  if(a===b){await add(await source(a),ms);continue;}
  const count=Math.max(2,Math.ceil(ms/1000*30)),key=`${a}-${b}-${count}`;
  if(!pairCache.has(key)){
   const pair=path.join(directory,key),black=path.join(pair,'black'),white=path.join(pair,'white'),blackOut=path.join(pair,'black-out'),whiteOut=path.join(pair,'white-out');
   fs.mkdirSync(black,{recursive:true});fs.mkdirSync(white,{recursive:true});
   for(const [i,frame]of [a,b].entries())for(const [folder,color]of [[black,'#000000'],[white,'#ffffff']])await sharp(await source(frame),{raw:{width:cell,height:cell,channels:4}}).flatten({background:color}).png().toFile(path.join(folder,i+'.png'));
   await interpolate(black,blackOut,count);await interpolate(white,whiteOut,count);
   const generated=[];
   for(let i=0;i<count;i++){
    if(i===0){generated.push(await source(a));continue;}
    const file=String(i+1).padStart(8,'0')+'.png';
    const dark=await sharp(path.join(blackOut,file)).removeAlpha().raw().toBuffer(),light=await sharp(path.join(whiteOut,file)).removeAlpha().raw().toBuffer(),rgba=Buffer.alloc(cell*cell*4);
    for(let p=0;p<cell*cell;p++){
     const j=p*3,k=p*4,difference=(light[j]-dark[j]+light[j+1]-dark[j+1]+light[j+2]-dark[j+2])/3,alpha=Math.max(0,Math.min(1,1-difference/255));
     if(alpha<.025)continue;
     rgba[k+3]=Math.round(alpha*255);for(let channel=0;channel<3;channel++)rgba[k+channel]=Math.min(255,Math.round(dark[j+channel]/alpha));
    }
    generated.push(rgba);
   }
   pairCache.set(key,generated);
  }
  for(const frame of pairCache.get(key))await add(frame,ms/count);
 }
 const atlas='painted-'+name;
 for(let page=0;page<Math.ceil(frames.length/pageSize);page++){
  const group=frames.slice(page*pageSize,(page+1)*pageSize),layers=await Promise.all(group.map(async(frame,i)=>({input:await sharp(frame,{raw:{width:cell,height:cell,channels:4}}).png().toBuffer(),left:i%columns*cell,top:Math.floor(i/columns)*cell})));
  await sharp({create:{width:cell*columns,height:cell*Math.ceil(group.length/columns),channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(path.join(root,'assets/whale',atlas+'-'+page+'.png'));
 }
 data.clips[name]={atlas,frames:frames.map((_,i)=>i),times,loop:definition.loop,hold:definition.hold,stages:definition.stages};
 if(name==='eat')data.clips['meal-break']=data.clips.eat;
 fs.writeFileSync(dataFile,JSON.stringify(data));
 fs.writeFileSync(path.join(root,'assets/whale/painted-motion.js'),`(function(root){const data=${JSON.stringify(data)};if(typeof module==='object')module.exports=data;else root.PetPaintData=data;})(globalThis);\n`);
 console.log('Baked',name,{frames:frames.length,duration:times.reduce((a,b)=>a+b,0)});
}
(async()=>{for(const name of process.argv.slice(2).length?process.argv.slice(2):Object.keys(definitions))await bake(name);})().catch(error=>{console.error(error);process.exitCode=1;});
