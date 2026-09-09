const cfg=window.RETRO_CONFIG||{};
const {createClient}=window.supabase||{};
const supabase=(createClient&&cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.includes("YOUR_"))?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY):null;
let room=null,user=null,clientId=crypto.randomUUID(),channel=null,section=null;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
function show(id){$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active')}
function toast(x){const t=$('#toast');t.textContent=x;t.classList.add('toast-show');setTimeout(()=>t.classList.remove('toast-show'),2200)}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function code(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function requireBackend(){if(!supabase){toast('Add your Supabase keys to config.js first');return false}return true}

$('#createBtn').onclick=()=>{ $('#setupHeading').textContent='Create a room';$('#setupSubmit').textContent='Create room →';$('#setupSubmit').dataset.mode='create';$('#setupError').textContent='';show('setup')};
$('#joinBtn').onclick=()=>{ $('#setupHeading').textContent='Join a room';$('#setupSubmit').textContent='Join room →';$('#setupSubmit').dataset.mode='join';$('#roomName').value='';$('#yourName').value='';$('#setupError').textContent='';show('setup')};
$$('[data-home]').forEach(x=>x.onclick=()=>show('home'));

$('#setupSubmit').onclick=async()=>{
 if(!requireBackend())return;
 const name=$('#yourName').value.trim();if(!name){$('#setupError').textContent='Enter your name.';return}
 try{
  if($('#setupSubmit').dataset.mode==='create'){
   const roomName=$('#roomName').value.trim()||'Sprint Retrospective', c=code();
   const {data,error}=await supabase.from('rooms').insert({code:c,name:roomName}).select().single();
   if(error)throw error; await joinRoom(data,name);
  }else{
   const c=$('#roomName').value.trim().toUpperCase(); if(!c){$('#setupError').textContent='Enter the room code.';return}
   const {data,error}=await supabase.from('rooms').select('*').eq('code',c).single();
   if(error||!data){$('#setupError').textContent='Room not found.';return} await joinRoom(data,name);
  }
 }catch(e){console.error(e);$('#setupError').textContent=e.message||'Something went wrong.'}
};

async function joinRoom(r,n){
 room=r;user=n;
 const {error}=await supabase.from('participants').upsert({room_id:r.id,name:n,client_id:clientId},{onConflict:'room_id,client_id'});
 if(error)throw error;
 $('#title').textContent=r.name;$('#code').textContent=r.code;show('board');await subscribe();await load();toast('Connected');
}
async function subscribe(){
 if(channel)await supabase.removeChannel(channel);
 channel=supabase.channel(`retro-room-${room.id}`)
 .on('postgres_changes',{event:'*',schema:'public',table:'thoughts',filter:`room_id=eq.${room.id}`},load)
 .on('postgres_changes',{event:'*',schema:'public',table:'participants',filter:`room_id=eq.${room.id}`},loadParticipants)
 .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},payload=>{if(payload.new?.thought_id||payload.old?.thought_id)load()})
 .subscribe(status=>{if(status==='CHANNEL_ERROR')toast('Realtime connection error')});
}
async function load(){await Promise.all([loadThoughts(),loadParticipants()])}
async function loadParticipants(){
 const {data}=await supabase.from('participants').select('name').eq('room_id',room.id);
 $('#online').textContent=data?.length||0;
}
async function loadThoughts(){
 const {data,error}=await supabase.from('thoughts').select('*').eq('room_id',room.id).order('created_at');
 if(error){console.error(error);return}
 const ids=(data||[]).map(x=>x.id);
 let reactions=[];
 if(ids.length){const r=await supabase.from('reactions').select('*').in('thought_id',ids);reactions=r.data||[]}
 const by={};reactions.forEach(r=>(by[r.thought_id]??=[]).push(r));
 const counts=t=>['like','heart','support'].reduce((o,k)=>{o[k]=(by[t.id]||[]).filter(r=>r.reaction_type===k).length;return o},{});
 render(data||[],by,counts);
}
function render(thoughts,by,counts){
 const map={good:['goodCards','goodCount'],problem:['problemCards','problemCount'],shout:['shoutCards','shoutCount']};
 for(const sec of Object.keys(map)){const arr=thoughts.filter(t=>t.section===sec);$('#'+map[sec][1]).textContent=arr.length;$('#'+map[sec][0]).innerHTML=arr.map(t=>{
  const c=counts(t),mine=by[t.id]?.filter(r=>r.client_id===clientId).map(r=>r.reaction_type)||[];
  return `<article class="thought"><p>${esc(t.content)}</p>${sec==='shout'&&t.recipient_name?`<div class="author">To <strong>${esc(t.recipient_name)}</strong></div>`:''}<div class="author">— <strong>${esc(t.author_name)}</strong></div><div class="reactions">${[['like','👍'],['heart','❤️'],['support','🙌']].map(([k,e])=>`<button class="react ${mine.includes(k)?'active':''}" data-id="${t.id}" data-type="${k}">${e} ${c[k]||''}</button>`).join('')}</div></article>`
 }).join('')}
 $$('.react').forEach(b=>b.onclick=()=>react(b.dataset.id,b.dataset.type));
}
$$('.add').forEach(b=>b.onclick=()=>openModal(b.dataset.section));
function openModal(s){section=s;$('#modalTitle').textContent=s==='shout'?'Give a shout-out':'Add a thought';$('#modalHint').textContent=s==='shout'?'Recognize someone who made a difference.':'Share something with the team.';$('#recipientBox').classList.toggle('hidden',s!=='shout');$('#thought').value='';$('#recipient').value='';$('#chars').textContent='0 / 500';$('#thoughtModal').classList.add('show')}
$$('[data-close]').forEach(x=>x.onclick=()=>x.closest('.modal').classList.remove('show'));
$('#thought').oninput=e=>$('#chars').textContent=`${e.target.value.length} / 500`;
$('#saveThought').onclick=async()=>{
 const content=$('#thought').value.trim(),recipient=$('#recipient').value.trim();
 if(!content)return toast('Write a thought first');if(section==='shout'&&!recipient)return toast('Add the colleague name');
 const {error}=await supabase.from('thoughts').insert({room_id:room.id,section,content,author_name:user,recipient_name:recipient||null});
 if(error)toast(error.message);else{$('#thoughtModal').classList.remove('show');toast('Added to board')}
};
async function react(id,type){
 const {data:existing}=await supabase.from('reactions').select('id').eq('thought_id',id).eq('client_id',clientId).eq('reaction_type',type).maybeSingle();
 if(existing)await supabase.from('reactions').delete().eq('id',existing.id);else await supabase.from('reactions').insert({thought_id:id,client_id:clientId,reaction_type:type});
 await loadThoughts();
}
$('#share').onclick=async()=>{
 const url=new URL(location.href);url.hash=`room=${room.code}`;
 const text=`Join my retrospective "${room.name}" — ${url.href}`;
 try{await navigator.clipboard.writeText(text);toast('Invite link copied')}catch{prompt('Copy invite link:',url.href)}
};
$('#export').onclick=()=>$('#exportModal').classList.add('show');
$$('[data-format]').forEach(b=>b.onclick=()=>exportData(b.dataset.format));
async function exportData(format){
 const {data:thoughts}=await supabase.from('thoughts').select('*').eq('room_id',room.id).order('created_at');
 const ids=(thoughts||[]).map(x=>x.id);let reactions=[];if(ids.length){const r=await supabase.from('reactions').select('*').in('thought_id',ids);reactions=r.data||[]}
 const count=(id,k)=>reactions.filter(r=>r.thought_id===id&&r.reaction_type===k).length;
 let body;
 if(format==='json')body=JSON.stringify({room,thoughts,reactions},null,2);
 else if(format==='csv'){const rows=[['Section','Thought','Author','Shout-out To','Likes','Hearts','Support','Created At']];(thoughts||[]).forEach(t=>rows.push([t.section,t.content,t.author_name,t.recipient_name||'',count(t.id,'like'),count(t.id,'heart'),count(t.id,'support'),t.created_at]));body=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')}
 else {body=`${room.name}\nRoom: ${room.code}\n\n`;[['good','WHAT WENT WELL'],['problem','PROBLEMS FACED'],['shout','SHOUT-OUTS']].forEach(([s,h])=>{body+=h+'\n'+Array(h.length+1).join('=')+'\n';(thoughts||[]).filter(t=>t.section===s).forEach(t=>body+=`• ${t.content}\n  — ${t.author_name}${t.recipient_name?' → '+t.recipient_name:''} | 👍 ${count(t.id,'like')} ❤️ ${count(t.id,'heart')} 🙌 ${count(t.id,'support')}\n`);body+='\n'})}
 const ext=format==='json'?'json':format==='csv'?'csv':'txt';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'text/plain'}));a.download=`retro-${room.code}.${ext}`;a.click();$('#exportModal').classList.remove('show');toast('Export downloaded')
}
$('#leave').onclick=async()=>{if(!room)return;await supabase.from('participants').delete().eq('room_id',room.id).eq('client_id',clientId);if(channel)await supabase.removeChannel(channel);room=null;show('home');toast('Left room')};
window.addEventListener('beforeunload',()=>{if(room)navigator.sendBeacon?.('');});
