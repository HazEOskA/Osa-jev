import type {Conversation, Execution, ProofRecord, SystemStatus, SendRequest, SendResult, StreamEvent} from '../types';
// This boundary is transport-independent. Replace MockAdapter at composition root.
export interface ChatAPI {
 getConversations():Promise<Conversation[]>;
 getConversation(id:string):Promise<Conversation>;
 createConversation():Promise<Conversation>;
 renameConversation(id:string,title:string):Promise<void>;
 deleteConversation(id:string):Promise<void>;
 sendMessage(request:SendRequest):Promise<SendResult>;
 streamMessage(result:SendResult,request:SendRequest,signal:AbortSignal):AsyncIterable<StreamEvent>;
 getExecution(id:string):Promise<Execution>;
 getProof(id:string):Promise<ProofRecord>;
 getSystemStatus():Promise<SystemStatus>;
}
export const endpoints = {
 chat:'/api/chat', conversations:'/api/conversations', conversation:(id:string)=>`/api/conversations/${encodeURIComponent(id)}`,
 execution:(id:string)=>`/api/executions/${encodeURIComponent(id)}`, proof:(id:string)=>`/api/proofs/${encodeURIComponent(id)}`,
 systemStatus:'/api/system/status',stream:'/api/chat/stream',
} as const;
// SSE/WebSocket/ReadableStream decoders can all yield StreamEvent without UI changes.
