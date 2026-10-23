'use strict';
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {characters}=require('./build-redrawn-sheets.cjs'),{normalizeBuffer}=require('./build-calm.cjs');
const root=path.join(__dirname,'..');
(async()=>{
 const base=await sharp(path.join(root,'design/sources/fusion-v4/identity.png')).ensureAlpha().raw().toBuffer();
 fs.mkdirSync(path.join(root,'artifacts/fusion-v4'),{recursive:true});
 for(const name of ['cube','curtsy']){
  const tiles=await characters(path.join(root,'design/sources/fusion-v4',name+'-sheet.png')),frames=[Buffer.from(base)];let factor;
  for(let i=0;i<tiles.length;i++){
   if(name==='curtsy'&&i===0){const {data,info}=await sharp(tiles[i]).ensureAlpha().raw().toBuffer({resolveWithObject:true});let top=info.height,bottom=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>160){top=Math.min(top,y);bottom=Math.max(bottom,y);}factor=820/(bottom-top+1);}
   const generated=await normalizeBuffer(tiles[i],factor);
   if(name==='curtsy'){frames.push(generated);continue;}
   const output=Buffer.from(base),region={l:240,r:750,t:470,b:845};
   // 持物只影响手臂与围裙范围，沿用原画的脸、发丝、腿脚，避免一次动作换脸。
   for(let y=region.t;y<region.b;y++)for(let x=region.l;x<region.r;x++){
    const weight=Math.min(1,(x-region.l)/10,(region.r-x)/10,(y-region.t)/10,(region.b-y)/10),p=(y*1024+x)*4,a=(base[p+3]*(1-weight)+generated[p+3]*weight)/255;
    for(let c=0;c<3;c++)output[p+c]=a?Math.round((base[p+c]*base[p+3]/255*(1-weight)+generated[p+c]*generated[p+3]/255*weight)/a):0;
    output[p+3]=Math.round(a*255);
   }
   frames.push(output);
  }
  const images=await Promise.all(frames.map(frame=>sharp(frame,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer()));
  await sharp({create:{width:4096,height:2048,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(images.map((input,i)=>({input,left:i%4*1024,top:Math.floor(i/4)*1024}))).png().toFile(path.join(root,'assets/whale','fusion-'+name+'.png'));
  await sharp({create:{width:1280,height:256,channels:4,background:'#edf1f8'}}).composite(await Promise.all(images.map(async(input,i)=>({input:await sharp(input).resize(256,256).png().toBuffer(),left:i*256,top:0})))).png().toFile(path.join(root,'artifacts/fusion-v4',name+'-keys.png'));
  console.log('Prepared own-character keys',name);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
