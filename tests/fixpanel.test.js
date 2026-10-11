const fs=require('fs'); const vm=require('vm'); const path=require('path');
// Board v44 (2026-10-11): the executives' 🛠 Fix panel. A sheet over the board,
// outside the list, so no repaint of the list can touch what is typed in it.
// Run: node tests/fixpanel.test.js
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=SRC.indexOf('  // ---- v44 fix panel ----'), b=SRC.indexOf('  // ---- end v44 fix panel ----');
if(a<0||b<0){console.log('FAIL fix panel block not found');process.exit(1);}
const BLOCK=SRC.slice(a,b);
let fails=0; const eq=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w); if(!ok)fails++; console.log(ok?'ok  ':'FAIL',l,JSON.stringify(g));};
const calls=[], toasts=[];
const ctx={me:null,console,Promise,JSON,Object,Array,String,Math,
  esc:s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  escAttr:s=>String(s==null?'':s).replace(/"/g,'&quot;'),
  isFullManager(){return !!ctx.me && !!ctx.me.isManager;},
  creds:()=>({idToken:'i',accessToken:'a'}), hasOpenForm:()=>false, render(){}, forceRefresh(){}, publishBoardAfterWrite(){},
  toast:(m,e)=>toasts.push([m,!!e]), callApi:(fn,p)=>{calls.push([fn,p]);return Promise.resolve(ctx.answer||{ok:true,fines:{cancelled:[],added:[],kept:[]}});},
  document:{getElementById:()=>null,createElement:()=>({className:'',innerHTML:'',addEventListener(){},setAttribute(){}}),body:{appendChild(){}}}};
vm.createContext(ctx); vm.runInContext(BLOCK,ctx);
const run=s=>vm.runInContext(s,ctx);
(async()=>{
  eq('no button for staff',run("fixButtonHtml({orderId:'ORD_1'})"),'');
  ctx.me={isManager:true};
  eq('an executive gets the button',/🛠 Fix/.test(run("fixButtonHtml({orderId:'ORD_1'})")),true);
  run("fixQueue=[{orderId:'ORD_20261002_29',kind:'open',text:'open 9 days',seller:'NOT IN BANGKOK'}]");
  eq('the Needs fixing strip lists the stuck order',/Needs fixing \(1\)/.test(run('fixStripHtml()'))&&/open 9 days/.test(run('fixStripHtml()')),true);
  const ctxDelivered={ok:true,orderId:'ORD_C',seller:'LULU',status:'ส่งมอบแล้ว',amount:706,allowed:['retime','reopen','cancel'],
    stamps:{ordered:'2026-10-07 19:34',bill:'2026-10-07 19:59',ready:'2026-10-07 20:00',delivered:'2026-10-07 20:37'},
    by:{ordered:'tai',bill:'Romeo',ready:'Nai',delivered:'Snow'},audit:[],runners:[{lineId:'Unicky',name:'Nicky'}],
    suggest:{delivered:[{label:'📸 delivery photo 20:08',value:'2026-10-07 20:08'}],ready:[],bill:[]}};
  run('fixState=null');
  ctx.st={orderId:'ORD_C',ctx:ctxDelivered,tab:'retime',draft:{reason:'',noFine:false,times:{},amount:'',runner:''},busy:false,error:''};
  run('fixState=st');
  let html=run('fixSheetHtml(fixState)');
  eq('a delivered order offers fix times, reopen, cancel — not close',['Close for staff','Fix times','Reopen','Cancel'].map(t=>html.indexOf(t)>=0),[false,true,true,true]);
  eq('the timeline shows who tapped',/Snow/.test(html)&&/Romeo/.test(html),true);
  eq('the photo suggestion is a chip',/📸 delivery photo 20:08/.test(html),true);
  run("fixPick('delivered','2026-10-07 20:08')");
  eq('a chip fills the delivered time',run('fixState.draft.times.delivered'),'2026-10-07 20:08');
  eq('and the box shows it',/value="2026-10-07T20:08"/.test(run('fixSheetHtml(fixState)')),true);
  run("fixState.draft.reason='ส่งจริง 20:08'");
  eq('what was typed survives a redraw of the sheet',/ส่งจริง 20:08/.test(run('fixSheetHtml(fixState)')),true);
  eq('only the time that changed is sent',run('fixPayload(fixState)'),{orderId:'ORD_C',action:'retime',reason:'ส่งจริง 20:08',noFine:false,times:{delivered:'2026-10-07 20:08'}});
  run("fixState.draft.reason=''"); calls.length=0;
  run('submitFix()');
  eq('no reason: nothing is sent',calls.length,0);
  eq('and the sheet says why',/reason/i.test(run('fixState.error')),true);
  run("fixState.draft.reason='ส่งจริง 20:08'"); run("renderFixSheet=function(){}"); run("closeFix=function(){fixState=null}");
  ctx.answer={ok:true,fines:{cancelled:[{name:'Snow',leg:'ส่งมอบ',baht:70}],added:[],kept:[]},warning:''};
  await run('submitFix()'); await new Promise(r=>setTimeout(r,10));
  eq('Confirm sends the fix',calls.map(c=>c[0]).filter(f=>f==='fixOrderViaLiff').length,1);
  eq('the toast says what happened to the money',toasts.some(t=>/Snow/.test(t[0])&&/70/.test(t[0])),true);
  eq('the sheet closes after',run('fixState'),null);
  const stuck=Object.assign({},ctxDelivered,{orderId:'ORD_S',allowed:['close','retime','cancel'],stamps:{ordered:'2026-10-02 22:40',bill:'2026-10-02 22:45',ready:'',delivered:''}});
  ctx.st2={orderId:'ORD_S',ctx:stuck,tab:'close',draft:{reason:'',noFine:false,times:{},amount:'',runner:''},busy:false,error:''};
  run('fixState=st2'); html=run('fixSheetHtml(fixState)');
  eq('a stuck order offers close for staff',/Close for staff/.test(html),true);
  eq('close asks who delivered, nobody allowed',/Nicky/.test(html)&&/Nobody \/ not sure/.test(html),true);
  eq('and asks for food ready too when it is missing',/data-fix="time-ready"/.test(html),true);
  run("fixState.draft.reason='ลืมกดส่ง'; fixState.draft.times={ready:'2026-10-02 23:00',delivered:'2026-10-02 23:10'}; fixState.draft.runner='Unicky'; fixState.draft.noFine=true");
  eq('close sends the times, the runner and No fine',run('fixPayload(fixState)'),{orderId:'ORD_S',action:'close',reason:'ลืมกดส่ง',noFine:true,times:{ready:'2026-10-02 23:00',delivered:'2026-10-02 23:10'},runnerLineId:'Unicky'});
  process.exit(fails?1:0);
})();
