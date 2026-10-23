'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'../assets/whale'),file=path.join(root,'painted-motion.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
for(const [alias,target]of [['left','right'],['curl','sleep'],['meal-break','eat']])data.clips[alias]=data.clips[target];
data.clips['story-recover']={...data.clips.idle,loop:false};
let preparation=data.clips['sneak-prepare'];
if(!preparation&&data.clips.sneak){
 const current=data.clips.sneak,count=current.frames.findIndex(frame=>frame.atlas===data.clips.eat.atlas);
 preparation={atlas:'painted-sneak-prepare',frames:current.frames.slice(0,count).map(frame=>frame.frame),times:current.times.slice(0,count)};
}
if(preparation){
 const meal=data.clips.eat,start=meal.stages.find(stage=>stage.name==='lift').start;
 let at=0,index=0;while(at<start-.001){at+=meal.times[index++];}
 data.clips.sneak={atlas:'painted-sneak-composite',frames:[...preparation.frames.map(frame=>({atlas:preparation.atlas,frame})),...meal.frames.slice(index).map(frame=>({atlas:meal.atlas,frame}))],times:[...preparation.times,...meal.times.slice(index)],loop:false,hold:false};
}
delete data.clips['sneak-prepare'];data.anchorX=488/1024;data.frameRate=30;
fs.writeFileSync(file,JSON.stringify(data));
fs.writeFileSync(path.join(root,'painted-motion.js'),`(function(root){const data=${JSON.stringify(data)};if(typeof module==='object')module.exports=data;else root.PetPaintData=data;})(globalThis);\n`);
const used=new Set();
for(const clip of Object.values(data.clips))for(const value of clip.frames){const {atlas,frame}=typeof value==='object'?value:{atlas:clip.atlas,frame:value};used.add(atlas+'-'+Math.floor(frame/64)+'.png');}
for(const file of fs.readdirSync(root))if(/^painted-.+-\d+\.png$/.test(file)&&!used.has(file))fs.unlinkSync(path.join(root,file));
console.log('Finalized native animations:',Object.keys(data.clips).length);
