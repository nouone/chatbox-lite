export const LOCAL_CHAT_WEB_UI = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Chatbox Lite Web</title>
<style>body{font:16px system-ui;max-width:850px;margin:2rem auto;padding:1rem;background:#faf9f5;color:#242424}input,select,textarea,button{font:inherit;padding:.7rem;margin:.3rem 0;box-sizing:border-box}input,select,textarea{width:100%}textarea{min-height:90px}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:1rem;background:#eeece6;border-radius:12px}button{cursor:pointer}#status{color:#666}</style>
<h1>Chatbox Lite Web</h1><p>Uses the running desktop app, its configured models, tools, and saved conversations.</p>
<label>Local API token<input id="token" type="password" autocomplete="off"></label><button id="connect">Connect</button><p id="status">Enter the token from the desktop profile's local-api-token.txt file.</p>
<label>Conversation<select id="chats"></select></label><button id="refresh">Refresh chats</button><div id="messages"></div>
<label>Message<textarea id="content"></textarea></label><button id="send">Send</button>
<script>
const el=id=>document.getElementById(id);let token='',socket,selected='';
const status=s=>el('status').textContent=s;
async function api(path,options={}){const r=await fetch(path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});const body=await r.json();if(!r.ok)throw Error(body.error||'Request failed');return body}
function draw(chat){el('messages').replaceChildren();for(const m of chat.messages||[]){const p=document.createElement('pre');p.textContent=m.role+': '+m.text+(m.error?' — Error: '+m.error:'');el('messages').append(p)}status(chat.error|| (chat.waitingForApproval?'Approval needed in Desktop':chat.generating?'Generating in desktop…':'Connected to desktop'))}
async function choose(){selected=el('chats').value;if(!selected)return;draw(await api('/api/chats/'+encodeURIComponent(selected)));if(socket)socket.close();socket=new WebSocket('ws://'+location.host+'/api/events',['cbl-api',token]);socket.onopen=()=>socket.send(JSON.stringify({type:'subscribe',chatId:selected}));socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='error')status(d.error);if(d.type==='chat.snapshot'&&d.status===200&&d.chat.id===selected)draw(d.chat)};socket.onclose=()=>status('Event connection closed; reconnect to resume live updates')}
async function list(){const d=await api('/api/chats?limit=100');el('chats').replaceChildren();for(const c of d.items){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;el('chats').append(o)}if(selected)el('chats').value=selected;if(!el('chats').value&&d.items.length)el('chats').value=d.items[0].id;await choose()}
el('connect').onclick=async()=>{token=el('token').value;try{await list()}catch(e){status(e.message)}};
el('refresh').onclick=()=>list().catch(e=>status(e.message));el('chats').onchange=()=>choose().catch(e=>status(e.message));
el('send').onclick=async()=>{if(!selected||!el('content').value.trim())return;el('send').disabled=true;try{await api('/api/chats/'+encodeURIComponent(selected)+'/messages',{method:'POST',body:JSON.stringify({content:el('content').value})});el('content').value='';status('Submitted to the desktop chat pipeline')}catch(e){status(e.message)}finally{el('send').disabled=false}};
</script></html>`
