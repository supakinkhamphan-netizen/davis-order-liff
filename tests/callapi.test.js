const fs=require('fs'); const vm=require('vm');
// Board credentials (v38, 2026-09-26): callApi waits for LINE, sends fresh
// credentials, drops an expired id token, never sends an empty one.
// Run: node tests/callapi.test.js
const path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const SNIP=SRC.slice(SRC.indexOf('  var authReadyResolve = null;'),SRC.indexOf('  function callApiSend(fn, payload)'));

const sent=[]; let tok={it:'',at:'',exp:0};
const ctx={setTimeout,Promise,Date,Object,String,Error,console,
  liff:{getIDToken:()=>tok.it,getAccessToken:()=>tok.at,getDecodedIDToken:()=>({exp:tok.exp})},
  idToken:'',accessToken:'',callApiSend:(fn,p)=>{sent.push([fn,p]);return Promise.resolve({ok:true});}};
vm.createContext(ctx); vm.runInContext(SNIP,ctx);
let fails=0; const eq=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w); if(!ok)fails++; console.log(ok?'ok  ':'FAIL',l,JSON.stringify(g));};
(async()=>{
  // call before init: must wait, not send empty
  const p=ctx.callApi('listOrderStatusRows',{idToken:'',accessToken:''});
  await new Promise(r=>setTimeout(r,50)); eq('nothing sent before LINE answers',sent.length,0);
  tok={it:'ID1',at:'AT1',exp:Date.now()/1000+3600}; ctx.authReadyResolve(); await p;
  eq('after init the fresh creds ride along',sent[0][1],{idToken:'ID1',accessToken:'AT1'});
  tok.exp=Date.now()/1000-10; await ctx.callApi('submitOrderFulfillPhotos',{idToken:'stale',accessToken:'stale',x:1});
  eq('an expired id token is dropped, access token carries it',sent[1][1],{idToken:'',accessToken:'AT1',x:1});
  tok={it:'',at:'',exp:0}; let e=''; try{await ctx.callApi('clientLogViaLiff',{});}catch(err){e=err.message;}
  eq('no credential → refused locally, nothing sent',[sent.length,/Not connected to LINE/.test(e)],[2,true]);
  process.exit(fails?1:0);
})();
