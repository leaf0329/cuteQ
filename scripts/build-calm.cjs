'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'design/sources/calm-v1');
const names=['idle','hold','lift','mouth','bitten','small','last-mouth','finish','smile','rest','rice-under-chin','empty-hands-lowering'];
async function normalize(name){
 return normalizeBuffer(path.join(['rice-under-chin','empty-hands-lowering'].includes(name)?path.join(root,'design/sources/refine-v3'):source,name+'.png'));
}
async function normalizeBuffer(input,fixedFactor){
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const count=info.width*info.height,seen=new Uint8Array(count),queue=new Uint32Array(count);
 for(let p=0;p<count;p++)if(!seen[p]&&data[p*4+3]>32){
  let head=0,tail=0;queue[tail++]=p;seen[p]=1;
  while(head<tail){const q=queue[head++],x=q%info.width,y=Math.floor(q/info.width);
   for(const next of [x?q-1:-1,x<info.width-1?q+1:-1,y?q-info.width:-1,y<info.height-1?q+info.width:-1])if(next>=0&&!seen[next]&&data[next*4+3]>32){seen[next]=1;queue[tail++]=next;}
  }
  if(tail<150)for(let i=0;i<tail;i++)data.fill(0,queue[i]*4,queue[i]*4+4);
 }
 let left=info.width,top=info.height,right=0,bottom=0,footSum=0,footCount=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>160){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 for(let y=Math.round(top+(bottom-top)*.92);y<=bottom;y++)for(let x=left;x<=right;x++)if(data[(y*info.width+x)*4+3]>160){footSum+=x-left;footCount++;}
 const width=right-left+1,height=bottom-top+1,factor=fixedFactor??820/height;
 if(height<360)throw Error('Animation source resolution too low');
 const w=Math.round(width*factor),h=Math.round(height*factor),x=Math.round(488-footSum/footCount*factor),y=952-h;
 const tile=await sharp(data,{raw:info}).extract({left,top,width,height}).resize(w,h).png().toBuffer();
 return sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:tile,left:x,top:y}]).raw().toBuffer();
}
async function main(){
 const frames=[],base=await normalize('idle');
 for(const name of names){
  const generated=await normalize(name),output=Buffer.from(base);
  // 肩膀以上和脚底没有参与吃饭，固定为同一张原画，消除生成批次带来的脸型、发丝及站位抖动。
  const region=['smile','rest'].includes(name)?{l:350,r:650,t:340,b:540}:{l:275,r:730,t:480,b:835};
  if(name!=='idle')for(let y=region.t;y<region.b;y++)for(let x=region.l;x<region.r;x++){
   const weight=Math.min(1,(x-region.l)/10,(region.r-x)/10,(y-region.t)/10,(region.b-y)/10),p=(y*1024+x)*4;
   const alpha=(base[p+3]*(1-weight)+generated[p+3]*weight)/255;
   for(let c=0;c<3;c++)output[p+c]=alpha?Math.round((base[p+c]*base[p+3]/255*(1-weight)+generated[p+c]*generated[p+3]/255*weight)/alpha):0;
   output[p+3]=Math.round(alpha*255);
  }
  frames.push(await sharp(output,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer());
 }
 await sharp({create:{width:4096,height:3072,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(frames.map((input,i)=>({input,left:i%4*1024,top:Math.floor(i/4)*1024}))).png().toFile(path.join(root,'assets/whale/calm-core.png'));
 fs.mkdirSync(path.join(root,'artifacts/calm-v1'),{recursive:true});
 const small=await Promise.all(frames.map(frame=>sharp(frame).resize(256,256).png().toBuffer()));
 await sharp({create:{width:1280,height:Math.ceil(small.length/5)*256,channels:4,background:'#edf1f8'}}).composite(small.map((input,i)=>({input,left:i%5*256,top:Math.floor(i/5)*256}))).png().toFile(path.join(root,'artifacts/calm-v1/contact.png'));
 console.log('Built calm core:',names);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={normalizeBuffer};
