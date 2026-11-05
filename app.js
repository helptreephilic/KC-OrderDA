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
  catch(e){ storageOK=false; toast("⚠️ Could not save on this phone. Do a Backup!"); return false; }
}

/* ===================== STATE ===================== */
let orders=[], parties=[], empData={};
let employee="", isAdmin=false, orderMode=false, unlocked=false, expected=0;
let mode="login", showNet=false, histRange="today", empRange="all", curEmp="", curTab="order";

const saveOrders = ()=>sSet("ora_orders_"+employee,orders);
const saveParties = ()=>sSet("ora_parties_"+employee,parties);
const saveEmps = ()=>sSet("ora_emps",empData);
const users = ()=>sGet("ora_users",{});
function savePrices(){
  const m={};
  products.forEach(p=>m[p.id]={pack:p.pack,mrp:p.mrp,scheme:p.scheme,customK:p.customK});
  sSet("ora_prices",m);
}
function applyPrices(){
  const m=sGet("ora_prices",{});
  products.forEach(p=>{ if(m[p.id]) Object.assign(p,m[p.id]); });
}

/* ===================== HELPERS ===================== */
const $ = id=>document.getElementById(id);
const rs = n=>"₹"+(n*100000).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad = n=>String(n).padStart(2,"0");
const dateStr = d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
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

/* ===================== PARTY NAMES ===================== */
function lev(a,b){
  const m=[];
  for(let i=0;i<=a.length;i++)m[i]=[i];
  for(let j=1;j<=b.length;j++)m[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
    m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return m[a.length][b.length];
}
function closestParty(name){
  const k=name.toLowerCase();let best=null,bd=99;
  parties.forEach(p=>{const d=lev(k,p.toLowerCase());if(d<bd){bd=d;best=p;}});
  return (best&&bd>0&&bd<=Math.max(2,Math.floor(k.length*.3)))?best:null;
}
const cleanName = s=>s.trim().replace(/\s+/g," ");
const findParty = n=>parties.find(p=>p.toLowerCase()===n.toLowerCase());

// returns the final party name, or null if cancelled/empty
function resolveParty(raw){
  const n=cleanName(raw);
  if(!n){toast("Enter the purchasing party name");return null;}
  const ex=findParty(n);
  if(ex)return ex;
  const s=closestParty(n);
  if(s&&confirm(`Did you mean "${s}"?\n\nOK = use "${s}"\nCancel = save "${n}" as a new party`))return s;
  parties.push(n);saveParties();renderParties();
  return n;
}
function renderParties(){
  $("partyOpts").innerHTML=parties.map(p=>`<option value="${esc(p)}">`).join("");
  $("partyList").innerHTML=parties.length
    ?parties.map(p=>`<div class="row"><span>🏪 ${esc(p)}</span><button class="x" data-rp="${esc(p)}">✕</button></div>`).join("")
    :'<p class="mu">No parties yet. They are added when you save an order.</p>';
}

/* ===================== ORDER TAB ===================== */
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
  const party=resolveParty($("party").value);
  if(!party)return;
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
  const order={id:"O"+now.getTime().toString(36)+Math.random().toString(36).slice(2,5),ts:now.getTime(),employee,party,lines,qty,total};
  orders.unshift(order);
  if(saveOrders()){
    products.forEach(p=>p.qty=0);
    $("party").value="";$("partyHint").innerHTML="";
    $("sheet").classList.add("hide");
    renderList();
    toast("✅ Order saved");
  }else orders.shift();
}

