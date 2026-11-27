/* ===================== PRODUCT DATA ===================== */
// [series, name, pack, mrp, scheme]
const BASE = [
["Series 1","S1",240,10,.20],["Series 1","M1",240,12,.20],["Series 1","L1",240,14,.20],
["Series 2","S2",128,20,.12],["Series 2","M2",128,22,.12],["Series 2","L2",128,26,.12],["Series 2","XS 2",128,18,.12],["Series 2","XL2",128,34,.13],
["Series 5","S5",24,45,.08],["Series 5","M5",24,56,.08],["Series 5","L5",24,65,.08],["Series 5","XL5",24,84,.08],
["₹80 MRP Series","S10",24,80,.15],["₹80 MRP Series","M8",24,80,.15],["₹80 MRP Series","L7",24,80,.15],["₹80 MRP Series","XS10",24,80,.15],
["₹185 MRP Series","XS22",8,185,.14],["₹185 MRP Series","S22",8,185,.14],["₹185 MRP Series","M16",8,185,.14],["₹185 MRP Series","L14",8,185,.14],["₹185 MRP Series","XL13",8,185,.14],
["6 Pack Series","NB 36",6,325,.21],["6 Pack Series","S40",6,374,.21],["6 Pack Series","M32",6,374,.21],["6 Pack Series","L30",6,374,.21],["6 Pack Series","XL24",6,374,.21],
["4 Pack Economy","XXL24",4,599,.18],["4 Pack Economy","S64",4,560,.21],["4 Pack Economy","M52",4,560,.21],["4 Pack Economy","L46",4,560,.21],["4 Pack Economy","XL38",4,560,.21],
["4 Pack Jumbo","NB60",4,655,.32],["4 Pack Jumbo","S52",4,655,.32],["4 Pack Jumbo","M42",4,655,.32],["4 Pack Jumbo","L38",4,655,.32],["4 Pack Jumbo","NB90",4,935,.32],["4 Pack Jumbo","S78",4,999,.32],["4 Pack Jumbo","M74",4,999,.32],["4 Pack Jumbo","L62",4,999,.32],["4 Pack Jumbo","XL54",4,999,.32]
];
const products = BASE.map((r,i)=>({id:i+1,group:r[0],name:r[1],pack:r[2],mrp:r[3],scheme:r[4],qty:0,customK:null}));

// Net rate in lakhs per case
function rateOf(p){
  if(p.customK!==null) return p.customK;
  return (p.mrp*p.pack/1.2/1.1*(1-p.scheme))/100000;
}

/* ===================== STORAGE ===================== */
const mem = {};
let storageOK = true;
function sGet(k,def){
  try{ const v=localStorage.getItem(k); return v===null?def:JSON.parse(v); }
  catch(e){ storageOK=false; return k in mem?mem[k]:def; }
}
function sSet(k,v){
  mem[k]=v;
  try{ localStorage.setItem(k,JSON.stringify(v)); return true; }
  catch(e){ storageOK=false; toast("⚠️ Could not save on this phone."); return false; }
}

/* ===================== STATE ===================== */
const KEEP=40*864e5;                       // orders live 40 days
const prune=a=>a.filter(o=>o.ts>Date.now()-KEEP);
/* ===== GITHUB DATA REPO: edit these two lines ===== */
const GH_REPO="helptreephilic/KC-OrderData";  // your PRIVATE data repository (owner/name)
const GH_TOKEN="";                              // leave empty (safer): each phone gets the access key once at login
let cfg=GH_TOKEN?{r:GH_REPO,t:GH_TOKEN}:(sGet("ora_key","")?{r:GH_REPO,t:sGet("ora_key","")}:null);
let store=sGet("ora_store",null)||{accounts:{users:{},towns:{}},prices:null,orders:{},pending:[],del:[],dirty:{},dirtyT:{}};
store.dirtyT=store.dirtyT||{};
let employee="", isAdmin=false, unlocked=false, expected=0, mode="login", showNet=false, curTab="order", curEmp="";
let histRange="today", empRange="all", emsRange="month", sumRange="month";
let sumEmp="", sumTown="", sumParty="";
let syncing=false, again=false, syncTimer=null, outFile=null, outText="";
const saveStore=()=>sSet("ora_store",store);

