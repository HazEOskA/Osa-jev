"use client";
import {useState,useRef,useEffect,useCallback} from 'react';
import {PanelLeft,ChevronDown,ArrowUpRight,Code2,Workflow,Layers,ScanLine,ArrowDown,Plus,AlertCircle} from 'lucide-react';
import {CockpitAdapter} from './services/adapters/cockpit';
import {useChat} from './hooks/useChat';
import {defaultPreferences,type Preferences} from './state/settings';
import {Sidebar} from './features/chat/Sidebar';
import {Composer} from './features/chat/Composer';
import {MessageView} from './features/chat/MessageView';
import {Settings} from './features/settings/Settings';
import {SystemHealth} from './components/SystemHealth';
import {t} from './i18n';
const api=new CockpitAdapter();
const suggestions=[{title:t.suggestions[0],detail:'Od pomysłu do przejrzystego planu',icon:Layers,prompt:'Zaprojektuj architekturę systemu agentowego z oddzielonym frontendem.'},{title:t.suggestions[1],detail:'Znajdź prostsze, lepsze rozwiązanie',icon:Code2,prompt:'Pokaż dobre praktyki dla modularnego kodu TypeScript.'},{title:t.suggestions[2],detail:'Poznaj przykładowy przepływ zadania',icon:Workflow,prompt:'Pokaż demonstrację wykonania zadania przez agenta.'},{title:t.suggestions[3],detail:'Sprawdź zapis wykonania',icon:ScanLine,prompt:'Wyjaśnij, jak sprawdzić wykonanie i potwierdzenie APR.'}];
export default function App(){
 const chat=useChat(api);const [preferences,setPreferences]=useState(defaultPreferences);
 const [sidebar,setSidebar]=useState(false),[desktopCollapsed,setDesktopCollapsed]=useState(false),[settings,setSettings]=useState(false);
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[nearBottom,setNearBottom]=useState(true);
 const scrollRef=useRef<HTMLDivElement>(null),drawerRef=useRef<HTMLElement>(null),menuRef=useRef<HTMLButtonElement>(null);
 const onChange=useCallback((p:Partial<Preferences>)=>setPreferences(v=>({...v,...p})),[]);
 const draft=drafts[chat.activeId]??'';
 const setDraft=(s:string)=>setDrafts(ds=>({...ds,[chat.activeId]:s}));
 useEffect(()=>{const el=scrollRef.current;if(el&&preferences.autoScroll&&nearBottom)el.scrollTop=el.scrollHeight;},[chat.active?.messages,preferences.autoScroll]);
 useEffect(()=>{const el=scrollRef.current;if(el)el.scrollTop=el.scrollHeight;setNearBottom(true);},[chat.activeId]);
 useEffect(()=>{
  if(!sidebar)return;
  const old=document.activeElement as HTMLElement;drawerRef.current?.querySelector<HTMLElement>('button')?.focus();
  const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSidebar(false);old?.focus();}if(e.key==='Tab'){
   const items=Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button,input,a[href]')??[]).filter(x=>x.getClientRects().length>0);const first=items[0],last=items.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }};
  document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);old?.focus();};
 },[sidebar]);
 const empty=!chat.active?.messages.length;
 return <div className={`app ${desktopCollapsed?'collapsed':''} ${preferences.compact?'compact':''}`}><a className="skip-link" href="#chat-content">Przejdź do rozmowy</a>{sidebar&&<div className="drawer-backdrop" onClick={()=>setSidebar(false)}/>}<aside ref={drawerRef} className={`sidebar ${sidebar?'mobile-open':''}`} aria-label="Panel rozmów" role={sidebar?'dialog':undefined} aria-modal={sidebar?true:undefined}><Sidebar conversations={chat.conversations} activeId={chat.activeId} onSelect={id=>{void chat.selectConversation(id);setSidebar(false);}} onNew={()=>{void chat.newChat();setSidebar(false);}} onSettings={()=>{setSettings(true);setSidebar(false);}} onClose={()=>{setSidebar(false);setDesktopCollapsed(true);}} onRename={chat.rename} onDelete={chat.remove}/></aside><main className="main" inert={sidebar?true:undefined}><header className="chat-header"><div className="header-left"><button ref={menuRef} className="icon-button sidebar-trigger" aria-label="Otwórz historię rozmów" onClick={()=>{if(window.matchMedia('(max-width:900px)').matches)setSidebar(true);else setDesktopCollapsed(false);}}><PanelLeft size={19}/></button><div className="header-title">{empty?'Nowa rozmowa':chat.active?.title}<ChevronDown size={13}/></div></div><div className="header-right"><span className="demo-pill">OSA · Jev</span>{preferences.monitoring&&<SystemHealth api={api}/>}<button className="icon-button mobile-new" aria-label="Nowa rozmowa" onClick={()=>void chat.newChat()}><Plus size={19}/></button></div></header><div id="chat-content" className="chat-scroll" ref={scrollRef} tabIndex={-1} onScroll={e=>{const el=e.currentTarget;setNearBottom(el.scrollHeight-el.scrollTop-el.clientHeight<100);}}>{chat.loading?<div className="loading-state" role="status"><span className="spinner"/>Wczytuję przestrzeń…</div>:empty?<section className="empty-state"><div className="empty-emblem" aria-hidden="true"><span>◇</span><span className="emblem-dot"/></div><div className="eyebrow">TWOJA PRZESTRZEŃ DO MYŚLENIA</div><h1>{t.empty}</h1><p>Zacznij od pytania. Resztę ułożymy krok po kroku.</p><div className="suggestions">{suggestions.map(({title,detail,icon:Icon,prompt})=><button key={title} onClick={()=>setDraft(prompt)}><Icon size={18}/><div><strong>{title}</strong><small>{detail}</small></div><ArrowUpRight size={15}/></button>)}</div><div className="empty-demo"><span className="status-dot working"/>Połączenie z Osa-jev · historia w tej sesji</div></section>:<div className="messages">{chat.active?.messages.map(m=><MessageView key={m.id} message={m} execution={m.executionId?chat.executions[m.executionId]:undefined} proof={m.proofId?chat.proofs[m.proofId]:undefined} onRetry={()=>void chat.retry(m,preferences)} busy={chat.busy} showProof={preferences.showProof}/>)}</div>}</div>{!nearBottom&&!empty&&<button className="scroll-bottom icon-button" aria-label="Przewiń do najnowszej wiadomości" onClick={()=>{const el=scrollRef.current;if(el)el.scrollTop=el.scrollHeight;setNearBottom(true);}}><ArrowDown size={18}/></button>}{chat.fatal&&<div role="alert" className="fatal-error"><AlertCircle size={16}/>{chat.fatal}<button className="text-button" onClick={()=>void chat.initialize()}>Spróbuj ponownie</button></div>}<Composer key={chat.activeId} busy={chat.busy||chat.loading} draft={draft} setDraft={setDraft} onSend={(text,files)=>chat.send(text,files,preferences)} onStop={chat.stop} preferences={preferences} onChange={onChange}/></main>{settings&&<Settings preferences={preferences} onChange={onChange} onClose={()=>setSettings(false)}/>}</div>;
}
