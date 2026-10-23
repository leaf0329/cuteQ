'use strict';
const api=window.petApi, $=s=>document.querySelector(s);
let state={},currentSettings={},busy=false,attached=false,gameTimer=null,gameEnd=0,score=0;
let activeReply=null;
api?.onChatDelta(value=>{
  if(!activeReply||value.requestId!==activeReply.id||typeof value.content!=='string')return;
  const list=$('#messages'),nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<80;
  activeReply.text=value.content;activeReply.node.textContent=value.content;
  if(nearBottom)activeReply.node.scrollIntoView({block:'end'});
});
function notice(text){$('#notice').textContent=text;$('#notice').hidden=!text;}
function tab(name){if(name!=='play'&&gameTimer)stopGame();document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id===name));document.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('selected',e.dataset.tab===name));notice('');if(name==='memories')refreshMemories();}
document.querySelectorAll('[data-tab]').forEach(e=>e.onclick=()=>tab(e.dataset.tab));
$('#start-chat').onclick=()=>{tab('chat');$('#prompt').focus();};
$('#feed').onclick=()=>api?.interact('feed');
document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>api?.interact(e.dataset.action));
async function call(fn){try{const r=await fn();if(!r.ok)throw new Error(r.error);return r.value;}catch(e){notice(e.message||'暂时无法完成，请重试。');return undefined;}}
function updateState(value){state=value;$('#mode-label').textContent=({company:'自在待着',focus:'一起专注',quiet:'安静待着'})[state.mode]||'自在待着';$('#status').textContent=state.chatBusy?'等一下，好像有点思路了……':'有事就说嘛，我听着呢。';$('#fullness').textContent=state.fullness>85?'满足了，下一顿再叫我。':state.fullness<35?'有点馋，想补充脑力口粮。':'刚刚好，还能再吃一点。';$('#focus').textContent=state.mode==='focus'?'结束专注':'开始专注';updateClock();}
function updateClock(){const s=Math.max(0,Math.ceil(((state.focusUntil||0)-Date.now())/1000));$('#focus-clock').textContent=s?`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:'一起专注';}
setInterval(updateClock,1000);
$('#focus').onclick=()=>call(()=>api.mode(state.mode==='focus'?'company':'focus',Number($('#minutes').value))).then(v=>v&&updateState(v));
$('#quiet').onclick=()=>call(()=>api.mode(state.mode==='quiet'?'company':'quiet')).then(v=>v&&updateState(v));
function message(role,text,error=false){$('#messages .chat-empty')?.remove();const el=document.createElement('div');el.className=`message ${role}${error?' error':''}`;el.textContent=text;$('#messages').append(el);el.scrollIntoView({block:'end'});return el;}
function setBusy(value){busy=value;$('#send').disabled=value;$('#cancel').hidden=!value;$('#capture').disabled=value;$('#clear-chat').disabled=value;}
$('#chat-form').onsubmit=async e=>{e.preventDefault();if(busy||!api)return;const text=$('#prompt').value.trim();if(!text)return;
  message('user',text);const pending=message('assistant','让我想想……');setBusy(true);notice('');
  activeReply={id:crypto.randomUUID(),node:pending,text:''};
  try{const result=await api.chat({text,attach:attached,requestId:activeReply.id});if(!result.ok)throw new Error(result.error);pending.textContent=result.value.reply;if($('#prompt').value.trim()===text)$('#prompt').value='';}
  catch(err){if(activeReply.text){pending.textContent=activeReply.text;message('assistant',err.message,true);}else{pending.textContent=err.message;pending.classList.add('error');}}
  finally{activeReply=null;setBusy(false);removeCapture();}
};
$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#chat-form').requestSubmit();}};
$('#cancel').onclick=()=>api?.cancel();
$('#clear-chat').onclick=async()=>{const v=await call(()=>api.clear());if(v){$('#messages').replaceChildren();removeCapture();notice('共同对话记录已清空，长期记忆仍保留，可在记忆页管理。');}};
function removeCapture(){attached=false;$('#capture-preview').removeAttribute('src');$('#attachment').hidden=true;api?.discardCapture();}
$('#remove-capture').onclick=removeCapture;
$('#capture').onclick=async()=>{const image=await call(()=>api.capture());if(image){attached=true;$('#capture-preview').src=image;$('#attachment').hidden=false;}};
function fillSettings(s){currentSettings=s;const form=$('#settings-form');for(const [key,value] of Object.entries(s)){const field=form.elements.namedItem(key);if(!field)continue;if(field.type==='checkbox')field.checked=value===true;else field.value=value??'';}
  $('#size-slider').value=Math.round(s.scale*100);$('#size-output').textContent=`${Math.round(s.scale*100)}%`;
  form.elements.apiKey.value='';form.elements.removeKey.checked=false;form.elements.backendToken.value='';
  $('#key-state').textContent=s.backendMode==='remote'?'模型密钥由服务器管理。':s.hasKey?'已安全保存访问密钥。':'尚未保存 DeepSeek 密钥。';
  $('#backend-state').textContent=s.backendStatus||'';$('#memory-summary').textContent=s.memory||'叫你什么、什么时候安静？去设置里告诉我。';$('#speech-mode').value=s.speechMode||'overheard';backendFields();}
$('#settings-form').onsubmit=async e=>{e.preventDefault();$('#save-settings').disabled=true;const form=e.currentTarget;const values={};
  for(const field of form.elements){if(!field.name||['apiKey','removeKey','backendToken'].includes(field.name))continue;values[field.name]=field.type==='checkbox'?field.checked:field.name==='scale'?Number(field.value):field.value;}
  values.scale=Number($('#size-slider').value)/100;delete values.scalePercent;
  if(form.elements.apiKey.value)values.apiKey=form.elements.apiKey.value;if(form.elements.removeKey.checked)values.apiKey='';
  if(form.elements.backendToken.value)values.backendToken=form.elements.backendToken.value;
  const result=await call(()=>api.save(values));if(result){fillSettings(result);notice('设置已保存。');}$('#save-settings').disabled=false;
};
function backendFields(){const remote=$('#settings-form').elements.backendMode.value==='remote';$('#remote-backend').hidden=!remote;for(const field of $('#remote-backend').querySelectorAll('input'))field.disabled=!remote;}
$('#settings-form').elements.backendMode.onchange=backendFields;
async function refreshMemories(){
  const notes=await call(()=>api.memories());if(!notes)return;
  $('#memory-list').replaceChildren();$('#memory-count').textContent=`${notes.length} 条共同记忆`;
  if(!notes.length){const p=document.createElement('p');p.className='help';p.textContent='相处之后，值得留下的事情会出现在这里。';$('#memory-list').append(p);}
  for(const note of notes){
    const card=document.createElement('article');card.className='memory-card';
    const title=document.createElement('b');title.textContent=note.topic;
    const text=document.createElement('textarea');text.rows=3;text.maxLength=1200;text.value=note.text;text.setAttribute('aria-label',`编辑记忆：${note.topic}`);
    const evidence=document.createElement('p');evidence.className='help';evidence.textContent=`来源：${note.channel==='desktop'?'桌面交谈':'QQ 私聊'} · ${new Date(note.updated_at).toLocaleString('zh-CN')}\n原话：${note.evidence}`;
    const actions=document.createElement('div');actions.className='memory-actions';
    for(const [label,value]of [['保存修正',()=>text.value],['删除记忆',()=>null]]){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{button.disabled=true;const result=await call(()=>api.changeMemory(note.id,value()));if(result){notice('记忆已更新，两端以后都使用新版本。');await refreshMemories();}else button.disabled=false;};actions.append(button);}
    card.append(title,text,evidence,actions);$('#memory-list').append(card);
  }
}
$('#refresh-memory').onclick=refreshMemories;
api?.onTurn(value=>{if(activeReply?.id===value.id)return;message('user',value.text);if(value.reply)message('assistant',value.reply);$('#speech-result').textContent=value.memories.length?`已留下 ${value.memories.length} 条记忆`:'这段交谈已保存';});
$('#export').onclick=async()=>{const dest=await call(()=>api.exportPet());if(dest)notice(`宠物包已导出到：${dest}`);};
let sizeTimer=null;
$('#size-slider').oninput=()=>{const percent=Number($('#size-slider').value);$('#size-output').textContent=`${percent}%`;clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>call(()=>api.scale(percent/100)),60);};
const expressions=[['摸摸','pet'],['慢慢吃饭团','feed'],['轻轻摇一会儿','dance'],['庆祝','celebrate'],['打招呼','wave'],['探头','peek'],['悄悄拿出口粮','sneak'],['吃饱满足','satisfied'],['认真看小本子','review'],['震惊','shock'],['鼓腮赌气','pout'],['认错','sorry'],['偷偷哼歌','hum'],['慢慢吃一顿','meal-break'],['翻翻小本子','token-game'],['轻摇尾巴','tail-sway'],['蜷起来休息','curl'],['舒展一下','stretch'],['专心玩魔方','cube'],['行个女仆礼','curtsy']];
for(const [name,kind]of expressions){const button=document.createElement('button');button.textContent=name;button.onclick=()=>api?.interact(kind);$('#expression-gallery').append(button);}
function moveToken(){const board=$('#game-board');const token=$('#token');token.style.left=`${12+Math.random()*Math.max(1,board.clientWidth-72)}px`;token.style.top=`${12+Math.random()*Math.max(1,board.clientHeight-72)}px`;}
function stopGame(){clearInterval(gameTimer);gameTimer=null;$('#token').hidden=true;$('#game-start').disabled=false;$('#score').textContent=`接住 ${score} 口！大肥鱼收好了。`;api?.interact(score>5?'celebrate':'feed');}
$('#game-start').onclick=()=>{score=0;gameEnd=Date.now()+30000;$('#token').hidden=false;$('#game-start').disabled=true;moveToken();$('#token').focus();gameTimer=setInterval(()=>{const left=Math.max(0,Math.ceil((gameEnd-Date.now())/1000));$('#score').textContent=`${score} 口 · 剩余 ${left} 秒`;if(!left)stopGame();},200);};
$('#token').onclick=()=>{if(!gameTimer)return;score++;moveToken();};
window.addEventListener('beforeunload',()=>clearInterval(gameTimer));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameTimer)stopGame();});
api?.onState(updateState);api?.onNotice(notice);
api?.onSettings(s=>{currentSettings=s;if(!s.autoVision)$('#settings-form').elements.autoVision.checked=false;$('#memory-summary').textContent=s.memory||'叫你什么、什么时候安静？去设置里告诉我。';});
if(api){call(()=>api.settings()).then(data=>{if(!data)return;fillSettings(data.settings);updateState(data.state);for(const m of data.history)message(m.role,m.content);if(data.settings.backendMode==='local'&&!data.settings.hasKey){tab('settings');notice('先填写 DeepSeek 访问密钥，保存后就能聊天和记住你说的话。');}});api.ready();}else notice('这是界面预览。桌面功能请通过应用启动。');
