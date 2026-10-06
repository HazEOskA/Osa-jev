import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDivElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const root=ref.current!;root.querySelector<HTMLElement>('button,input,select,textarea,[tabindex="0"]')?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();closeRef.current();}
   if(e.key==='Tab'){
    const items=Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    const first=items[0],last=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[]);
 return createPortal(<div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className={`dialog ${wide?'dialog-wide':''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Zamknij panel" onClick={onClose}><X size={19}/></button></div>{children}</div></div>,document.body);
}