/* ===================== HELPERS ===================== */
const $ = id=>document.getElementById(id);
const rs = n=>"₹"+(n*100000).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad = n=>String(n).padStart(2,"0");
const dateStr = d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const cleanName = s=>s.trim().replace(/\s+/g," ");
function toast(m){
  const d=document.createElement("div");d.className="toast";d.textContent=m;document.body.appendChild(d);
  setTimeout(()=>d.remove(),3000);
}
// simple (non-cryptographic) hash - a deterrent only
function hsh(s,seed){
  let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;
  for(let i=0,c;i<s.length;i++){c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}
const H = s=>hsh(s,1)+hsh(s,2);
const ADMIN_USER="yash9090", ADMIN_H="1jim9o5td0j7nrob6r5za";
const mkAcct=(u,pw)=>{const s=Math.random().toString(36).slice(2);return{s,h:H(s+"|"+u+"|"+pw)};};

/* ===================== DATE RANGES ===================== */
// Month cycle = 21st of previous month .. 20th of this month.
// TDP (ten day plan) = 21st-month end, 1st-10th, 11th-20th (the current one).
function rangeOf(r){
  const n=new Date(),y=n.getFullYear(),m=n.getMonth(),d=n.getDate();
  if(r==="today")return[new Date(y,m,d),new Date(y,m,d+1)];
  if(r==="month"){const s=d>=21?new Date(y,m,21):new Date(y,m-1,21);return[s,new Date(s.getFullYear(),s.getMonth()+1,21)];}
  if(r==="tdp"){
    if(d>=21)return[new Date(y,m,21),new Date(y,m+1,1)];
    if(d<=10)return[new Date(y,m,1),new Date(y,m,11)];
    return[new Date(y,m,11),new Date(y,m,21)];
  }
  return null;
}
function inRange(o,r){const g=rangeOf(r);return !g||(o.ts>=g[0].getTime()&&o.ts<g[1].getTime());}
function rangeLabel(r){
  const g=rangeOf(r),f=x=>x.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
  if(!g)return "All saved orders (last 40 days)";
  return r==="today"?f(g[0]):f(g[0])+" – "+f(new Date(g[1].getTime()-864e5));
}
function mountChips(id,get,set,render){
  const box=$(id),R=[["today","Today"],["tdp","TDP"],["month","Month 21–20"],["all","All"]];
  box.redraw=()=>{box.innerHTML=R.map(x=>`<button data-r="${x[0]}" class="${get()===x[0]?"on":""}">${x[1]}</button>`).join("")+`<div class="mu">${rangeLabel(get())}</div>`;};
  box.onclick=e=>{const b=e.target.closest("button");if(!b)return;set(b.dataset.r);box.redraw();render();};
  box.redraw();
}

/* ===================== PRICES ===================== */
function savePrices(){
  const m={};
  products.forEach(p=>m[p.id]={pack:p.pack,mrp:p.mrp,scheme:p.scheme,customK:p.customK,
    ...(p.custom?{custom:true,name:p.name,group:p.group}:{})});
  store.prices=m;store.dirty.prc=true;saveStore();syncSoon();
}
function sortProducts(){            // keeps each series together, new series go to the end
  const order=[];products.forEach(p=>{if(!order.includes(p.group))order.push(p.group);});
  const idx=new Map(products.map((p,i)=>[p,i]));
  products.sort((a,b)=>order.indexOf(a.group)-order.indexOf(b.group)||idx.get(a)-idx.get(b));
}
function applyPrices(){
  const m=store.prices;if(!m)return;
  for(let i=products.length-1;i>=0;i--)          // products removed by the admin disappear everywhere
    if(products[i].custom&&!(String(products[i].id) in m))products.splice(i,1);
  Object.keys(m).forEach(k=>{
    const v=m[k],id=+k;let p=products.find(x=>x.id===id);
    if(!p&&v.custom){p={id,group:v.group,name:v.name,pack:v.pack,mrp:v.mrp,scheme:v.scheme,qty:0,customK:null,custom:true};products.push(p);}
    if(p)Object.assign(p,{pack:v.pack,mrp:v.mrp,scheme:v.scheme,customK:v.customK});
  });
  sortProducts();
}

/* ===================== GITHUB SYNC ===================== */
const hdr=()=>({Authorization:"Bearer "+cfg.t,Accept:"application/vnd.github+json"});
const url=p=>`https://api.github.com/repos/${cfg.r}/contents/${p}`;
async function ghGet(path){
  const r=await fetch(url(path),{headers:hdr(),cache:"no-store"});
  if(r.status===404)return null;
  if(!r.ok)throw new Error("GitHub error "+r.status);
  const j=await r.json();
  return{sha:j.sha,data:JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g,"")))))};
}
async function ghPut(path,data,sha){
  const body={message:"sync "+path,content:btoa(unescape(encodeURIComponent(JSON.stringify(data))))};
  if(sha)body.sha=sha;
  const r=await fetch(url(path),{method:"PUT",headers:{...hdr(),"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(r.status===409||r.status===422)throw new Error("conflict");
  if(!r.ok)throw new Error("GitHub error "+r.status);
}
// read-modify-write with retry; fn(remote|null) returns the new content
async function ghUpdate(path,fn){
  for(let i=0;i<3;i++){
    const cur=await ghGet(path),nd=fn(cur?cur.data:null);
    try{await ghPut(path,nd,cur&&cur.sha);return nd;}
    catch(e){if(e.message!=="conflict"||i===2)throw e;}
  }
}
async function refreshAccounts(){
  try{const r=await ghGet("accounts.json");if(r){store.accounts=r.data;saveStore();return "ok";}return "missing";}
  catch(e){return e.message;}
}
const syncSoon=()=>{clearTimeout(syncTimer);syncTimer=setTimeout(sync,4000);};
function setSync(m){$("syncInfo").textContent=m;if(curTab==="set")renderSettings();}
const waiting=()=>store.pending.length+store.del.length+(store.dirty.acc?1:0)+(store.dirty.prc?1:0)+Object.keys(store.dirtyT).length;

async function sync(){
  if(!employee)return;
  if(syncing){again=true;return;}
  if(!cfg){setSync("⚠️ Access key needed");return;}
  if(cfg.r.startsWith("YOUR-")){setSync("⚠️ Set GH_REPO in app.js");return;}
  if(!navigator.onLine){setSync("📴 Offline · "+waiting()+" waiting");return;}
  syncing=true;setSync("⏳ Syncing...");
  try{
    const beforePrices=JSON.stringify(store.prices);
    // 1. pull accounts + prices (admin keeps his own copy if it has unsent changes)
    if(!(isAdmin&&store.dirty.acc)){const r=await ghGet("accounts.json");if(r)store.accounts=r.data;else if(isAdmin)store.dirty.acc=true;}
    if(!(isAdmin&&store.dirty.prc)){const r=await ghGet("prices.json");if(r)store.prices=r.data;else if(isAdmin&&store.prices)store.dirty.prc=true;}
    // 2. admin pushes accounts / prices
    if(isAdmin&&store.dirty.acc){await ghUpdate("accounts.json",()=>store.accounts);delete store.dirty.acc;}
    if(isAdmin&&store.dirty.prc){await ghUpdate("prices.json",()=>store.prices||{});delete store.dirty.prc;}
    for(const ow of Object.keys(store.dirtyT)){await ghUpdate("towns/"+ow+".json",()=>store.towns[ow]||{});delete store.dirtyT[ow];}
    // 3. push new / deleted orders
    const owners=[...new Set([...store.pending.map(x=>x.owner),...store.del.map(x=>x.owner)])];
    for(const ow of owners){
      const pend=store.pending.filter(x=>x.owner===ow).map(x=>x.id),dels=store.del.filter(x=>x.owner===ow).map(x=>x.id);
      const mine=(store.orders[ow]||[]).filter(o=>pend.includes(o.id));
      const res=await ghUpdate("orders/"+ow+".json",rem=>{
        const m={};(rem||[]).forEach(o=>m[o.id]=o);mine.forEach(o=>m[o.id]=o);dels.forEach(id=>delete m[id]);
        return prune(Object.values(m));
      });
      store.orders[ow]=res.sort((a,b)=>b.ts-a.ts);
      store.pending=store.pending.filter(x=>!(x.owner===ow&&pend.includes(x.id)));
      store.del=store.del.filter(x=>!(x.owner===ow&&dels.includes(x.id)));
      saveStore();
    }
    // 4. pull orders (admin: everyone, employee: own)
    const who=isAdmin?[ADMIN_USER,...Object.keys(store.accounts.users||{})]:[employee];
    for(const ow of who){
      if(!store.dirtyT[ow]){const t=await ghGet("towns/"+ow+".json");if(t)store.towns[ow]=t.data;else if(Object.keys(townsMap(ow)).length)store.dirtyT[ow]=true;}
      const r=await ghGet("orders/"+ow+".json");
      if(r)store.orders[ow]=prune(r.data).sort((a,b)=>b.ts-a.ts);
    }
    saveStore();
    if(JSON.stringify(store.prices)!==beforePrices){applyPrices();renderList();}
    setSync("✅ Synced "+new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
    refresh();
  }catch(e){
    setSync("⚠️ "+e.message+" · "+waiting()+" waiting");
    clearTimeout(syncTimer);syncTimer=setTimeout(sync,30000);   // retry automatically
  }
  syncing=false;
  if(again){again=false;sync();}                               // something changed while syncing
}
function refresh(){
  if(curTab==="emps")renderEmps();
  else if(curTab==="emp")renderEmp();
  else if(curTab==="hist")renderHistory();
  else if(curTab==="sum")renderSummary();
  else if(curTab==="order"){renderOrdFor();renderTP();}
}

/* ===================== SCOPES ===================== */
const scope=()=>isAdmin
  ?Object.entries(store.orders).flatMap(([k,a])=>a.map(o=>(o.owner=k,o))).sort((a,b)=>b.ts-a.ts)
  :(store.orders[employee]||[]).map(o=>(o.owner=employee,o));
const histList=()=>scope().filter(o=>inRange(o,histRange));
const empList_=()=>(store.orders[curEmp]||[]).map(o=>(o.owner=curEmp,o)).filter(o=>inRange(o,empRange));

/* ===================== TOWNS & PARTIES ===================== */
function townsMap(ow){store.towns=store.towns||{};return store.towns[ow]=store.towns[ow]||{};}
function touchTowns(ow){store.dirtyT[ow]=true;saveStore();renderTownsAll();renderTP();syncSoon();}
function touchAcc(){store.dirty.acc=true;saveStore();renderTownsAll();renderOrdFor();renderTP();syncSoon();}
function addTown(ow){
  const n=cleanName(prompt("Town name:")||"");if(!n)return;
  const t=townsMap(ow);
  if(Object.keys(t).some(k=>k.toLowerCase()===n.toLowerCase())){toast("Town already exists");return;}
  t[n]=[];touchTowns(ow);
}
function addPartyTo(ow,town){
  const n=cleanName(prompt("New party in "+town+":")||"");if(!n)return;
  const arr=townsMap(ow)[town];
  if(arr.some(p=>p.toLowerCase()===n.toLowerCase())){toast("Party already added");return;}
  arr.push(n);touchTowns(ow);
}
function townsHtml(ow){
  const t=townsMap(ow),names=Object.keys(t).sort();
  return names.length?names.map(n=>`<div class="panel" style="padding:10px">
    <div class="row"><b>📍 ${esc(n)}</b><span><button class="btn sm l" style="margin:0" data-ap="${esc(n)}">+ Party</button> <button class="x" data-dt="${esc(n)}">✕</button></span></div>
    ${t[n].map(p=>`<div class="row"><span>🏪 ${esc(p)}</span><button class="x" data-dp="${esc(n)}" data-pp="${esc(p)}">✕</button></div>`).join("")||'<p class="mu">No parties yet.</p>'}</div>`).join(""):'<p class="mu">No towns yet.</p>';
}
function renderTownsAll(){
  if(!employee)return;
  if(isAdmin&&curEmp)$("townList").innerHTML=townsHtml(curEmp);
  $("myTownList").innerHTML=townsHtml(employee);
}
function townClick(getOwner){
  return e=>{
    const d=e.target.dataset,ow=getOwner();if(!ow)return;
    if(d.ap)addPartyTo(ow,d.ap);
    else if(d.dt){if(confirm(`Remove town "${d.dt}" and its parties?`)){delete townsMap(ow)[d.dt];touchTowns(ow);}}
    else if(d.dp){const a=townsMap(ow)[d.dp];a.splice(a.indexOf(d.pp),1);touchTowns(ow);}
  };
}

/* ===================== ORDER TAB ===================== */
const curOwner=()=>isAdmin?($("ordFor").value||ADMIN_USER):employee;
function lev(a,b){
  const m=[];
  for(let i=0;i<=a.length;i++)m[i]=[i];
  for(let j=1;j<=b.length;j++)m[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
    m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return m[a.length][b.length];
}
function closest(name,list){
  const k=name.toLowerCase();let best=null,bd=99;
  list.forEach(p=>{const d=lev(k,p.toLowerCase());if(d<bd){bd=d;best=p;}});
  return(best&&bd>0&&bd<=Math.max(2,Math.floor(k.length*.3)))?best:null;
}
// returns the final name (existing, corrected or new), or null if empty
function resolveName(raw,list,label){
  const n=cleanName(raw);
  if(!n){toast("Enter the "+label);return null;}
  const ex=list.find(p=>p.toLowerCase()===n.toLowerCase());
  if(ex)return ex;
  const s=closest(n,list);
  if(s&&confirm(`Did you mean "${s}"?\n\nOK = use "${s}"\nCancel = add "${n}" as a new ${label}`))return s;
  return n;
}
function renderOrdFor(){
  if(!isAdmin)return;
  const sel=$("ordFor"),cur=sel.value;
  sel.innerHTML=`<option value="${ADMIN_USER}">Myself (${ADMIN_USER})</option>`+Object.keys(store.accounts.users||{}).sort().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  if(cur&&[...sel.options].some(o=>o.value===cur))sel.value=cur;
}
function renderTP(){
  const names=Object.keys(townsMap(curOwner())).sort();
  $("townOpts").innerHTML=names.map(n=>`<option value="${esc(n)}">`).join("");
  renderParty();
}
function renderParty(){
  const t=townsMap(curOwner()),k=Object.keys(t).find(x=>x.toLowerCase()===cleanName($("town").value).toLowerCase());
  $("partyOpts").innerHTML=(k?t[k].slice().sort():[]).map(n=>`<option value="${esc(n)}">`).join("");
}
function renderList(){
  const q=$("search").value.trim().toLowerCase();
  let html="",last=null;
  products.forEach(p=>{
    if(q && !p.name.toLowerCase().includes(q) && !p.group.toLowerCase().includes(q)) return;
    if(p.group!==last){last=p.group;html+=`<div class="grp">${esc(p.group)}</div>`;}
    html+=`<div class="item ${p.qty>0?"act":""}" id="r${p.id}">
      <div class="n"><b>${esc(p.name)}</b>
        ${showNet?`<div>Net Rate: <span class="rate">${rateOf(p).toFixed(6)}</span></div>`:""}</div>
      <input class="q" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="${p.qty||""}" data-id="${p.id}">
      <div class="tot" id="t${p.id}">${(p.qty*rateOf(p)).toFixed(6)}</div></div>`;
  });
  $("list").innerHTML=html||'<p class="mu">No products found.</p>';
  updateSummary();
}
function setQty(id,val){
  const p=products.find(x=>x.id===id),n=parseFloat(val);
  p.qty=(isNaN(n)||n<0)?0:n;
  const row=$("r"+id);
  if(row){row.classList.toggle("act",p.qty>0);$("t"+id).textContent=(p.qty*rateOf(p)).toFixed(6);}
  updateSummary();
}
function updateSummary(){
  let sku=0,qty=0,total=0;const series={},items=[];
  products.forEach(p=>{
    if(p.qty>0){
      const t=p.qty*rateOf(p);
      sku++;qty+=p.qty;total+=t;
      series[p.group]=(series[p.group]||0)+t;
      items.push([p.name,p.qty,t]);
    }
  });
  $("barTotal").textContent=rs(total);
  $("barSub").textContent=`${sku} items · ${qty} qty · tap for details`;
  $("btnSave").disabled=sku===0;
  $("sLakhs").textContent=total.toFixed(6);
  $("sRs").textContent=rs(total);
  const sk=Object.keys(series);
  $("sSeries").innerHTML=sk.length?sk.map(g=>`<div class="row"><span>${esc(g)}</span><b>${series[g].toFixed(5)}</b></div>`).join(""):'<p class="mu">No orders placed yet...</p>';
  $("sItems").innerHTML=items.length?items.map(i=>`<div class="row"><span>${esc(i[0])} × ${i[1]}</span><b>${i[2].toFixed(5)}</b></div>`).join(""):'<p class="mu">Enter quantities...</p>';
}
function saveOrder(){
  const ow=curOwner(),tm=townsMap(ow);
  const town=resolveName($("town").value,Object.keys(tm),"town");if(!town)return;
  const party=resolveName($("party").value,tm[town]||[],"party");if(!party)return;
  const lines=[];let total=0,qty=0;
  products.forEach(p=>{
    if(p.qty>0){
      const r=rateOf(p),t=p.qty*r;
      lines.push({series:p.group,name:p.name,qty:p.qty,rate:r,total:t}); // price snapshot
      total+=t;qty+=p.qty;
    }
  });
  if(!lines.length)return;
  const now=new Date();
  const order={id:"O"+now.getTime().toString(36)+Math.random().toString(36).slice(2,5),ts:now.getTime(),owner:ow,employee:ow,by:employee,town,party,lines,qty,total};
  (store.orders[ow]=store.orders[ow]||[]).unshift(order);
  store.pending.push({owner:ow,id:order.id});
  let ch=false;                                   // new town / party typed on the order page is added to the data
  if(!tm[town]){tm[town]=[];ch=true;}
  if(!tm[town].includes(party)){tm[town].push(party);ch=true;}
  if(ch)store.dirtyT[ow]=true;
  saveStore();
  products.forEach(p=>p.qty=0);
  $("party").value="";$("sheet").classList.add("hide");
  renderList();renderTP();renderTownsAll();toast("✅ Order saved");
  sync();
}

/* ===================== ORDER LISTS ===================== */
function ordersHtml(list){
  if(!list.length)return '<p class="mu c">No orders in this period.</p>';
  return list.map(o=>{
    const d=new Date(o.ts),ser={};
    o.lines.forEach(l=>ser[l.series]=(ser[l.series]||0)+l.total);
    return `<details class="panel"><summary class="oh">
      <div>${d.toLocaleDateString("en-IN")} ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}<br>
      <span>${o.town?"📍 "+esc(o.town)+" · ":""}${o.party?"🏪 "+esc(o.party)+" · ":""}${esc(o.employee||"")}${o.by&&o.by!==o.employee?" (by "+esc(o.by)+")":""} · ${o.qty} qty</span></div>
      <div>${rs(o.total)}</div></summary>
      <div class="dt"><h4>SERIES BREAKDOWN</h4>
      ${Object.keys(ser).map(g=>`<div class="row"><span>${esc(g)}</span><b>${ser[g].toFixed(5)}</b></div>`).join("")}
      <h4>ITEMS</h4>
      ${o.lines.map(l=>`<div class="row"><span>${esc(l.name)} × ${l.qty}${isAdmin&&l.rate?` @ ${l.rate.toFixed(6)}`:""}</span><b>${l.total.toFixed(5)}</b></div>`).join("")}
      <div class="row"><span><b style="font-family:inherit">Total</b></span><b>${o.total.toFixed(6)}</b></div>
      ${isAdmin?`<button class="btn r sm" data-del="${o.id}" data-own="${esc(o.owner||o.employee||"")}">Delete this order</button>`:""}</div></details>`;
  }).join("");
}
function fill(p,list){
  $(p+"Count").textContent=list.length;
  $(p+"Qty").textContent=list.reduce((a,o)=>a+o.qty,0);
  $(p+"Amt").textContent=rs(list.reduce((a,o)=>a+o.total,0));
}
function renderHistory(){const l=histList();fill("h",l);$("orders").innerHTML=ordersHtml(l);}
function renderEmp(){const l=empList_();fill("e",l);$("empOrders").innerHTML=ordersHtml(l);renderTownsAll();}
function delOrder(id,ow){
  if(!isAdmin||!confirm("Delete this order permanently (for everyone)?"))return;
  store.orders[ow]=(store.orders[ow]||[]).filter(o=>o.id!==id);
  store.pending=store.pending.filter(x=>x.id!==id);
  store.del.push({owner:ow,id});saveStore();refresh();sync();
}

/* ===================== SUMMARY (employee > town > party > orders) ===================== */
function renderSummary(){
  const nm=v=>v||"(none)";
  let list=scope().filter(o=>inRange(o,sumRange));
  if(sumEmp)list=list.filter(o=>o.employee===sumEmp);
  if(sumTown)list=list.filter(o=>nm(o.town)===sumTown);
  if(sumParty)list=list.filter(o=>nm(o.party)===sumParty);
  const level=(isAdmin&&!sumEmp)?"employee":!sumTown?"town":!sumParty?"party":"orders";
  fill("u",list);
  $("uPath").textContent=[isAdmin?(sumEmp||"All employees"):"",sumTown,sumParty].filter(Boolean).join(" › ")||"All towns";
  $("btnUBack").classList.toggle("hide",level==="employee"||(!isAdmin&&level==="town"));
  if(level==="orders"){$("uList").innerHTML=ordersHtml(list);return;}
  const g={};
  list.forEach(o=>{const k=nm(o[level]),x=g[k]||(g[k]={n:0,q:0,t:0});x.n++;x.q+=o.qty;x.t+=o.total;});
  const ks=Object.keys(g).sort(),ic={employee:"👤",town:"📍",party:"🏪"}[level];
  $("uList").innerHTML=ks.length?ks.map(k=>`<div class="item emp" data-k="${esc(k)}" data-lv="${level}"><div class="n"><b>${ic} ${esc(k)}</b><div>${g[k].n} orders · ${g[k].q} qty</div></div><div class="tot">${rs(g[k].t)}</div></div>`).join(""):'<p class="mu c">No orders in this period.</p>';
}

/* ===================== CSV EXPORT / SHARE ===================== */
function buildCsv(list){
  const head=["OrderID","Date","Time","Employee","Town","Party","Series","Product","Qty",...(isAdmin?["Net Rate (Lakh)"]:[]),"Total (Lakh)","Total (Rs)"];
  const rows=[head];
  list.slice().sort((a,b)=>a.ts-b.ts).forEach(o=>{
    const d=new Date(o.ts);
    o.lines.forEach(l=>rows.push([o.id,dateStr(d),pad(d.getHours())+":"+pad(d.getMinutes()),o.employee||"",o.town||"",o.party||"",l.series,l.name,l.qty,...(isAdmin?[l.rate.toFixed(6)]:[]),l.total.toFixed(6),(l.total*100000).toFixed(2)]));
  });
  return rowsToCsv(rows);
}
function rowsToCsv(rows){
  const cell=v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  return "\uFEFF"+rows.map(r=>r.map(cell).join(",")).join("\r\n");
}
const makeFile=(text,name)=>new File([text],name,{type:"text/csv"});
function csvPack(list,tag){
  if(!list.length){toast("No orders to export");return null;}
  const t=buildCsv(list);return{f:makeFile(t,`${tag}_${dateStr(new Date())}.csv`),t};
}
function totalsPack(){
  const g=rangeOf(emsRange),names=Object.keys(store.accounts.users||{}).sort(),all=scope();
  const rows=[["Employee","Orders","Qty","Total (Lakh)","Total (Rs)"]];let n=0,q=0,t=0;
  names.concat(all.some(o=>o.employee===ADMIN_USER)?[ADMIN_USER]:[]).forEach(e=>{
    const l=all.filter(o=>o.employee===e&&inRange(o,emsRange));
    const a=l.length,b=l.reduce((x,o)=>x+o.qty,0),c=l.reduce((x,o)=>x+o.total,0);
    n+=a;q+=b;t+=c;rows.push([e,a,b,c.toFixed(6),(c*100000).toFixed(2)]);
  });
  rows.push(["TOTAL",n,q,t.toFixed(6),(t*100000).toFixed(2)]);
  const txt=rowsToCsv(rows);
  return{f:makeFile(txt,`employee_totals_${emsRange}_${dateStr(new Date())}.csv`),t:txt};
}
function openOut(p){
  if(!p)return;
  outFile=p.f;outText=p.t;
  $("outTitle").textContent=p.f.name;$("outText").value=p.t;$("out").classList.remove("hide");
}
function download(file,text){
  try{
    const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
  }catch(e){
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(text);a.download=file.name;
    document.body.appendChild(a);a.click();a.remove();
  }
}
async function shareFile(p){
  if(!p)return;
  try{if(navigator.canShare&&navigator.canShare({files:[p.f]})){await navigator.share({files:[p.f],title:p.f.name});return;}}
  catch(e){if(e&&e.name==="AbortError")return;}
  try{if(navigator.share){await navigator.share({title:p.f.name,text:p.t});return;}}
  catch(e){if(e&&e.name==="AbortError")return;}
  openOut(p);
  toast("Sharing not available here. Use Copy or Download.");
}
async function copyText(t){
  try{await navigator.clipboard.writeText(t);}
  catch(e){const x=$("outText");x.removeAttribute("readonly");x.select();document.execCommand("copy");x.setAttribute("readonly","");}
  toast("Copied");
}

/* ===================== CSV IMPORT (admin, per employee) ===================== */
function parseCsv(t){
  t=t.replace(/^\uFEFF/,"");
  const rows=[];let r=[],c="",q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch==='"'){ if(t[i+1]==='"'){c+='"';i++;} else q=false; } else c+=ch; }
    else if(ch==='"')q=true;
    else if(ch===","){r.push(c);c="";}
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&t[i+1]==="\n")i++; r.push(c);c="";rows.push(r);r=[]; }
    else c+=ch;
  }
  if(c!==""||r.length){r.push(c);rows.push(r);}
  return rows.filter(x=>x.some(v=>v!==""));
}
function ordersFromRows(rows){
  const h=rows[0].map(x=>x.trim().toLowerCase()),ix=n=>h.indexOf(n);
  const c={id:ix("orderid"),d:ix("date"),t:ix("time"),e:ix("employee"),w:ix("town"),p:ix("party"),s:ix("series"),n:ix("product"),q:ix("qty"),l:ix("total (lakh)")};
  if(c.id<0||c.n<0||c.q<0||c.l<0)return null;
  const m={};
  rows.slice(1).forEach(r=>{
    const id=r[c.id];if(!id)return;
    const o=m[id]||(m[id]={id,ts:new Date((r[c.d]||"")+"T"+(r[c.t]||"00:00")).getTime()||Date.now(),
      employee:c.e>=0?r[c.e]:"",town:c.w>=0?r[c.w]:"",party:c.p>=0?r[c.p]:"",lines:[],qty:0,total:0});
    const q=parseFloat(r[c.q])||0,t=parseFloat(r[c.l])||0;
    o.lines.push({series:c.s>=0?r[c.s]:"",name:r[c.n],qty:q,rate:q?t/q:0,total:t});
    o.qty+=q;o.total+=t;
  });
  return Object.values(m);
}
function importText(text){
  const rows=parseCsv(text),list=rows.length?ordersFromRows(rows):null;
  if(!list||!list.length){toast("❌ Not a valid order CSV");return false;}
  const odd=list.filter(o=>o.employee&&o.employee.toLowerCase()!==curEmp.toLowerCase()).length;
  if(odd&&!confirm(`${odd} order(s) in this file belong to a different employee name.\nAdd them to "${curEmp}" anyway?`))return false;
  const arr=store.orders[curEmp]=store.orders[curEmp]||[],have=new Set(arr.map(o=>o.id));let add=0;
  list.forEach(o=>{
    if(!have.has(o.id)){o.owner=curEmp;o.employee=curEmp;o.by=employee;arr.push(o);store.pending.push({owner:curEmp,id:o.id});add++;}
  });
  arr.sort((a,b)=>b.ts-a.ts);saveStore();renderEmp();sync();
  toast(`Added ${add} orders, skipped ${list.length-add} duplicates`);
  return true;
}
function importFile(file){
  if(/\.xlsx?$/i.test(file.name)){
    alert("Excel files (.xlsx) are not supported yet.\n\nOpen the file in Excel and use Save As > CSV, or paste the CSV text instead.");
    return;
  }
  const r=new FileReader();
  r.onload=()=>{$("impText").value=String(r.result);if(importText(String(r.result)))$("imp").classList.add("hide");};
  r.onerror=()=>toast("Could not read that file. Paste the CSV text instead.");
  r.readAsText(file);
}

