const {test}=require('node:test');const assert=require('node:assert/strict');
const request=id=>({conversationId:id,content:'Sprawdź integrację',modelId:'openrouter',mode:'agent',attachments:[],scenario:'success'});
test('adapter: jeden request, rzeczywisty receipt, brak fałszywego APR i brak duplikatów historii',async()=>{
 const {CockpitAdapter}=await import('../components/agent-chat/services/adapters/cockpit.ts');const api=new CockpitAdapter(),c=await api.createConversation();let calls=0;const old=global.fetch;
 global.fetch=async(url,opts)=>{calls++;assert.equal(url,'/api/cockpit');const body=JSON.parse(opts.body);assert.equal(body.provider,'openrouter');assert.equal(body.mode,'agent');assert.deepEqual(body.memory,[]);return {ok:true,json:async()=>({answer:'Odpowiedź',route:{source:'jev'},receipt:{execution_id:'osa_test',generation_status:'SUCCEEDED',provider:'openrouter',latency_ms:9,verified:'EXECUTION_RECORDED'}})};};
 try{const r=request(c.id),start=await api.sendMessage(r);assert.equal(c.messages.length,0);const events=[];for await(const e of api.streamMessage(start,r,new AbortController().signal))events.push(e);assert.equal(calls,1);assert.equal(events.length,1);assert.equal(events[0].type,'complete');assert.equal(events[0].proof.status,'recorded');assert.equal(events[0].execution.components.APR,'unknown');assert.equal(events[0].proof.simulated,false);assert.equal((await api.getConversation(c.id)).messages.length,2);}finally{global.fetch=old;}
});
test('adapter: przerwanie żądania jest cancelled, nigdy completed',async()=>{
 const {CockpitAdapter}=await import('../components/agent-chat/services/adapters/cockpit.ts');const api=new CockpitAdapter(),c=await api.createConversation(),r=request(c.id),start=await api.sendMessage(r),controller=new AbortController(),old=global.fetch;
 global.fetch=async(_,opts)=>{assert.equal(opts.signal.aborted,true);throw Error('abort');};controller.abort();try{const events=[];for await(const e of api.streamMessage(start,r,controller.signal))events.push(e);assert.equal(events[0].code,'interrupted');assert.equal(events[0].execution.status,'cancelled');}finally{global.fetch=old;}
});
test('adapter: HTTP 200 z NOT_CONFIGURED pozostaje failed',async()=>{
 const {CockpitAdapter}=await import('../components/agent-chat/services/adapters/cockpit.ts');const api=new CockpitAdapter(),c=await api.createConversation(),r=request(c.id),start=await api.sendMessage(r),old=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({answer:'Runtime offline',receipt:{execution_id:'offline',generation_status:'NOT_CONFIGURED'}})});try{for await(const e of api.streamMessage(start,r,new AbortController().signal)){assert.equal(e.execution.status,'failed');assert.equal(e.message.error,'runtime');}}finally{global.fetch=old;}
});
