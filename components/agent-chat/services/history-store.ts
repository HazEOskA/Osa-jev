import type {Conversation} from "../types";
const DATABASE="osa-jeff-local-history";
const STORE="conversations";
const VERSION=1;
async function openHistory():Promise<IDBDatabase|null>{
  if(typeof indexedDB==="undefined") return null; // Node unit tests only
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DATABASE,VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error("HISTORY_UNAVAILABLE"));
    req.onblocked=()=>reject(Error("HISTORY_BLOCKED"));
  });
}
export async function loadHistory():Promise<Conversation[]>{
  const db=await openHistory();if(!db)return [];
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=>resolve((req.result as Conversation[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
    req.onerror=()=>reject(req.error||Error("HISTORY_READ_FAILED"));
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>db.close();
  });
}
export async function storeConversation(conversation:Conversation):Promise<void>{
  const db=await openHistory();if(!db)return;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(conversation);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{db.close();reject(tx.error||Error("HISTORY_WRITE_FAILED"));};
    tx.onabort=()=>{db.close();reject(tx.error||Error("HISTORY_ABORTED"));};
  });
}
export async function removeConversation(id:string):Promise<void>{
  const db=await openHistory();if(!db)return;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{db.close();reject(tx.error||Error("HISTORY_DELETE_FAILED"));};
    tx.onabort=()=>{db.close();reject(tx.error||Error("HISTORY_ABORTED"));};
  });
}