/* ===================== EMPLOYEES (admin) ===================== */
function renderEmps(){
  const names=Object.keys(store.accounts.users||{}).sort(),all=scope();
  $("empList").innerHTML=names.length?names.map(n=>{
    const l=all.filter(o=>o.employee===n&&inRange(o,emsRange)),t=l.reduce((a,o)=>a+o.total,0);
    const last=l.length?new Date(Math.max(...l.map(o=>o.ts))).toLocaleDateString("en-IN"):"no orders";
    return `<div class="item emp" data-emp="${esc(n)}"><div class="n"><b>👤 ${esc(n)}</b><div>${l.length} orders · last: ${last}</div></div><div class="tot">${rs(t)}</div></div>`;
  }).join(""):'<p class="mu c">No employees yet. Tap "+ Add employee".</p>';
}
function addEmployee(){
  const u=cleanName(prompt("New employee username (letters/numbers, 3-20):")||"").toLowerCase();
  if(!u)return;
  if(!/^[a-z0-9_.]{3,20}$/.test(u)){toast("Username: 3-20 letters or numbers");return;}
  if(u===ADMIN_USER||(store.accounts.users||{})[u]){toast("That username is taken");return;}
  const pw=prompt("Set a password for "+u+" (4+ characters):")||"";
  if(pw.length<4){toast("Password needs 4+ characters");return;}
  store.accounts.users=store.accounts.users||{};
  store.accounts.users[u]=mkAcct(u,pw);townsMap(u);
  touchAcc();renderEmps();
  alert(`Account created.\n\nUsername: ${u}\nPassword: ${pw}\n\nGive these to the employee personally. Now add their towns and parties.`);
  openEmp(u);
}
function openEmp(name){
  curEmp=name;empRange="all";
  $("empName").textContent="👤 "+name;
  $("empChips").redraw();
  tab("emp");
}
function resetPw(){
  const pw=prompt("New password for "+curEmp+" (4+ characters):")||"";
  if(pw.length<4){if(pw)toast("Password needs 4+ characters");return;}
  store.accounts.users[curEmp]=mkAcct(curEmp,pw);touchAcc();
  alert("Password changed. Give it to "+curEmp+" personally.");
}
function removeEmp(){
  if(!confirm(`Remove ${curEmp}'s account? Their saved orders stay in the records.`))return;
  delete store.accounts.users[curEmp];touchAcc();tab("emps");
}