/* ===================== ORDER LISTS (history + employee view) ===================== */
function inRange(o,r){
  if(r==="all")return true;
  const d=new Date(o.ts),n=new Date();
  if(r==="today")return dateStr(d)===dateStr(n);
  if(r==="month")return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth();
  if(r==="week"){
    const mon=new Date(n.getFullYear(),n.getMonth(),n.getDate()-((n.getDay()+6)%7));
    return d>=mon;
  }
}
function ordersHtml(list){
  if(!list.length)return '<p class="mu c">No orders in this period.</p>';
  return list.map(o=>{
    const d=new Date(o.ts);
    return `<details class="panel"><summary class="oh">
      <div>${d.toLocaleDateString("en-IN")} ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}<br>
      <span>${o.party?"🏪 "+esc(o.party)+" · ":""}${esc(o.employee||"")} · ${o.qty} qty</span></div>
      <div>${rs(o.total)}</div></summary>
      <div class="dt">${o.lines.map(l=>`<div class="row"><span>${esc(l.name)} × ${l.qty}</span><b>${l.total.toFixed(5)}</b></div>`).join("")}
      <button class="btn r sm" data-del="${o.id}">Delete this order</button></div></details>`;
  }).join("");
}
function fill(p,list){
  $(p+"Count").textContent=list.length;
  $(p+"Qty").textContent=list.reduce((a,o)=>a+o.qty,0);
  $(p+"Amt").textContent=rs(list.reduce((a,o)=>a+o.total,0));
}
const histList = ()=>orders.filter(o=>inRange(o,histRange));
const empList_ = ()=>(empData[curEmp]||[]).filter(o=>inRange(o,empRange));
function renderHistory(){const l=histList();fill("h",l);$("orders").innerHTML=ordersHtml(l);}
function renderEmp(){const l=empList_();fill("e",l);$("empOrders").innerHTML=ordersHtml(l);}

/* ===================== CSV EXPORT ===================== */
function buildCsv(list){
  const head=["OrderID","Date","Time","Employee","Party","Series","Product","Qty",...(isAdmin?["Net Rate (Lakh)"]:[]),"Total (Lakh)","Total (Rs)"];
  const rows=[head];
  list.slice().sort((a,b)=>a.ts-b.ts).forEach(o=>{
    const d=new Date(o.ts);
    o.lines.forEach(l=>rows.push([o.id,dateStr(d),pad(d.getHours())+":"+pad(d.getMinutes()),o.employee||"",o.party||"",l.series,l.name,l.qty,...(isAdmin?[l.rate.toFixed(6)]:[]),l.total.toFixed(6),(l.total*100000).toFixed(2)]));
  });
  const cell=v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  return "\uFEFF"+rows.map(r=>r.map(cell).join(",")).join("\r\n");
}
const makeFile = (text,name,type)=>new File([text],name,{type});
function download(file){
  const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
async function shareOrDownload(file){
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:file.name});return;}
  }catch(e){if(e&&e.name==="AbortError")return;}
  download(file);
  toast("Sharing not supported here. File downloaded - send it manually.");
}
function csvFile(list,tag){
  if(!list.length){toast("No orders to export");return null;}
  return makeFile(buildCsv(list),`${tag}_${dateStr(new Date())}.csv`,"text/csv");
}

/* ===================== CSV IMPORT (admin) ===================== */
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
  const c={id:ix("orderid"),d:ix("date"),t:ix("time"),e:ix("employee"),p:ix("party"),s:ix("series"),n:ix("product"),q:ix("qty"),l:ix("total (lakh)")};
  if(c.id<0||c.n<0||c.q<0||c.l<0)return null;
  const m={};
  rows.slice(1).forEach(r=>{
    const id=r[c.id];if(!id)return;
    const o=m[id]||(m[id]={id,ts:new Date((r[c.d]||"")+"T"+(r[c.t]||"00:00")).getTime()||Date.now(),
      employee:c.e>=0?r[c.e]:"",party:c.p>=0?r[c.p]:"",lines:[],qty:0,total:0});
    const q=parseFloat(r[c.q])||0,t=parseFloat(r[c.l])||0;
    o.lines.push({series:c.s>=0?r[c.s]:"",name:r[c.n],qty:q,rate:q?t/q:0,total:t});
    o.qty+=q;o.total+=t;
  });
  return Object.values(m);
}
function mergeInto(arr,incoming){
  const have=new Set(arr.map(o=>o.id));let add=0;
  incoming.forEach(o=>{if(!have.has(o.id)){arr.push(o);have.add(o.id);add++;}});
  arr.sort((a,b)=>b.ts-a.ts);
  return add;
}
function importFile(file){
  if(/\.xlsx?$/i.test(file.name)){
    alert("Excel files (.xlsx) are not supported yet.\n\nOpen the file in Excel and use Save As > CSV, or ask the employee to send the CSV they exported from the app.");
    return;
  }
  const r=new FileReader();
  r.onload=()=>{
    const rows=parseCsv(String(r.result));
    const list=rows.length?ordersFromRows(rows):null;
    if(!list||!list.length){toast("❌ Not a valid order CSV");return;}
    const odd=list.filter(o=>o.employee&&o.employee.toLowerCase()!==curEmp.toLowerCase()).length;
    if(odd&&!confirm(`${odd} order(s) in this file belong to a different employee name.\nAdd them to "${curEmp}" anyway?`))return;
    const arr=empData[curEmp]||(empData[curEmp]=[]);
    const add=mergeInto(arr,list);
    saveEmps();renderEmp();
    toast(`Added ${add} orders, skipped ${list.length-add} duplicates`);
  };
  r.readAsText(file);
}

