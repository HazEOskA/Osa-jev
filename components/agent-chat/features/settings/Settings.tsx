import {useEffect,useState} from 'react';
import {SlidersHorizontal,Boxes,KeyRound,Workflow,ShieldCheck,Activity,Info} from 'lucide-react';
import {Dialog} from '../../components/Dialog';
import type {Preferences} from '../../state/settings';
import type {MockScenario} from '../../types';
import {models} from '../../mock/data';
const tabs=[{id:'general',name:'Ogólne',icon:SlidersHorizontal},{id:'models',name:'Modele',icon:Boxes},{id:'keys',name:'Klucze API',icon:KeyRound},{id:'runtime',name:'Środowisko wykonania',icon:Workflow},{id:'proof',name:'Potwierdzenia',icon:ShieldCheck},{id:'monitoring',name:'Monitorowanie',icon:Activity}];
const scenarios:Record<MockScenario,string>={success:'Pomyślne wykonanie',network:'Błąd sieci',runtime:'Błąd Runtime',apr:'Nieudana weryfikacja APR',interrupted:'Przerwany strumień',unavailable:'Usługa niedostępna'};
export function Settings({onClose,preferences,onChange}:{onClose:()=>void;preferences:Preferences;onChange:(p:Partial<Preferences>)=>void}){
 const [tab,setTab]=useState('general');
 const [token,setToken]=useState('');
 const [session,setSession]=useState<'checking'|'saved'|'missing'|'error'>('checking');
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   void fetch('/api/jeff-session',{credentials:'same-origin',cache:'no-store'})
     .then(async r=>{if(!r.ok)throw Error('SESSION_STATUS_FAILED');return r.json() as Promise<{authenticated:boolean}>;})
     .then(d=>{if(active)setSession(d.authenticated?'saved':'missing');})
     .catch(()=>{if(active)setSession('error');});
   return ()=>{active=false;};
 },[]);
 const saveToken=async()=>{
   if(token.trim().length<16)return;
   setSaving(true);setError('');
   try{
     const response=await fetch('/api/jeff-session',{method:'POST',credentials:'same-origin',cache:'no-store',
       headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token.trim()})});
     if(!response.ok)throw Error(response.status===401?'Token jest niepoprawny.':'Nie udało się zapisać dostępu.');
     setToken('');setSession('saved');
   }catch(e){setError(e instanceof Error?e.message:'Błąd połączenia.');}
   finally{setSaving(false);}
 };
 const removeAccess=async()=>{
   setSaving(true);setError('');
   try{
     const response=await fetch('/api/jeff-session',{method:'DELETE',credentials:'same-origin',cache:'no-store'});
     if(!response.ok)throw Error('Nie udało się wylogować.');
     setToken('');setSession('missing');
   }catch(e){setError(e instanceof Error?e.message:'Błąd połączenia.');}
   finally{setSaving(false);}
 };
 return <Dialog title="Ustawienia" onClose={onClose} wide><div className="settings-layout"><nav className="settings-nav" aria-label="Sekcje ustawień">{tabs.map(({id,name,icon:Icon})=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={16}/>{name}</button>)}</nav><section className="settings-content"><h3>{tabs.find(t=>t.id===tab)?.name}</h3><p className="muted">Historia rozmów zapisuje się lokalnie w IndexedDB. Dostęp GLM jest przechowywany w bezpiecznym ciasteczku HttpOnly.</p>{tab==='general'&&<><label className="setting-row"><span><strong>Język interfejsu</strong><small>Przygotowana struktura PL / EN</small></span><select aria-label="Język interfejsu" defaultValue="pl"><option value="pl">Polski</option><option disabled value="en">Angielski — wkrótce</option></select></label><div className="setting-row"><span><strong>Wygląd</strong><small>Interfejs zaprojektowany dark-first</small></span><span className="pill">Ciemny</span></div><Toggle label="Kompaktowe wiadomości" detail="Mniejsze odstępy pomiędzy odpowiedziami" value={preferences.compact} onChange={compact=>onChange({compact})}/><Toggle label="Automatyczne przewijanie" detail="Podążaj za nową odpowiedzią" value={preferences.autoScroll} onChange={autoScroll=>onChange({autoScroll})}/></>}{tab==='models'&&<><label className="setting-row"><span><strong>Domyślny model</strong><small>Provider; model wybierany przez backend</small></span><select value={preferences.modelId} onChange={e=>onChange({modelId:e.target.value})} aria-label="Domyślny model">{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div className="model-list">{models.map(m=><div key={m.id}><span>{m.name}</span><small>Model serwerowy</small></div>)}</div></>}{tab==='keys'&&<><div className="notice"><KeyRound size={18}/><div><strong>Dostęp do GLM 5.3 Flash Uncensored</strong><p>{session==='saved'?'Dostęp zapamiętany na 30 dni. Nie musisz wklejać tokenu ponownie.':session==='checking'?'Sprawdzam zapamiętany dostęp…':session==='error'?'Nie udało się sprawdzić sesji.':'Wklej token raz i kliknij Zapamiętaj dostęp.'}</p></div></div><label className="key-field">Token OSA Jeff<input type="password" autoComplete="off" spellCheck={false} placeholder={session==='saved'?'Dostęp jest zapisany · token ukryty':'Wklej JEFF_CHAT_ACCESS_TOKEN'} value={token} onChange={e=>setToken(e.target.value)}/></label><div className="form-actions"><button type="button" className="button primary" onClick={()=>void saveToken()} disabled={saving||token.trim().length<16}>Zapamiętaj dostęp — 30 dni</button>{session==='saved'&&<button type="button" className="button" onClick={()=>void removeAccess()} disabled={saving}>Wyloguj</button>}</div>{error&&<p role="alert" className="error-text">{error}</p>}<p className="muted">Token jest wysyłany tylko przy zapisie dostępu. Nie zapisujemy go w IndexedDB, localStorage ani historii. Sesja ma atrybuty HttpOnly, Secure i SameSite=Strict.</p></>}{tab==='runtime'&&<div className="notice"><Workflow size={18}/><div><strong>Osa-jev · /api/cockpit</strong><p>Odpowiedź JSON, bez streamingu tokenów. Stop przerywa oczekiwanie w przeglądarce; nie potwierdza zatrzymania pracy serwera. Tryby Szybki/Głęboki używają obecnie trybu Rozmowa.</p></div></div>}{tab==='proof'&&<><Toggle label="Potwierdzenia APR" detail="Pokaż potwierdzenie w rozwiniętych szczegółach wykonania" value={preferences.showProof} onChange={showProof=>onChange({showProof})}/><div className="notice"><ShieldCheck size={18}/><div><strong>Receipt runtime</strong><p>Pokazujemy zapis wykonania. APR nie jest jeszcze potwierdzony.</p></div></div></>}{tab==='monitoring'&&<><Toggle label="Status systemu" detail="Dyskretny wskaźnik w nagłówku czatu" value={preferences.monitoring} onChange={monitoring=>onChange({monitoring})}/><div className="notice"><Activity size={18}/><div><strong>Brak rzeczywistej telemetrii</strong><p>Status konfiguracji pochodzi z /api/cockpit. Pozostałe usługi pozostają niepotwierdzone.</p></div></div></>}<div className="settings-footer"><span className="status-dot working"/> Historia działa lokalnie na tym urządzeniu. Dostęp GLM: 30 dni.</div></section></div></Dialog>;
}
function Toggle({label,detail,value,onChange}:{label:string;detail:string;value:boolean;onChange:(v:boolean)=>void}){return <div className="setting-row"><span><strong>{label}</strong><small>{detail}</small></span><button role="switch" aria-checked={value} aria-label={label} className={`toggle ${value?'on':''}`} onClick={()=>onChange(!value)}><span/></button></div>;}
