const fs=require('fs'); const vm=require('vm'); const path=require('path');
// v43 (2026-10-11): an open handover form survives the trip to the camera.
// Coming back fired visibilitychange → forceRefresh → render(), which wiped
// the photo just taken and the amount just typed; Snow re-took the photos 14
// times over 30 minutes on ORD_20261008_01. Run: node tests/formkeep.test.js
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=SRC.indexOf(a),j=SRC.indexOf(b,i+a.length);if(i<0||j<0)throw new Error('snippet not found: '+a);return SRC.slice(i,j);};
let fails=0; const eq=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w); if(!ok)fails++; console.log(ok?'ok  ':'FAIL',l,JSON.stringify(g));};

// ---- forceRefresh holds the board while a form is open ----
(async()=>{
  const renders=[];
  const ctx={Promise,JSON,Date,console,REQUEST_GROUP:'',idToken:'',accessToken:'',boardGeneration:0,lastPayload:'',refreshing:false,allRows:null,pendingRealtime:null,
    openForms:{ORD_1:true}, hasOpenForm(){return Object.keys(ctx.openForms).some(k=>ctx.openForms[k]);},
    callApi:()=>Promise.resolve([{orderId:'ORD_1',stage:1}]),noteServerNow(){},clearOffline(){},applyFloor(){},render(){renders.push(1);},
    document:{getElementById:()=>({textContent:''})}};
  vm.createContext(ctx);
  vm.runInContext(cut('  function forceRefresh() {','  function ')+'',ctx);
  // the snippet above stops at the next function; it is only forceRefresh
  await vm.runInContext('forceRefresh()',ctx);
  eq('a refresh that lands while the form is open does not repaint',renders.length,0);
  eq('it is held for when the form closes',!!ctx.pendingRealtime,true);
  ctx.openForms={};
  await vm.runInContext('forceRefresh()',ctx);
  eq('with no form open it repaints as before',renders.length,1);

  // ---- what was typed comes back after a repaint ----
  const c2={openForms:{ORD_2:true},photoFirst:{},esc:s=>String(s),photoFirstText:()=>''};
  vm.createContext(c2);
  vm.runInContext(cut('  var formDrafts = {};','  function formBodyHtml(')+cut('  function formBodyHtml(','\n  }\n')+'\n  }\n',c2);
  vm.runInContext("formDrafts.ORD_2 = { amt: '706', pay: 'Card' }",c2);
  const html=vm.runInContext("formBodyHtml('ORD_2','submitFulfill','runner')",c2);
  eq('the amount typed is in the redrawn form',/id="amt-ORD_2"[^>]*value="706"/.test(html),true);
  eq('the payment picked is still picked',/<option value="Card" selected>/.test(html),true);
  eq('a form with nothing typed is empty',/value=""/.test(vm.runInContext("formBodyHtml('ORD_3','submitFulfill','runner')",c2)),true);

  // ---- photos already on the server count when the file box came back empty ----
  const calls=[]; const els={};
  const el=(id)=>els[id]||(els[id]={id,value:'',files:[],textContent:'',style:{},disabled:false});
  const c3={Promise,Date,Object,Array,Math,String,console,idToken:'',accessToken:'',openForms:{},formDrafts:{},
    photoFirst:{ORD_4:{food:{status:'sent',files:['f'],promise:Promise.resolve(true)},bill:{status:'sent',files:['b'],promise:Promise.resolve(true)}}},
    document:{getElementById:el},alreadySavedHere:()=>false,toast(){},render(){},clientLog(){},applyLocalStage(){},forceRefresh(){},publishBoardAfterWrite(){},
    photoFirstReady:(id,food,bill)=>{calls.push(['ready',food,bill]);return Promise.resolve(true);},
    photoFirstUpload(){}, setInterval, clearInterval,
    callApi:(fn,p)=>{calls.push([fn,p]);return Promise.resolve({ok:true,_ms:100});}};
  vm.createContext(c3);
  vm.runInContext(cut('  function submitWithPhoto(','\n  function ')+'\n',c3);
  el('amt-ORD_4').value='753'; el('pay-ORD_4').value='Card'; el('food-ORD_4'); el('photo-ORD_4');
  vm.runInContext("submitWithPhoto('ORD_4','submitOrderFulfillForm',2,'runner')",c3);
  await new Promise(r=>setTimeout(r,20));
  eq('no "take the photo again" message',el('err-ORD_4').textContent.indexOf('No photo')<0,true);
  eq('the photos already sent are used',calls[0],['ready',['f'],['b']]);
  eq('and the handover is stamped',calls.some(c=>c[0]==='submitOrderFulfillForm'),true);
  // v45: the stamp carries how long Save waited, so the server stamps the press.
  const st=calls.find(c=>c[0]==='submitOrderFulfillForm');
  eq('the stamp says how long Save waited',typeof st[1].waitedMs==='number'&&st[1].waitedMs>=0,true);
  // a photo that FAILED to upload still has to be taken again
  c3.photoFirst.ORD_5={food:{status:'failed',files:['f']},bill:{status:'sent',files:['b']}};
  el('amt-ORD_5').value='100'; el('food-ORD_5'); el('photo-ORD_5');
  vm.runInContext("submitWithPhoto('ORD_5','submitOrderFulfillForm',2,'runner')",c3);
  eq('a failed upload is not counted as sent',el('err-ORD_5').textContent,'⚠ No photo of the food yet');
  process.exit(fails?1:0);
})();
