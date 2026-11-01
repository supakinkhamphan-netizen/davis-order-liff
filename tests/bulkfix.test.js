const fs=require('fs'); const vm=require('vm'); const path=require('path');
// Board v46 (2026-11-01): close or cancel several stuck orders at once from
// the fix panel ("ทำปุ่มปิดหลายใบพร้อมกันให้หน่อย"). Backend: fixBulkViaLiff,
// at most 20 ids per call, estimated times, never a fine.
// Run: node tests/bulkfix.test.js
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=SRC.indexOf('  // ---- v46 bulk fix ----'), b=SRC.indexOf('  // ---- end v46 bulk fix ----');
if(a<0||b<0){console.log('FAIL bulk fix block not found');process.exit(1);}
const BLOCK=SRC.slice(a,b);
let fails=0; const eq=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w); if(!ok)fails++; console.log(ok?'ok  ':'FAIL',l,JSON.stringify(g));};
const calls=[], toasts=[];
let answers=[];
const ctx={me:{isManager:true},console,Promise,JSON,Object,Array,String,Math,setTimeout,
  esc:s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  escAttr:s=>String(s==null?'':s).replace(/"/g,'&quot;'),
  isFullManager(){return !!ctx.me && !!ctx.me.isManager;},
  creds:()=>({idToken:'i',accessToken:'a'}), forceRefresh(){}, publishBoardAfterWrite(){}, loadFixQueue(){ctx.reloaded=(ctx.reloaded||0)+1;},
  toast:(m,e)=>toasts.push([m,!!e]),
  callApi:(fn,p)=>{calls.push([fn,JSON.parse(JSON.stringify(p))]); return Promise.resolve(answers.length?answers.shift():{ok:true,done:0,failed:[]});},
  document:{getElementById:()=>null,createElement:()=>({className:'',innerHTML:'',addEventListener(){},setAttribute(){}}),body:{appendChild(){}}}};
vm.createContext(ctx); vm.runInContext(BLOCK,ctx);
const run=s=>vm.runInContext(s,ctx);
const tick=()=>new Promise(r=>setTimeout(r,5));
const items=[];
for(let i=1;i<=25;i++) items.push({orderId:'ORD_202610'+(10+i)+'_0'+(i%9+1),kind:'open',text:'open '+i+' days',seller:'AMORE',bill:true,ready:i<=21});
for(let i=1;i<=30;i++) items.push({orderId:'ORD_2026102'+(i%10)+'_1'+i,kind:'open',text:'open 3 days',seller:'LULU',bill:false,ready:false});
items.push({orderId:'ORD_20260925_13',kind:'missing',text:'marked delivered · no time or amount',seller:'AMORE',bill:false,ready:false});
items.push({orderId:'ORD_20261025_03',kind:'photo',text:'photo 11:53 · stamp 12:09',seller:'NOT IN BANGKOK'});
(async()=>{
  eq('staff get no entry button',(ctx.me=null, run('bulkEntryHtml(5)')),'');
  ctx.me={isManager:true};
  eq('an executive gets "Select several"',/Select several/.test(run('bulkEntryHtml(5)')),true);
  run('renderBulkSheet=function(){}');
  answers=[{ok:true,items}];
  await run('openBulk()'); await tick();
  eq('the sheet asks the server for every item, not the first 30',calls[0],['fixQueueViaLiff',{idToken:'i',accessToken:'a',all:true}]);
  eq('only open and marked-delivered orders can be closed in bulk (a photo item cannot)',run('bulkState.items.length'),56);
  let html=run('bulkSheetHtml(bulkState)');
  eq('the two groups are offered with their counts',/Kitchen tapped \(25\)/.test(html)&&/Nothing tapped \(31\)/.test(html)&&/All \(56\)/.test(html),true);
  eq('nothing is ticked to begin with',run('bulkPickedIds().length'),0);
  run("bulkSetFilter('kitchen')"); run('bulkPickShown(true)');
  eq('"Select all shown" in the kitchen group ticks 25',run('bulkPickedIds().length'),25);
  html=run('bulkSheetHtml(bulkState)');
  eq('the button counts what will happen',/Close 25 orders/.test(html),true);
  eq('and the sheet says the times are estimates and nobody is fined',/estimate/i.test(html)&&/no fine/i.test(html),true);
  calls.length=0; await run('runBulk()');
  eq('no reason: nothing is sent',calls.length,0);
  eq('and the sheet says why',/reason/i.test(run('bulkState.error')),true);
  run("bulkState.reason='การ์ดไม่เข้ากลุ่ม โควตาหมด'");
  // 1 Nov 2026 19:02: a batch of 20 took ~75 s on the server (3.8 s an order)
  // and the board gave up at 20 s. Batches are 5 now, with a long timeout.
  answers=[{ok:true,done:5,failed:[]},{ok:true,done:5,failed:[]},{ok:true,done:5,failed:[]},{ok:true,done:5,failed:[]},{ok:true,done:4,failed:[{orderId:items[24].orderId,error:'Set Food ready too'}]}];
  await run('runBulk()'); for(let i=0;i<8;i++) await tick();
  const sent=calls.filter(c=>c[0]==='fixBulkViaLiff');
  eq('sent in batches of 5',sent.map(c=>c[1].orderIds.length),[5,5,5,5,5]);
  eq('each batch says close and carries the one reason',sent.every(c=>c[1].action==='close'&&c[1].reason==='การ์ดไม่เข้ากลุ่ม โควตาหมด'),true);
  eq('the toast counts what went through',toasts.some(t=>/24/.test(t[0])),true);
  eq('a failure stays on the sheet with its reason',run('bulkState.failed.map(f=>f.orderId)'),[items[24].orderId]);
  eq('the closed ones leave the list, the failed one stays',run('bulkState.items.length'),56-24);
  eq('the queue is reloaded',ctx.reloaded>=1,true);
  run("bulkSetFilter('none')"); run('bulkPickShown(true)'); run("bulkState.action='cancel'");
  html=run('bulkSheetHtml(bulkState)');
  eq('cancel says it in the button and warns it leaves the sales',/Cancel 31 orders/.test(html)&&/sales/i.test(html),true);
  // ---- the connection drops mid-run: the server may still be finishing ----
  run("bulkSetFilter('all')"); run("bulkState.action='close'"); run('bulkPickShown(true)');
  const before=run('bulkState.items.length');
  calls.length=0; toasts.length=0;
  ctx.callApi=(fn,p)=>{calls.push([fn,JSON.parse(JSON.stringify(p))]);
    if(fn==='fixBulkViaLiff'&&calls.filter(c=>c[0]==='fixBulkViaLiff').length===2) return Promise.reject(new Error('Fetch is aborted'));
    if(fn==='fixQueueViaLiff') return Promise.resolve({ok:true,items:items.slice(30,40)});
    return Promise.resolve({ok:true,done:5,failed:[]});};
  vm.runInContext('callApi=__c',Object.assign(ctx,{__c:ctx.callApi}));
  await run('runBulk()'); for(let i=0;i<8;i++) await tick();
  eq('it stops sending after the drop',calls.filter(c=>c[0]==='fixBulkViaLiff').length,2);
  eq('no order is claimed "not done" — nobody knows yet',run('bulkState.failed.length'),0);
  eq('the list is reloaded from the server instead',calls.some(c=>c[0]==='fixQueueViaLiff'&&c[1].all===true)&&run('bulkState.items.length')===10,true);
  eq('and the sheet says what happened',/timed out|connection/i.test(run('bulkState.error'))&&/reloaded/i.test(run('bulkState.error')),true);
  eq('nothing is left ticked',run('bulkPickedIds().length'),0);
  process.exit(fails?1:0);
})();