/* ===================== EMPLOYEES (admin) ===================== */
function renderEmps(){
  const names=Object.keys(empData).sort();
  $("empList").innerHTML=names.length?names.map(n=>{
    const l=empData[n],t=l.reduce((a,o)=>a+o.total,0);
    const last=l.length?new Date(Math.max(...l.map(o=>o.ts))).toLocaleDateString("en-IN"):"no orders";
    return `<div class="item emp" data-emp="${esc(n)}"><div class="n"><b>👤 ${esc(n)}</b><div>${l.length} orders · last: ${last}</div></div><div class="tot">${rs(t)}</div></div>`;
  }).join(""):'<p class="mu c">No employees yet. Tap "+ Add employee".</p>';
}
function addEmployee(){
  const n=cleanName(prompt("Employee username (same as in their app):")||"");
  if(!n)return;
  if(Object.keys(empData).some(k=>k.toLowerCase()===n.toLowerCase())){toast("Already in the list");return;}
  empData[n]=[];saveEmps();renderEmps();
}
function openEmp(name){
  curEmp=name;empRange="all";
  $("empName").textContent="👤 "+name;
  document.querySelectorAll("#empChips button").forEach(b=>b.classList.toggle("on",b.dataset.r==="all"));
  tab("emp");
}

/* ===================== LOGIN ===================== */
function setMode(m){
  mode=m;const last=sGet("ora_last","");
  $("lUserWrap").classList.toggle("hide",m==="unlock");
  $("lPass2Wrap").classList.toggle("hide",m!=="create");
  $("lTitle").textContent=m==="unlock"?"Welcome back, "+last:m==="create"?"Create account":"Log in";
  $("lGo").textContent=m==="create"?"Create & Enter":"Unlock";
  $("lErr").textContent="";$("lPass").value="";$("lPass2").value="";
  $("lLink1").textContent=m==="create"?"Already have an account? Log in":"Create new account";
  $("lLink2").classList.toggle("hide",m!=="unlock");
}
function initLogin(){$("login").classList.remove("hide");setMode(sGet("ora_last","")?"unlock":"login");}
function doLogin(){
  const err=m=>{$("lErr").textContent=m;};
  const u=mode==="unlock"?sGet("ora_last",""):$("lUser").value.trim().toLowerCase();
  const pw=$("lPass").value;
  if(!u||!pw)return err("Enter username and password");
  if(mode==="create"){
    if(!/^[a-z0-9_.]{3,20}$/.test(u))return err("Username: 3-20 letters or numbers");
    const us=users();
    if(u===ADMIN_USER||us[u])return err("That username is taken");
    if(pw.length<4)return err("Password needs 4+ characters");
    if(pw!==$("lPass2").value)return err("Passwords do not match");
    const salt=Math.random().toString(36).slice(2);
    us[u]={s:salt,h:H(salt+"|"+u+"|"+pw)};sSet("ora_users",us);
    return start(u,false);
  }
  if(u===ADMIN_USER){if(H("ora|"+u+"|"+pw)!==ADMIN_H)return err("Wrong password");return start(u,true);}
  const a=users()[u];
  if(!a)return err("No such user on this phone. Create an account.");
  if(H(a.s+"|"+u+"|"+pw)!==a.h)return err("Wrong password");
  start(u,false);
}
function updateNav(){
  const orderUi=!isAdmin||orderMode;
  const vis={emps:isAdmin,order:orderUi,hist:orderUi,back:isAdmin,set:true};
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("hide",!vis[b.dataset.t]));
}
function start(u,adm){
  employee=u;isAdmin=adm;orderMode=false;showNet=false;unlocked=false;
  sSet("ora_last",u);
  orders=sGet("ora_orders_"+u,[]);parties=sGet("ora_parties_"+u,[]);
  empData=adm?sGet("ora_emps",{}):{};
  products.forEach(p=>p.qty=0);
  $("party").value="";$("partyHint").innerHTML="";
  $("btnNet").textContent="Show Net Rate Bar";
  $("btnOrderMode").textContent="Show order placing UI";
  document.querySelectorAll(".adm").forEach(e=>e.classList.toggle("hide",!adm));
  $("btnOut").classList.remove("hide");$("login").classList.add("hide");
  showWho();updateNav();renderList();renderParties();
  tab(adm?"emps":"order");
}
function logout(){
  employee="";isAdmin=false;orders=[];parties=[];empData={};unlocked=false;showNet=false;orderMode=false;
  products.forEach(p=>p.qty=0);
  document.querySelectorAll(".adm").forEach(e=>e.classList.add("hide"));
  $("btnOut").classList.add("hide");$("who").textContent="";
  initLogin();
}
function showWho(){
  $("who").textContent=employee?((isAdmin?"👑 Admin: ":"👤 ")+employee):"";
  $("acctInfo").textContent=employee?`Logged in as ${employee} (${isAdmin?"Admin":"Employee"}). Orders are kept on this phone under this account.`:"";
}

