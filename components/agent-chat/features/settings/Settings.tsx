import {useEffect,useState} from "react";
import {SlidersHorizontal,Boxes,KeyRound,Workflow,ShieldCheck,Activity,Info} from "lucide-react";
import {Dialog} from "../../components/Dialog";
import type {Preferences} from "../../state/settings";
import {models} from "../../mock/data";

const tabs=[
  {id:"general",name:"Ogólne",icon:SlidersHorizontal},
  {id:"models",name:"Modele",icon:Boxes},
  {id:"keys",name:"Klucze API",icon:KeyRound},
  {id:"runtime",name:"Środowisko wykonania",icon:Workflow},
  {id:"proof",name:"Potwierdzenia",icon:ShieldCheck},
  {id:"monitoring",name:"Monitorowanie",icon:Activity},
];
const providers=[
  {id:"openai",label:"OpenAI"},{id:"anthropic",label:"Anthropic"},
  {id:"google",label:"Google API (nie OAuth)"},{id:"openrouter",label:"OpenRouter"},
  {id:"nvidia",label:"NVIDIA"},{id:"custom",label:"Niestandardowy"},
];
export function Settings({onClose,preferences,onChange}:{
  onClose:()=>void;preferences:Preferences;onChange:(p:Partial<Preferences>)=>void;
}){
  const [tab,setTab]=useState("general");
  const [secrets,setSecrets]=useState<Record<string,string>>({});
  const [saved,setSaved]=useState<string[]>([]);
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState("");
  useEffect(()=>{
    if(tab!=="keys")return;
    let live=true;
    void fetch("/api/credentials",{cache:"no-store",credentials:"same-origin"})
      .then(async response=>{
        if(!response.ok)throw Error("Nie udało się odczytać statusu kluczy.");
        return response.json() as Promise<{credentials:{provider:string}[]}>;
      })
      .then(data=>{if(live)setSaved(data.credentials.map(x=>x.provider));})
      .catch(()=>{if(live)setNotice("Magazyn kluczy jest niedostępny. Sprawdź konfigurację.");});
    return ()=>{live=false;};
  },[tab]);
  const save=async(provider:string)=>{
    if(!secrets[provider]?.trim())return;
    setSaving(provider);setNotice("");
    try{
      const response=await fetch("/api/credentials",{
        method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({provider,value:secrets[provider].trim()}),
      });
      if(!response.ok)throw Error();
      setSaved(xs=>[...new Set([...xs,provider])]);
      setSecrets(values=>({...values,[provider]:""}));
      setNotice("Klucz zapisany w magazynie serwerowym.");
    }catch{setNotice("Nie udało się zapisać klucza. Niczego nie przechowano w przeglądarce.");}
    finally{setSaving("");}
  };
  const remove=async(provider:string)=>{
    setSaving(provider);setNotice("");
    try{
      const response=await fetch("/api/credentials",{
        method:"DELETE",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({provider}),
      });
      if(!response.ok)throw Error();
      setSaved(xs=>xs.filter(x=>x!==provider));
      setNotice("Klucz usunięto z magazynu.");
    }catch{setNotice("Usunięcie klucza nie powiodło się.");}
    finally{setSaving("");}
  };
  return <Dialog title="Ustawienia" onClose={onClose} wide>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Sekcje ustawień">
        {tabs.map(({id,name,icon:Icon})=><button key={id} aria-current={tab===id?"page":undefined}
          className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={16}/>{name}</button>)}
      </nav>
      <section className="settings-content">
        <h3>{tabs.find(t=>t.id===tab)?.name}</h3>
        <p className="muted">Historia rozmów jest przechowywana na serwerze i przypisana do konta Google.</p>
        {tab==="general"&&<>
          <label className="setting-row"><span><strong>Język interfejsu</strong><small>Polski</small></span>
            <select aria-label="Język interfejsu" value="pl" disabled><option value="pl">Polski</option></select>
          </label>
          <div className="setting-row"><span><strong>Wygląd</strong><small>Interfejs dark-first</small></span><span className="pill">Ciemny</span></div>
          <Toggle label="Kompaktowe wiadomości" detail="Mniejsze odstępy" value={preferences.compact} onChange={compact=>onChange({compact})}/>
          <Toggle label="Automatyczne przewijanie" detail="Podążaj za nową odpowiedzią" value={preferences.autoScroll} onChange={autoScroll=>onChange({autoScroll})}/>
        </>}
        {tab==="models"&&<>
          <label className="setting-row"><span><strong>Domyślny model</strong><small>GLM 5.3 jest obsługiwany przez serwer</small></span>
            <select value={preferences.modelId} onChange={e=>onChange({modelId:e.target.value})} aria-label="Domyślny model">
              {models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="model-list">{models.map(m=><div key={m.id}><span>{m.name}</span><small>Model serwerowy</small></div>)}</div>
        </>}
        {tab==="keys"&&<>
          <div className="notice"><Info size={18}/><div><strong>Klucze są szyfrowane po stronie serwera</strong>
            <p>Nie wpisujesz już tokena JEFF_CHAT_ACCESS_TOKEN. Systemowy klucz GLM pozostaje w środowisku backendu.
               Klucze osobiste BYOK są przechowywane oddzielnie dla każdego konta.</p>
            <p>Uwaga: podłączenie BYOK do routingu modeli to osobny etap; samo zapisanie nie aktywuje dostawcy.</p>
          </div></div>
          {providers.map(provider=><div key={provider.id} className="vault-row">
            <label className="key-field">{provider.label} — {saved.includes(provider.id)?"zapisany":"brak klucza"}
              <input type="password" autoComplete="off" spellCheck={false} placeholder="Wklej klucz, aby zapisać na serwerze"
                value={secrets[provider.id]||""}
                onChange={e=>setSecrets(v=>({...v,[provider.id]:e.target.value}))}/>
            </label>
            <div className="form-actions">
              {saved.includes(provider.id)&&<button className="button" disabled={!!saving} onClick={()=>void remove(provider.id)}>Usuń</button>}
              <button className="button primary" disabled={!!saving||!secrets[provider.id]?.trim()}
                onClick={()=>void save(provider.id)}>{saving===provider.id?"Zapisuję…":"Zapisz klucz"}</button>
            </div>
          </div>)}
          {notice&&<p role="status" className="muted">{notice}</p>}
        </>}
        {tab==="runtime"&&<div className="notice"><Workflow size={18}/><div><strong>Osa-jev · /api/cockpit</strong>
          <p>Odpowiedź JSON dla pozostałych modeli, streaming SSE dla GLM. Stop w przeglądarce nie oznacza
            zatrzymania wszystkich operacji zewnętrznych.</p></div></div>}
        {tab==="proof"&&<>
          <Toggle label="Potwierdzenia APR" detail="Pokazuj szczegóły wykonania" value={preferences.showProof}
            onChange={showProof=>onChange({showProof})}/>
          <div className="notice"><ShieldCheck size={18}/><div><strong>Receipt runtime</strong>
            <p>Receipt potwierdza zapis wyniku, nie pełną weryfikację APR.</p></div></div>
        </>}
        {tab==="monitoring"&&<>
          <Toggle label="Status systemu" detail="Wskaźnik w nagłówku" value={preferences.monitoring}
            onChange={monitoring=>onChange({monitoring})}/>
          <div className="notice"><Activity size={18}/><div><strong>Telemetria</strong>
            <p>Status jest pobierany z backendu; niepotwierdzone usługi pozostają nieznane.</p></div></div>
        </>}
        <div className="settings-footer"><span className="status-dot working"/>
          Preferencje wyglądu są lokalne; historia i klucze są serwerowe.
        </div>
      </section>
    </div>
  </Dialog>;
}
function Toggle({label,detail,value,onChange}:{label:string;detail:string;value:boolean;onChange:(v:boolean)=>void}){
  return <div className="setting-row"><span><strong>{label}</strong><small>{detail}</small></span>
    <button role="switch" aria-checked={value} aria-label={label}
      className={"toggle "+(value?"on":"")} onClick={()=>onChange(!value)}><span/></button>
  </div>;
}