/* ===================== LOGIN ===================== */
function setMode(m){
  mode=m;const last=sGet("ora_last","");
  $("lUserWrap").classList.toggle("hide",m!=="login");
  $("lPassWrap").classList.toggle("hide",m==="code");
  $("lCodeWrap").classList.toggle("hide",m!=="code");
  $("lKeyWrap").classList.toggle("hide",m==="code"||!!cfg);$("lKey").value="";
  $("lTitle").textContent=m==="unlock"?"Welcome back, "+last:m==="code"?"Access key":"Log in";
  $("lGo").textContent=m==="code"?"Save code":m==="unlock"?"Unlock":"Log in";
  $("lErr").textContent="";$("lPass").value="";$("lCode").value="";
  $("lLink1").textContent=m==="code"?"Back to login":"Enter access key";
  $("lLink1").parentElement.classList.toggle("hide",!!GH_TOKEN||(!!cfg&&m!=="code"));
  $("lLink2").classList.toggle("hide",m!=="unlock");
}
function initLogin(){$("login").classList.remove("hide");setMode(sGet("ora_last","")?"unlock":"login");}
async function doLogin(){
  const err=m=>{$("lErr").textContent=m;};
  if(mode==="code"){
    const k=$("lCode").value.trim();if(k.length<20||/\s/.test(k))return err("That access key is not valid");
    sSet("ora_key",k);cfg={r:GH_REPO,t:k};toast("Saved. Now log in.");
    return setMode(sGet("ora_last","")?"unlock":"login");
  }
  const u=mode==="unlock"?sGet("ora_last",""):$("lUser").value.trim().toLowerCase();
  const pw=$("lPass").value;
  if(!u||!pw)return err("Enter username and password");
  const kv=$("lKey").value.trim();
  if(kv){if(kv.length<20||/\s/.test(kv))return err("That access key is not valid");sSet("ora_key",kv);cfg={r:GH_REPO,t:kv};}
  if(u===ADMIN_USER){
    if(H("ora|"+u+"|"+pw)!==ADMIN_H)return err("Wrong password");
    if(!cfg)return err("Enter the access key above so the app can save accounts to the data repo");
    return start(u,true);
  }
  if(!cfg)return err("First enter the access key from your admin");
  $("lGo").disabled=true;
  let why="ok";
  if(cfg.r.startsWith("YOUR-"))why="repo name not set in app.js";
  else if(navigator.onLine)why=await refreshAccounts();
  $("lGo").disabled=false;
  const a=(store.accounts.users||{})[u];
  if(!a){
    if(!navigator.onLine)return err("Offline. Connect to the internet for the first login.");
    if(why==="missing")return err("No accounts uploaded yet. Ask your admin to open the app while online, then try again.");
    if(why!=="ok"){$("lKeyWrap").classList.remove("hide");return err("Cannot reach the data repo ("+why+"). Re-enter the access key above, or check the repo name.");}
    return err("No such account. Ask your admin to create it.");
  }
  if(H(a.s+"|"+u+"|"+pw)!==a.h)return err("Wrong password");
  start(u,false);
}
function updateNav(){
  const vis={emps:isAdmin,order:true,hist:true,sum:true,back:isAdmin,set:true};
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("hide",!vis[b.dataset.t]));
}
function start(u,adm){
  employee=u;isAdmin=adm;showNet=false;unlocked=false;curEmp="";
  sumEmp=adm?"":u;sumTown="";sumParty="";
  sSet("ora_last",u);
  Object.keys(store.orders).forEach(k=>store.orders[k]=prune(store.orders[k]));
  if(!store.towns){            // first run of this version: move towns out of accounts.json
    store.towns={};const old=store.accounts.towns||{};
    Object.keys(old).forEach(o=>{if(adm||o===u){store.towns[o]=old[o];if(adm)store.dirtyT[o]=true;}});
    saveStore();
  }
  applyPrices();
  products.forEach(p=>p.qty=0);
  $("btnNet").textContent="Show Net Rate Bar";
  document.querySelectorAll(".adm").forEach(e=>e.classList.toggle("hide",!adm));
  $("btnOut").classList.remove("hide");$("login").classList.add("hide");
  showWho();updateNav();renderList();renderOrdFor();renderTP();
  tab(adm?"emps":"order");
  setSync(cfg?"":"⚠️ Not connected");
  sync();
}
function logout(){
  employee="";isAdmin=false;unlocked=false;showNet=false;curEmp="";
  products.forEach(p=>p.qty=0);
  document.querySelectorAll(".adm").forEach(e=>e.classList.add("hide"));
  $("btnOut").classList.add("hide");$("who").textContent="";$("syncInfo").textContent="";
  initLogin();
}
function showWho(){
  $("who").textContent=employee?((isAdmin?"👑 Admin: ":"👤 ")+employee):"";
  $("acctInfo").textContent=employee?`Logged in as ${employee} (${isAdmin?"Admin":"Employee"}).`:"";
}

