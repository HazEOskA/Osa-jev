import {useCallback,useEffect,useRef,useState} from 'react';
import type {ChatAPI} from '../services/api';
import type {Attachment,Conversation,Execution,Message,ProofRecord,SendRequest} from '../types';
import type {Preferences} from '../state/settings';
export function useChat(api:ChatAPI){
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [activeId,setActiveId]=useState<string>('');
 const [loading,setLoading]=useState(true);
 const [fatal,setFatal]=useState('');
 const [busy,setBusy]=useState(false);
 const [executions,setExecutions]=useState<Record<string,Execution>>({});
 const [proofs,setProofs]=useState<Record<string,ProofRecord>>({});
 const abortRef=useRef<AbortController|null>(null);
 const sendingRef=useRef(false);
 const mounted=useRef(true);
 const patchMessage=useCallback((conversationId:string,id:string,patch:Partial<Message>)=>{
  setConversations(cs=>cs.map(c=>c.id!==conversationId?c:{...c,messages:c.messages.map(m=>m.id!==id?m:{...m,...patch})}));
 },[]);
 const initialize=useCallback(async()=>{
  setLoading(true);setFatal('');
  try {const list=await api.getConversations();const fresh=await api.createConversation();if(mounted.current){setConversations([fresh,...list]);setActiveId(fresh.id);}}
  catch{if(mounted.current)setFatal('Nie udało się wczytać rozmów. Spróbuj ponownie.');}
  finally{if(mounted.current)setLoading(false);}
 },[api]);
 useEffect(()=>{mounted.current=true;void initialize();return()=>{mounted.current=false;abortRef.current?.abort();};},[initialize]);
 const newChat=async()=>{try {const c=await api.createConversation();setConversations(cs=>[c,...cs]);setActiveId(c.id);}catch{setFatal('Nie udało się utworzyć rozmowy.');}};
 const selectConversation=async(id:string)=>{setActiveId(id);try{const c=await api.getConversation(id);setConversations(cs=>cs.map(existing=>existing.id===id?c:existing));}catch{setFatal('Nie udało się otworzyć rozmowy.');}};
 const rename=async(id:string,title:string)=>{await api.renameConversation(id,title);setConversations(cs=>cs.map(c=>c.id===id?{...c,title:title.trim()||'Nowa rozmowa'}:c));};
 const remove=async(id:string)=>{await api.deleteConversation(id);const list=await api.getConversations();setConversations(list);if(activeId===id){if(list[0])setActiveId(list[0].id);else await newChat();}};
 const send=async(content:string,attachments:Attachment[],preferences:Preferences,retryConversationId?:string)=>{
  if(sendingRef.current||(!content.trim()&&!attachments.length))return;
  sendingRef.current=true;setBusy(true);setFatal('');
  const conversationId=retryConversationId??activeId;
  const controller=new AbortController();abortRef.current=controller;
  const request:SendRequest={conversationId,content:content.trim(),attachments,modelId:preferences.modelId,mode:preferences.mode,scenario:preferences.scenario};
  let result:Awaited<ReturnType<ChatAPI['sendMessage']>>|undefined;
  try{
   result=await api.sendMessage(request);const current=result;
   setConversations(cs=>cs.map(c=>c.id===conversationId?{...c,title:c.messages.length?c.title:content.slice(0,46)||'Załącznik',updatedAt:current.user.createdAt,messages:[...c.messages,current.user,current.assistant]}:c));
   setExecutions(es=>({...es,[current.execution.id]:current.execution}));
   let buffer='';
   for await(const event of api.streamMessage(current,request,controller.signal)){
    if(!mounted.current)break;
    if(event.type==='delta'){buffer+=event.text;patchMessage(conversationId,current.assistant.id,{content:buffer});}
    else if(event.type==='execution')setExecutions(es=>({...es,[event.execution.id]:event.execution}));
    else if(event.type==='complete'){patchMessage(conversationId,current.assistant.id,event.message);setExecutions(es=>({...es,[event.execution.id]:event.execution}));setProofs(ps=>({...ps,[event.proof.id]:event.proof}));}
    else{patchMessage(conversationId,current.assistant.id,{status:event.code==='interrupted'?'interrupted':'error',error:event.code});setExecutions(es=>({...es,[event.execution.id]:event.execution}));}
   }
  }catch{
   if(result)patchMessage(conversationId,result.assistant.id,{status:'error',error:'network'});
   else setFatal('Nie udało się wysłać wiadomości. Treść pozostała w polu wpisywania.');
   return false;
  }finally{sendingRef.current=false;abortRef.current=null;if(mounted.current)setBusy(false);}
  return true;
 };
 const retry=async(message:Message,preferences:Preferences)=>{
  const c=conversations.find(c=>c.id===message.conversationId);const index=c?.messages.findIndex(m=>m.id===message.id)??-1;
  const user=c?.messages.slice(0,index).reverse().find(m=>m.role==='user');
  if(user)await send(user.content,user.attachments??[],{...preferences,scenario:'success'},user.conversationId);
 };
 return {conversations,activeId,active:conversations.find(c=>c.id===activeId),loading,fatal,busy,executions,proofs,newChat,selectConversation,rename,remove,send,retry,stop:()=>abortRef.current?.abort(),initialize};
}
