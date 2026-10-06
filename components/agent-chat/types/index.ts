export type AgentMode = 'auto'|'fast'|'deep'|'agent';
export type MessageRole = 'user'|'assistant'|'system'|'event';
export type MessageStatus = 'streaming'|'completed'|'interrupted'|'error';
export interface Attachment {id:string;name:string;size:number;mimeType:string;status:'placeholder'}
export interface Message {id:string;conversationId:string;role:MessageRole;content:string;createdAt:string;executionId?:string;proofId?:string;status?:MessageStatus;error?:ErrorCode;attachments?:Attachment[]}
export interface Conversation {id:string;title:string;createdAt:string;updatedAt:string;messages:Message[]}
export type StepStatus = 'pending'|'ready'|'running'|'completed'|'verified'|'healthy'|'failed'|'cancelled'|'unknown';
export interface ExecutionStep {id:string;name:string;status:StepStatus;timestamp:string;durationMs:number}
export interface Execution {id:string;conversationId:string;status:'running'|'completed'|'failed'|'cancelled';createdAt:string;steps:ExecutionStep[];components:Record<'Hermes'|'Jeverson'|'Runtime'|'APR'|'Monitoring',StepStatus>}
export interface EvidenceRecord {type:'mock_receipt'|'execution_receipt';description:string;source:string}
export interface ProofRecord {id:string;executionId:string;status:'verified'|'failed'|'recorded';timestamp:string;evidence:EvidenceRecord[];simulated:boolean}
export interface SystemStatus {status:'healthy'|'degraded'|'offline';checkedAt:string;services:{name:string;status:'healthy'|'degraded'|'offline'|'unknown'}[];simulated:boolean}
export interface Model {id:string;name:string;description:string}
export type ErrorCode = 'network'|'runtime'|'apr'|'interrupted'|'unavailable';
export type MockScenario = 'success'|ErrorCode;
export interface SendRequest {conversationId:string;content:string;modelId:string;mode:AgentMode;attachments:Attachment[];scenario:MockScenario}
export interface SendResult {user:Message;assistant:Message;execution:Execution}
export type StreamEvent = {type:'delta';text:string}|{type:'execution';execution:Execution}|{type:'complete';message:Message;execution:Execution;proof:ProofRecord}|{type:'error';code:ErrorCode;execution:Execution};
