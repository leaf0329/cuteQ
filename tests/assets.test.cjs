'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const {PNG}=require('pngjs');const sharp=require('sharp');const root=path.join(__dirname,'..');

test('the current portrait contains a visible character and true transparent margins',()=>{
 const png=PNG.sync.read(fs.readFileSync(path.join(root,'assets/whale-video/portrait.png')));
 let visible=0,transparent=0;
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  const a=png.data[(y*png.width+x)*4+3];if(a>200)visible++;if(a===0)transparent++;
  if(x===0||y===0||x===png.width-1||y===png.height-1)assert.equal(a,0);
 }
 assert.ok(visible>png.width*png.height*.1);assert.ok(transparent>png.width*png.height*.2);
});

test('Codex desktop and web exports use distinct dimensions and valid manifest',async()=>{
 const dir=path.join(root,'codex-deepseek-pet');const manifest=JSON.parse(fs.readFileSync(path.join(dir,'pet.json')));
 assert.equal(manifest.spriteVersionNumber,2);assert.equal(manifest.spritesheetPath,'spritesheet.webp');
 const desktop=await sharp(path.join(dir,'spritesheet.webp')).metadata(),web=await sharp(path.join(dir,'spritesheet-web.webp')).metadata();
 assert.equal(desktop.width,1536);assert.equal(desktop.height,2288);assert.equal(desktop.hasAlpha,true);assert.equal(web.height,1872);
});

test('the independently drawn icon has transparent PNG and Windows ICO sizes',async()=>{
 const icon=await sharp(path.join(root,'build/icon.png')).metadata();assert.equal(icon.width,512);assert.equal(icon.height,512);assert.equal(icon.hasAlpha,true);
 const ico=fs.readFileSync(path.join(root,'build/icon.ico')),sizes=[];
 for(let i=0;i<ico.readUInt16LE(4);i++)sizes.push(ico[6+i*16]||256);
 for(const size of [16,32,48,256])assert.ok(sizes.includes(size));
});
