'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),clear={r:0,g:0,b:0,alpha:0};
(async()=>{
 fs.mkdirSync(path.join(root,'build'),{recursive:true});
 const badge=await sharp(path.join(root,'design/sources/hq-v5/app-icon-redraw.png')).trim({background:'#00000000',threshold:10}).resize(480,480,{fit:'contain',background:clear}).png().toBuffer();
 await sharp(badge).extend({top:16,bottom:16,left:16,right:16,background:clear}).png().toFile(path.join(root,'build/icon.png'));
 execFileSync(process.execPath,[path.join(__dirname,'build-icon.mjs')],{stdio:'inherit',windowsHide:true});
 console.log('Built icon from its current original artwork.');
})().catch(error=>{console.error(error);process.exitCode=1;});