/* ===================== ADMIN BACKEND (math check first) ===================== */
function askMath(){
  const a=Math.floor(Math.random()*10)+3,b=Math.floor(Math.random()*8)+2,c=Math.floor(Math.random()*12)+1;
  expected=a*b+c;$("mQ").textContent=`(${a} × ${b}) + ${c} = ?`;
  $("mA").value="";$("mErr").textContent="";$("math").classList.remove("hide");
}
function checkMath(){
  if(parseInt($("mA").value,10)!==expected){$("mErr").textContent="Incorrect answer!";return;}
  $("math").classList.add("hide");unlocked=true;tab("back");
}
const stat = p=>p.customK!==null?`Manual rate · <a href="#" data-auto="${p.id}">Restore auto</a>`:"Auto-calculated";
function renderBack(){
  $("backList").innerHTML=products.map(p=>`<div class="panel"><b>${esc(p.name)}</b> <span class="mu">${esc(p.group)}</span>
    <div class="g4">${[["pack","PACK",1],["mrp","MRP ₹",.5],["scheme","Scheme",.01]].map(f=>`<div><label>${f[1]}</label><input class="in" type="number" inputmode="decimal" step="${f[2]}" min="0" value="${p[f[0]]}" data-id="${p.id}" data-f="${f[0]}"></div>`).join("")}
    <div><label>Net Rate (lakh)</label><input class="in" type="number" inputmode="decimal" step="0.000001" id="nk${p.id}" value="${rateOf(p).toFixed(6)}" data-id="${p.id}" data-f="net"></div></div>
    <div class="mu" id="nm${p.id}">${stat(p)}</div></div>`).join("");
}

