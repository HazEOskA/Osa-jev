import type {AgentMode,MockScenario} from '../types';
export interface Preferences {modelId:string;mode:AgentMode;scenario:MockScenario;compact:boolean;autoScroll:boolean;showProof:boolean;monitoring:boolean}
export const defaultPreferences:Preferences={modelId:'auto',mode:'auto',scenario:'success',compact:false,autoScroll:true,showProof:true,monitoring:true};