/* ===================== ADMIN BACKEND (math check first) ===================== */
const stat = p=>p.customK!==null?`Manual rate · <a href="#" data-auto="${p.id}">Restore auto</a>`:"Auto-calculated";
function renderBack(){
  $("backList").innerHTML=products.map(p=>`<div class="panel"><b>${esc(p.name)}</b> <span class="mu">${esc(p.group)}</span>
    <div class="g4">${[["pack","PACK",1],["mrp","MRP ₹",.5],["scheme","Scheme",.01]].map(f=>`<div><label>${f[1]}</label><input class="in" type="number" inputmode="decimal" step="${f[2]}" min="0" value="${p[f[0]]}" data-id="${p.id}" data-f="${f[0]}"></div>`).join("")}
    <div><label>Net Rate (lakh)</label><input class="in" type="number" inputmode="decimal" step="0.000001" id="nk${p.id}" value="${rateOf(p).toFixed(6)}" data-id="${p.id}" data-f="net"></div></div>
    <div class="mu" id="nm${p.id}">${stat(p)}</div>
    ${p.custom?`<button class="btn r sm" data-rm="${p.id}">Remove product</button>`:""}</div>`).join("");
}

function renderSeriesOpts(){
  const sel=$("npSeries"),cur=sel.value,gs=[...new Set(products.map(p=>p.group))];
  sel.innerHTML=gs.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("")+'<option value="__new">➕ New series…</option>';
  if(cur&&[...sel.options].some(o=>o.value===cur))sel.value=cur;
  $("npSeriesNew").classList.toggle("hide",sel.value!=="__new");
}
function addProduct(){
  const name=cleanName($("npName").value);
  let group=$("npSeries").value;if(group==="__new")group=cleanName($("npSeriesNew").value);
  const pack=parseFloat($("npPack").value),mrp=parseFloat($("npMrp").value);
  let sc=parseFloat($("npScheme").value);if(isNaN(sc))sc=0;if(sc>1)sc=sc/100;   // 20 or 0.20 both work
  const netTxt=$("npNet").value.trim(),net=netTxt===""?null:parseFloat(netTxt);
  if(!name||!group){toast("Enter the product name and the series");return;}
  if(!(pack>0)||!(mrp>0)){toast("Enter PACK and MRP");return;}
  if(sc<0||sc>=1){toast("Scheme must be between 0 and 1 (or 1-99 %)");return;}
  if(net!==null&&!(net>=0)){toast("Net rate is not a valid number");return;}
  if(products.some(p=>p.group===group&&p.name.toLowerCase()===name.toLowerCase())){toast("That product already exists in this series");return;}
  if(!confirm(`Add "${name}" to "${group}"?`))return;
  products.push({id:Date.now(),group,name,pack,mrp,scheme:sc,qty:0,customK:net,custom:true});
  sortProducts();savePrices();
  ["npName","npPack","npMrp","npScheme","npNet","npSeriesNew"].forEach(i=>$(i).value="");
  renderBack();renderSeriesOpts();renderList();toast("✅ Product added");
}