/* ===================== BACKUP / SETTINGS ===================== */
function renderChecks(){
  const ok=b=>b?"✅":"❌";
  const items=[["Storage (saving orders)",storageOK],["Share to WhatsApp",!!navigator.share],
    ["Works offline (HTTPS)",location.protocol==="https:"||location.hostname==="localhost"],["Secure mode",window.isSecureContext]];
  $("checks").innerHTML=items.map(i=>`<div class="row"><span>${i[0]}</span><b>${ok(i[1])}</b></div>`).join("")+
    `<div class="row"><span>Saved orders</span><b>${orders.length}</b></div>`;
}
function backup(){
  const d={app:"ora",v:2,exported:Date.now(),employee,orders,parties};
  if(isAdmin)d.emps=empData;
  shareOrDownload(makeFile(JSON.stringify(d),`backup_${employee}_${dateStr(new Date())}.json`,"application/json"));
}
function restore(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(d.app!=="ora"||!Array.isArray(d.orders))throw 0;
      let add=mergeInto(orders,d.orders);saveOrders();
      (d.parties||[]).forEach(p=>{if(!findParty(p))parties.push(p);});saveParties();renderParties();
      if(isAdmin&&d.emps){
        Object.keys(d.emps).forEach(n=>{add+=mergeInto(empData[n]||(empData[n]=[]),d.emps[n]);});
        saveEmps();
      }
      renderChecks();toast(`Restored ${add} new orders`);
    }catch(e){toast("❌ Not a valid backup file");}
  };
  r.readAsText(file);
}

/* ===================== TABS ===================== */
function tab(t){
  if(t==="back"&&!isAdmin)return;
  if(t==="back"&&!unlocked){askMath();return;}
  if(t!=="back")unlocked=false;
  curTab=t;
  ["emps","emp","order","hist","back","set"].forEach(x=>$("tab-"+x).classList.toggle("hide",x!==t));
  const navKey=t==="emp"?"emps":t;
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.t===navKey));
  $("bar").classList.toggle("hide",t!=="order");
  $("sheet").classList.add("hide");
  if(t==="emps")renderEmps();
  if(t==="emp")renderEmp();
  if(t==="hist")renderHistory();
  if(t==="back")renderBack();
  if(t==="set")renderChecks();
  window.scrollTo(0,0);
}

function chipHandler(boxId,setRange,render){
  $(boxId).onclick=e=>{
    const b=e.target.closest("button");if(!b)return;
    setRange(b.dataset.r);
    document.querySelectorAll("#"+boxId+" button").forEach(x=>x.classList.toggle("on",x===b));
    render();
  };
}
function deleteHandler(boxId,getArr,afterDelete){
  $(boxId).onclick=e=>{
    const id=e.target.dataset.del;
    if(id&&confirm("Delete this order permanently?")){afterDelete(getArr().filter(o=>o.id!==id));}
  };
}

