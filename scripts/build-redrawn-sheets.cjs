'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {normalizeBuffer}=require('./build-calm.cjs'),layouts=require('../design/redraw-layouts.cjs');
const root=path.join(__dirname,'..');
async function characters(file){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,labels=new Int32Array(w*h),queue=new Uint32Array(w*h),parts=[];
 for(let p=0;p<w*h;p++)if(!labels[p]&&data[p*4+3]>48){
  const part={id:parts.length+1,left:w,right:0,top:h,bottom:0,sumX:0,sumY:0};let head=0,tail=0;queue[tail++]=p;labels[p]=part.id;
  while(head<tail){const q=queue[head++],x=q%w,y=Math.floor(q/w);part.left=Math.min(part.left,x);part.right=Math.max(part.right,x);part.top=Math.min(part.top,y);part.bottom=Math.max(part.bottom,y);part.sumX+=x;part.sumY+=y;
   for(const n of [x?q-1:-1,x<w-1?q+1:-1,y?q-w:-1,y<h-1?q+w:-1])if(n>=0&&!labels[n]&&data[n*4+3]>48){labels[n]=part.id;queue[tail++]=n;}
  }parts.push({...part,count:tail});
 }
 const bodies=parts.filter(p=>p.count>5000).sort((a,b)=>b.count-a.count).slice(0,4);
 if(bodies.length!==4)throw Error(file+': expected four distinct complete characters');
 const result=[];
 // 生成图的内容可能越过网格中线；按完整连通轮廓提取，避免把邻格的鞋尖裁进发顶。
 for(const body of bodies){
  const slot=(body.sumY/body.count<h/2?0:2)+(body.sumX/body.count<w/2?0:1);if(result[slot])throw Error(file+': overlapping character cells');
  const left=Math.max(0,body.left-2),top=Math.max(0,body.top-2),width=Math.min(w,body.right+3)-left,height=Math.min(h,body.bottom+3)-top,rgba=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const sx=left+x,sy=top+y,p=sy*w+sx;let keep=labels[p]===body.id;
   if(!keep&&data[p*4+3]>8)for(let dy=-2;dy<=2&&!keep;dy++)for(let dx=-2;dx<=2;dx++){const nx=sx+dx,ny=sy+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&labels[ny*w+nx]===body.id){keep=true;break;}}
   if(keep)data.copy(rgba,(y*width+x)*4,p*4,p*4+4);
  }
  result[slot]=await sharp(rgba,{raw:{width,height,channels:4}}).png().toBuffer();
 }
 return result;
}
async function build(name){
 const layout=layouts[name];if(!layout)throw Error('Unknown sheet: '+name);
 const file=path.join(root,'design/sources',name==='walk-mid'?'refine-v3':'redraw-v2',name+'-sheet.png'),metadata=await sharp(file).metadata();
 const tiles=await characters(file);
 const base=await sharp(path.join(root,'assets/whale/calm-core.png')).extract({left:0,top:0,width:1024,height:1024}).raw().toBuffer();
 const frames=[await sharp(base,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer()];
 let factor;
 for(let i=0;i<4;i++){
  const input=tiles[i];
  if(layout.whole&&i===0){const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});let top=info.height,bottom=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>160){top=Math.min(top,y);bottom=Math.max(bottom,y);}factor=820/(bottom-top+1);}
  const generated=await normalizeBuffer(input,factor),output=layout.whole?generated:Buffer.from(base);
  for(const region of layout.regions||[])for(let y=region.t;y<region.b;y++)for(let x=region.l;x<region.r;x++){
   const weight=Math.min(1,(x-region.l)/10,(region.r-x)/10,(y-region.t)/10,(region.b-y)/10),p=(y*1024+x)*4,a=(base[p+3]*(1-weight)+generated[p+3]*weight)/255;
   for(let c=0;c<3;c++)output[p+c]=a?Math.round((base[p+c]*base[p+3]/255*(1-weight)+generated[p+c]*generated[p+3]/255*weight)/a):0;
   output[p+3]=Math.round(a*255);
  }
  frames.push(await sharp(output,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer());
 }
 if(name==='walk')for(let i=1;i<=4;i++)frames.push(await sharp(path.join(root,'assets/whale/redraw-walk-mid.png')).extract({left:i%4*1024,top:Math.floor(i/4)*1024,width:1024,height:1024}).png().toBuffer());
 if(name==='turn')frames.push(await sharp(path.join(root,'assets/whale/redraw-walk.png')).extract({left:1024,top:0,width:1024,height:1024}).png().toBuffer());
 if(name==='sneak')frames.push(await sharp(path.join(root,'assets/whale/calm-core.png')).extract({left:1024,top:0,width:1024,height:1024}).png().toBuffer());
 async function atlas(file,images){await sharp({create:{width:4096,height:Math.ceil(images.length/4)*1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(images.map((input,i)=>({input,left:i%4*1024,top:Math.floor(i/4)*1024}))).png().toFile(path.join(root,'assets/whale',file+'.png'));}
 await atlas('redraw-'+name,frames);
 if(name==='turn'){
  const mirrored=[frames[0]];
  // 绕脚底中心 488px 镜像，保留中性正面原画；左右转身起点都不会把尾巴瞬间翻到另一侧。
  for(const frame of frames.slice(1)){
   const reversed=await sharp(frame).flop().png().toBuffer();
   mirrored.push(await sharp(reversed).extract({left:48,top:0,width:976,height:1024}).extend({left:0,right:48,top:0,bottom:0,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer());
  }
  await atlas('redraw-turn-left',mirrored);
 }
 fs.mkdirSync(path.join(root,'artifacts/redraw-v2'),{recursive:true});
 await sharp({create:{width:frames.length*256,height:256,channels:4,background:'#edf1f8'}}).composite(await Promise.all(frames.map(async(input,i)=>({input:await sharp(input).resize(256,256).png().toBuffer(),left:i*256,top:0})))).png().toFile(path.join(root,'artifacts/redraw-v2',name+'-contact.png'));
 console.log('Prepared sheet:',name,metadata.width,metadata.height);
}
if(require.main===module)(async()=>{for(const name of process.argv.slice(2))await build(name);})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={characters};
