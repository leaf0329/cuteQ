'use strict';
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {spawn,execFileSync}=require('child_process'),{Readable}=require('stream'),{pipeline}=require('stream/promises');
const root=path.join(__dirname,'..'),directory=path.join(root,'assets/whale-video'),fps=30,cell=384;
const data=require('../assets/whale/painted-motion.js');
const ffmpeg=execFileSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8',windowsHide:true}).trim();
const pages=new Map();
async function frame(clip,value){
 const atlas=typeof value==='object'?value.atlas:clip.atlas,index=typeof value==='object'?value.frame:value,page=atlas+'-'+Math.floor(index/64);
 if(!pages.has(page)){
  const image=await sharp(path.join(root,'assets/whale',page+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(pages.size>=2)pages.delete(pages.keys().next().value);pages.set(page,image);
 }
 const image=pages.get(page),local=index%64,left=local%8*cell,top=Math.floor(local/8)*cell,rgba=Buffer.alloc(cell*cell*4);
 for(let y=0;y<cell;y++)image.data.copy(rgba,y*cell*4,((top+y)*image.info.width+left)*4,((top+y)*image.info.width+left+cell)*4);
 return rgba;
}
async function encode(name,clip){
 const output=path.join(directory,'own-'+name+'.webm');
 const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size','384x384','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuva420p','-auto-alt-ref','0','-deadline','good','-cpu-used','4','-row-mt','1','-threads','6',output],{windowsHide:true,stdio:['pipe','ignore','pipe']});
 let errors='';child.stderr.on('data',buffer=>{errors=(errors+buffer).slice(-4000);});
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(name+': '+errors)));});
 async function* frames(){let elapsed=0,written=0;for(let i=0;i<clip.frames.length;i++){
  const image=await frame(clip,clip.frames[i]);elapsed+=clip.times[i];const target=Math.max(1,Math.round(elapsed*fps/1000));
  while(written<target){yield image;written++;}
 }}
 try{await Promise.all([pipeline(Readable.from(frames()),child.stdin),done]);}catch(error){child.kill();throw error;}
 console.log('Encoded own animation',name,(fs.statSync(output).size/1024).toFixed(0)+' KiB');
}
(async()=>{
 fs.mkdirSync(directory,{recursive:true});
 const aliases={'meal-break':'eat',left:'right',curl:'sleep','story-recover':'idle',breathe:'idle'},clips={},only=process.argv.slice(2);
 for(const [action,c]of Object.entries(data.clips)){
  const target=aliases[action]||action,length=c.times.reduce((a,b)=>a+b,0),source=data.clips[target],mediaDuration=Math.round(source.times.reduce((a,b)=>a+b,0)*fps/1000)/fps;
  clips[action]={file:'own-'+target,times:[length],parts:[{file:'own-'+target,start:0,end:mediaDuration-1/fps,duration:length}],mediaDuration,loop:c.loop,hold:c.hold,still:['idle','breathe','story-recover'].includes(action),stages:c.stages,origin:'cuteQ'};
  if(!aliases[action]&&(!only.length||only.includes(action)))await encode(action,c);
 }
 const result={fps,turnDuration:600,source:{directory:'whale-video',identity:'cuteQ-original',width:384,height:384,anchorX:183,anchorY:357,ratio:600/384,floorY:238/256*600},clips};
 fs.writeFileSync(path.join(directory,'motion-data.json'),JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(directory,'motion-data.js'),`(function(root){const data=${JSON.stringify(result)};if(typeof module==='object')module.exports=data;else root.PetVideoData=data;})(globalThis);\n`);
 fs.copyFileSync(path.join(root,'assets/whale/portrait.png'),path.join(directory,'portrait.png'));
 console.log('Own character manifest:',Object.keys(clips).length,'states,',new Set(Object.values(clips).map(c=>c.file)).size,'videos');
})().catch(error=>{console.error(error);process.exitCode=1;});