/* ===================== SETTINGS ===================== */
function renderChecks(){
  const ok=b=>b?"✅":"❌";
  const items=[["Storage (saving orders)",storageOK],["Online",navigator.onLine],["GitHub connected",!!cfg],["Share button",!!navigator.share]];
  $("checks").innerHTML=items.map(i=>`<div class="row"><span>${i[0]}</span><b>${ok(i[1])}</b></div>`).join("")+
    `<div class="row"><span>Waiting to upload</span><b>${waiting()}</b></div>`;
}
function renderSettings(){
  showWho();renderChecks();renderTownsAll();
  $("syncLine").textContent=($("syncInfo").textContent||"Not synced yet")+" · Syncs automatically · Orders are kept for 40 days.";
}

/* ===================== TABS ===================== */
function tab(t){
  if(t==="back"&&!isAdmin)return;
  if(t==="back"&&!unlocked){
    if(!confirm("Open Backend? Changes here change prices for everyone."))return;
    unlocked=true;
  }
  if(t!=="back")unlocked=false;
  curTab=t;
  ["emps","emp","order","hist","sum","back","set"].forEach(x=>$("tab-"+x).classList.toggle("hide",x!==t));
  const navKey=t==="emp"?"emps":t;
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.t===navKey));
  ["chips","empChips","emsChips","sChips"].forEach(i=>$(i).redraw&&$(i).redraw());
  $("bar").classList.toggle("hide",t!=="order");
  $("sheet").classList.add("hide");
  if(t==="emps")renderEmps();
  if(t==="emp")renderEmp();
  if(t==="order"){renderOrdFor();renderTP();}
  if(t==="hist")renderHistory();
  if(t==="sum")renderSummary();
  if(t==="back"){renderBack();renderSeriesOpts();}
  if(t==="set")renderSettings();
  window.scrollTo(0,0);
}

