import {useState,useEffect,useRef} from 'react';
import {Copy,Check} from 'lucide-react';
export function CopyButton({text,label='Kopiuj',small=false}:{text:string;label?:string;small?:boolean}){
 const [state,setState]=useState<'idle'|'copied'|'error'>('idle');const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const copy=async()=>{try{await navigator.clipboard.writeText(text);setState('copied');}catch{setState('error');}clearTimeout(timer.current);timer.current=setTimeout(()=>setState('idle'),2200);};
 return <button className={small?'code-copy':'icon-button'} title={state==='copied'?'Skopiowano':label} aria-label={state==='copied'?'Skopiowano':state==='error'?'Kopiowanie niedostępne':label} onClick={()=>void copy()}>{state==='copied'?<Check size={15}/>:<Copy size={15}/>} {small&&(state==='copied'?'Skopiowano':state==='error'?'Brak dostępu':label)}{!small&&state==='error'&&<span className="sr-only" role="status">Kopiowanie niedostępne</span>}</button>;
}
