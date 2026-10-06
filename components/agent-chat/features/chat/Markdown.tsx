import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {ReactNode,ReactElement} from 'react';
import {CopyButton} from '../../components/CopyButton';
function textOf(node:ReactNode):string{if(typeof node==='string'||typeof node==='number')return String(node);if(Array.isArray(node))return node.map(textOf).join('');if(node&&typeof node==='object'&&'props' in node)return textOf((node as ReactElement<{children?:ReactNode}>).props.children);return '';}
export function Markdown({content}:{content:string}){
 return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
  pre:({children})=><div className="code-block"><div className="code-toolbar"><span>Kod</span><CopyButton small text={textOf(children).replace(/\n$/,'')} label="Kopiuj kod"/></div><pre tabIndex={0}>{children}</pre></div>,
  table:({children})=><div className="table-scroll" tabIndex={0} aria-label="Tabela odpowiedzi"><table>{children}</table></div>,
  a:({href,children})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
 }}>{content}</ReactMarkdown></div>;
}
