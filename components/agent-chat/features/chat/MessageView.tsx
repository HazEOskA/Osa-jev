import {memo} from 'react';
import {RotateCcw,AlertTriangle,Paperclip} from 'lucide-react';
import type {Execution,Message,ProofRecord} from '../../types';
import {t} from '../../i18n';
import {Markdown} from './Markdown';
import {CopyButton} from '../../components/CopyButton';
import {ExecutionDetails} from './ExecutionDetails';
export const MessageView=memo(function MessageView({message,execution,proof,onRetry,busy,showProof}:{message:Message;execution?:Execution;proof?:ProofRecord;onRetry:()=>void;busy:boolean;showProof:boolean}){
 if(message.role==='system'||message.role==='event')return <div className="system-event"><span className="status-dot"/>{message.content}</div>;
 if(message.role==='user')return <article className="user-message" aria-label="Twoja wiadomość"><div>{message.content}{message.attachments?.map(a=><span className="attachment-chip" key={a.id}><Paperclip size={14}/>{a.name} · bez przesyłania</span>)}</div></article>;
 return <article className="assistant-message" aria-label="Odpowiedź asystenta"><div className="assistant-label"><span className="mini-symbol">✧</span><strong>OSA</strong><span>Osa-jev</span></div>{message.content?<Markdown content={message.content}/>:message.status==='streaming'?<div className="thinking" role="status"><span/><span/><span/><small>Przygotowuję odpowiedź…</small></div>:null}{message.status==='streaming'&&message.content&&<span className="stream-caret" aria-label="Generowanie w toku"/>}{message.error&&<div className="message-error" role="alert"><AlertTriangle size={17}/><div>{t.errors[message.error]}<button className="text-button" onClick={onRetry} disabled={busy}><RotateCcw size={14}/>Spróbuj ponownie</button></div></div>}{message.status!=='streaming'&&message.content&&<div className="message-actions"><CopyButton text={message.content} label={t.copy}/>{!message.error&&<button className="icon-button" aria-label="Ponów odpowiedź" title="Ponów odpowiedź" disabled={busy} onClick={onRetry}><RotateCcw size={15}/></button>}</div>}{execution&&<ExecutionDetails execution={execution} proof={proof} showProof={showProof}/>}</article>;
});
