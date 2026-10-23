'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cuteq-animation-qa-'));
const child=spawn(require('electron'),[path.join(__dirname,'animation-qa-entry.cjs'),`--test-user-data=${directory}`],{stdio:'inherit',windowsHide:true});
const timer=setTimeout(()=>{child.kill();process.exitCode=1;},300000);
child.on('exit',(code,signal)=>{clearTimeout(timer);fs.rmSync(directory,{recursive:true,force:true});process.exitCode=signal||code===null?1:code;});
