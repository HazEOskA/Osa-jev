import {useEffect,useState} from 'react';
import {ChevronDown,RefreshCw} from 'lucide-react';
import type {ChatAPI} from '../services/api';
import type {SystemStatus} from '../types';
import {Dialog} from './Dialog';
import {t} from '../i18n';
export function SystemHealth({api}:{api:ChatAPI}){
 const [status,setStatus]=useState<SystemStatus|null>(null),[open,setOpen]=useState(false),[error,setError]=useState(false),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);setError(false);try{setStatus(await api.getSystemStatus());}catch{setError(true);}finally{setLoading(false);}};
 useEffect(()=>{void load();},[api]);
 return <><button className="health-button" aria-haspopup="dialog" onClick={()=>setOpen(true)}><span className={`status-dot ${error?'bad':status?.status==='healthy'?'good':'warn'}`}/><span>{loading?'Sprawdzanie…':error?'Status niedostępny':status?.status==='healthy'?'System sprawny':status?.status==='degraded'?'System ograniczony':'System niedostępny'}</span><ChevronDown size={12}/></button>{open&&<Dialog title="Status systemu" onClose={()=>setOpen(false)}><div className="proof-body"><p className="muted">Konfiguracja pobrana z runtime. Obecność klucza nie potwierdza dostępności modelu.</p>{error?<div role="alert" className="message-error">Nie udało się pobrać statusu.</div>:status?.services.map(s=><div className="service-row" key={s.name}><span>{s.name}</span><span className={`status-label ${s.status==='healthy'?'good':s.status==='degraded'?'warn':s.status==='unknown'?'muted':'bad'}`}><span className={`status-dot ${s.status==='healthy'?'good':s.status==='degraded'?'warn':s.status==='unknown'?'muted':'bad'}`}/>{t.status[s.status]}</span></div>)}<div className="status-footer"><small>Sprawdzono: {status?new Date(status.checkedAt).toLocaleTimeString('pl-PL'):'—'} · runtime</small><button className="text-button" disabled={loading} onClick={()=>void load()}><RefreshCw size={14}/>Odśwież</button></div></div></Dialog>}</>;
}
