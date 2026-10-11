const fs=require('fs'); const vm=require('vm'); const path=require('path');
// v45: every handover photo upload says where it came from (pick / retry /
// save), which pick of that kind it is, and how long the page has been open.
// Run: node tests/photometa.test.js
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=SRC.indexOf('  var photoPicks = {};'), b=SRC.indexOf('  document.getElementById(\'list\').addEventListener(\'click\', function (e) {\n    var b = e.target.closest(\'[data-pf-retry]\');');
if(a<0||b<0){console.log('FAIL snippet not found');process.exit(1);}
let fails=0; const eq=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w); if(!ok)fails++; console.log(ok?'ok  ':'FAIL',l,JSON.stringify(g));};
const sent=[];
const ctx={Promise,Math,Object,console,setTimeout,idToken:'',accessToken:'',photoFirst:{},document:{getElementById:()=>({addEventListener(){}})},performance:{now:()=>95000},
  shrinkAll:(files,done)=>done(files.map(()=> 'data:image/jpeg;base64,AA')),photoFirstPaint(){},toast(){},clientLog(){},
  callApi:(fn,p)=>{sent.push([fn,p]);return Promise.resolve({ok:true});}};
vm.createContext(ctx); vm.runInContext(SRC.slice(a,b),ctx);
(async()=>{
  vm.runInContext("photoFirstUpload('ORD_9','food',['f1'],'pick')",ctx);
  vm.runInContext("photoFirstUpload('ORD_9','food',['f2'],'pick')",ctx);
  vm.runInContext("photoFirstUpload('ORD_9','bill',['b1'],'save')",ctx);
  await new Promise(r=>setTimeout(r,20));
  eq('each upload carries where it came from',sent.map(s=>s[1].photoMeta.source),['pick','pick','save']);
  eq('and which pick of that kind it is',sent.map(s=>s[1].photoMeta.pick),[1,2,1]);
  eq('and how long the page has been open',sent[0][1].photoMeta.pageSec,95);
  process.exit(fails?1:0);
})();