/* ===================== THEME ===================== */
const THEMES={huggies:"#da291c",minimal:"#0f172a",dark:"#171b22"};
function applyTheme(t){
  if(!THEMES[t])t="huggies";
  document.documentElement.dataset.theme=t;
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=THEMES[t];
  return t;
}

/* ===================== EVENTS ===================== */
document.addEventListener("DOMContentLoaded",()=>{
  const th=applyTheme(sGet("ora_theme","huggies"));$("themeSel").value=th;
  $("themeSel").onchange=()=>{sSet("ora_theme",applyTheme($("themeSel").value));};
  applyPrices();initLogin();
  document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>tab(b.dataset.t));

  mountChips("chips",()=>histRange,r=>histRange=r,renderHistory);
  mountChips("empChips",()=>empRange,r=>empRange=r,renderEmp);
  mountChips("emsChips",()=>emsRange,r=>emsRange=r,renderEmps);
  mountChips("sChips",()=>sumRange,r=>sumRange=r,renderSummary);

  // login
  $("lGo").onclick=doLogin;
  $("login").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.tagName!=="TEXTAREA")doLogin();});
  $("lLink1").onclick=e=>{e.preventDefault();setMode(mode==="code"?(sGet("ora_last","")?"unlock":"login"):"code");};
  $("lLink2").onclick=e=>{e.preventDefault();setMode("login");};
  $("btnOut").onclick=logout;

  // order tab
  $("ordFor").onchange=()=>{$("town").value="";$("party").value="";renderTP();};
  $("town").oninput=renderParty;
  $("search").oninput=renderList;
  $("list").addEventListener("input",e=>{if(e.target.classList.contains("q"))setQty(+e.target.dataset.id,e.target.value);});
  $("barTap").onclick=()=>$("sheet").classList.toggle("hide");
  $("btnSheetClose").onclick=()=>$("sheet").classList.add("hide");
  $("btnClear").onclick=()=>{if(products.some(p=>p.qty>0)&&confirm("Clear all quantities?")){products.forEach(p=>p.qty=0);renderList();}};
  $("btnSave").onclick=saveOrder;

  // history + summary + delete
  $("btnCsv").onclick=()=>openOut(csvPack(histList(),"orders_"+histRange));
  $("btnShareCsv").onclick=()=>shareFile(csvPack(histList(),"orders_"+histRange));
  document.addEventListener("click",e=>{const id=e.target.dataset&&e.target.dataset.del;if(id)delOrder(id,e.target.dataset.own);});
  $("uList").onclick=e=>{
    const it=e.target.closest(".item");if(!it||!it.dataset.k)return;
    const k=it.dataset.k,lv=it.dataset.lv;
    if(lv==="employee")sumEmp=k;else if(lv==="town")sumTown=k;else sumParty=k;
    renderSummary();window.scrollTo(0,0);
  };
  $("btnUBack").onclick=()=>{
    if(sumParty)sumParty="";else if(sumTown)sumTown="";else if(isAdmin)sumEmp="";
    renderSummary();
  };

  // employees (admin)
  $("btnAddEmp").onclick=addEmployee;
  $("btnTotals").onclick=()=>openOut(totalsPack());
  $("btnTotalsShare").onclick=()=>shareFile(totalsPack());
  $("empList").onclick=e=>{const it=e.target.closest(".item");if(it&&it.dataset.emp)openEmp(it.dataset.emp);};
  $("btnEmpBack").onclick=()=>tab("emps");
  $("btnECsv").onclick=()=>openOut(csvPack(empList_(),curEmp+"_"+empRange));
  $("btnEShare").onclick=()=>shareFile(csvPack(empList_(),curEmp+"_"+empRange));
  $("btnAddTown").onclick=()=>addTown(curEmp);
  $("townList").onclick=townClick(()=>curEmp);
  $("btnAddMyTown").onclick=()=>addTown(employee);
  $("myTownList").onclick=townClick(()=>employee);
  $("btnResetPw").onclick=resetPw;
  $("btnRemoveEmp").onclick=removeEmp;

  // import modal
  $("btnImport").onclick=()=>{$("impText").value="";$("imp").classList.remove("hide");};
  $("impFile").onclick=()=>$("fileImport").click();
  $("fileImport").onchange=e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value="";};
  $("impGo").onclick=()=>{const t=$("impText").value.trim();if(!t){toast("Paste the CSV text or choose a file");return;}if(importText(t))$("imp").classList.add("hide");};
  $("impClose").onclick=()=>$("imp").classList.add("hide");

  // export modal
  $("outDl").onclick=()=>download(outFile,outText);
  $("outShare").onclick=()=>shareFile({f:outFile,t:outText});
  $("outCopy").onclick=()=>copyText(outText);
  $("outClose").onclick=()=>$("out").classList.add("hide");

  // backend (admin)
  $("backList").addEventListener("input",e=>{
    const f=e.target.dataset.f;if(!f||!isAdmin||!unlocked)return;
    const id=+e.target.dataset.id,p=products.find(x=>x.id===id),n=parseFloat(e.target.value);
    if(isNaN(n)||n<0)return;
    if(f==="net")p.customK=n;else p[f]=n;
    if(f!=="net"&&p.customK===null)$("nk"+id).value=rateOf(p).toFixed(6);
    $("nm"+id).innerHTML=stat(p);savePrices();
  });
  $("backList").addEventListener("click",e=>{
    if(!isAdmin||!unlocked)return;
    const id=e.target.dataset.auto,rm=e.target.dataset.rm;
    if(id){e.preventDefault();products.find(x=>x.id===+id).customK=null;savePrices();renderBack();}
    else if(rm&&confirm("Remove this product? Old orders keep their saved prices.")){
      products.splice(products.findIndex(x=>x.id===+rm),1);
      savePrices();renderBack();renderSeriesOpts();renderList();
    }
  });
  $("npSeries").onchange=()=>$("npSeriesNew").classList.toggle("hide",$("npSeries").value!=="__new");
  $("btnAddProduct").onclick=addProduct;

  // settings
  $("btnNet").onclick=()=>{
    showNet=!showNet;
    $("btnNet").textContent=showNet?"Hide Net Rate Bar":"Show Net Rate Bar";
    renderList();
  };

  window.addEventListener("online",()=>sync());
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync();});
  (function loop(){setTimeout(()=>{if(employee)sync();loop();},isAdmin?60000:120000);})();
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
});