/* ===================== EVENTS ===================== */
document.addEventListener("DOMContentLoaded",()=>{
  applyPrices();initLogin();

  document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>tab(b.dataset.t));

  // login
  $("lGo").onclick=doLogin;
  $("login").addEventListener("keydown",e=>{if(e.key==="Enter")doLogin();});
  $("lLink1").onclick=e=>{e.preventDefault();setMode(mode==="create"?(sGet("ora_last","")?"unlock":"login"):"create");};
  $("lLink2").onclick=e=>{e.preventDefault();setMode("login");};
  $("btnOut").onclick=logout;

  // order tab
  $("search").oninput=renderList;
  $("list").addEventListener("input",e=>{if(e.target.classList.contains("q"))setQty(+e.target.dataset.id,e.target.value);});
  $("barTap").onclick=()=>$("sheet").classList.toggle("hide");
  $("btnClear").onclick=()=>{if(products.some(p=>p.qty>0)&&confirm("Clear all quantities?")){products.forEach(p=>p.qty=0);renderList();}};
  $("btnSave").onclick=saveOrder;
  $("party").oninput=()=>{
    const n=cleanName($("party").value);
    const s=n&&!findParty(n)?closestParty(n):null;
    $("partyHint").innerHTML=s?`Did you mean <button class="chip" data-use="${esc(s)}">${esc(s)}</button> ?`:"";
  };
  $("partyHint").onclick=e=>{const u=e.target.dataset.use;if(u){$("party").value=u;$("partyHint").innerHTML="";}};

  // history
  chipHandler("chips",r=>histRange=r,renderHistory);
  deleteHandler("orders",()=>orders,a=>{orders=a;saveOrders();renderHistory();});
  $("btnCsv").onclick=()=>{const f=csvFile(histList(),"orders_"+histRange);if(f)download(f);};
  $("btnShareCsv").onclick=()=>{const f=csvFile(histList(),"orders_"+histRange);if(f)shareOrDownload(f);};

  // employees (admin)
  $("btnAddEmp").onclick=addEmployee;
  $("empList").onclick=e=>{const it=e.target.closest(".item");if(it&&it.dataset.emp)openEmp(it.dataset.emp);};
  $("btnEmpBack").onclick=()=>tab("emps");
  chipHandler("empChips",r=>empRange=r,renderEmp);
  deleteHandler("empOrders",()=>empData[curEmp]||[],a=>{empData[curEmp]=a;saveEmps();renderEmp();});
  $("btnImport").onclick=()=>$("fileImport").click();
  $("fileImport").onchange=e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value="";};
  $("btnECsv").onclick=()=>{const f=csvFile(empList_(),curEmp+"_"+empRange);if(f)download(f);};
  $("btnEShare").onclick=()=>{const f=csvFile(empList_(),curEmp+"_"+empRange);if(f)shareOrDownload(f);};

  // backend (admin)
  $("mOk").onclick=checkMath;
  $("mCancel").onclick=()=>$("math").classList.add("hide");
  $("backList").addEventListener("input",e=>{
    const f=e.target.dataset.f;if(!f||!isAdmin||!unlocked)return;
    const id=+e.target.dataset.id,p=products.find(x=>x.id===id),n=parseFloat(e.target.value);
    if(isNaN(n)||n<0)return;
    if(f==="net")p.customK=n;else p[f]=n;
    if(f!=="net"&&p.customK===null)$("nk"+id).value=rateOf(p).toFixed(6);
    $("nm"+id).innerHTML=stat(p);savePrices();
  });
  $("backList").addEventListener("click",e=>{
    const id=e.target.dataset.auto;if(!id||!isAdmin||!unlocked)return;
    e.preventDefault();products.find(x=>x.id===+id).customK=null;savePrices();renderBack();
  });

  // settings
  $("btnAddParty").onclick=()=>{
    const n=cleanName($("newParty").value);
    if(!n)return;
    if(findParty(n)){toast("Already saved");return;}
    const s=closestParty(n);
    if(s&&!confirm(`"${s}" is already saved. Add "${n}" as a separate party anyway?`))return;
    parties.push(n);saveParties();renderParties();$("newParty").value="";
  };
  $("partyList").onclick=e=>{
    const p=e.target.dataset.rp;
    if(p&&confirm(`Remove "${p}" from saved parties? (Old orders keep the name.)`)){
      parties=parties.filter(x=>x!==p);saveParties();renderParties();
    }
  };
  $("btnOrderMode").onclick=()=>{
    orderMode=!orderMode;updateNav();
    $("btnOrderMode").textContent=orderMode?"Hide order placing UI":"Show order placing UI";
  };
  $("btnNet").onclick=()=>{
    showNet=!showNet;
    $("btnNet").textContent=showNet?"Hide Net Rate Bar":"Show Net Rate Bar";
    renderList();
  };
  $("btnBackup").onclick=backup;
  $("btnRestore").onclick=()=>$("fileRestore").click();
  $("fileRestore").onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value="";};
  $("btnWipe").onclick=()=>{
    if(confirm("Delete ALL your saved orders from this phone? Make a backup first!")&&confirm("Really delete everything?")){
      orders=[];saveOrders();renderChecks();toast("All orders deleted");
    }
  };

  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
});