import "server-only";
import { randomUUID } from "node:crypto";
import { scoped } from "./db";
import type { Conversation, Execution, Message, SendResult } from "@/components/agent-chat/types";

type DbRow = Record<string, unknown>;
function date(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
function message(row: DbRow): Message {
  return {
    id: String(row.id), conversationId: String(row.conversation_id),
    role: row.role as Message["role"], content: String(row.content || ""),
    createdAt: date(row.created_at), status: row.status as Message["status"],
    ...(row.error_code ? { error: row.error_code as Message["error"] } : {}),
    ...(row.execution_id ? { executionId: String(row.execution_id) } : {}),
    ...(row.proof_id ? { proofId: String(row.proof_id) } : {}),
  };
}
function conversation(row: DbRow, messages: Message[] = []): Conversation {
  return { id: String(row.id), title: String(row.title), createdAt: date(row.created_at),
    updatedAt: date(row.updated_at), messages };
}
function execution(conversationId: string, id: string, createdAt: string): Execution {
  return { id, conversationId, status: "running", createdAt, steps: [],
    components: { Hermes: "unknown", Jeverson: "pending", Runtime: "running", APR: "unknown", Monitoring: "unknown" } };
}
export class StoreError extends Error {
  constructor(public status: number, public safeMessage: string) { super(safeMessage); }
}
export async function listConversations(userId: string): Promise<Conversation[]> {
  return scoped(userId, async db => {
    const result = await db.query(
      "SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100",
      [userId],
    );
    return result.rows.map(row => conversation(row));
  });
}
export async function getConversation(userId: string, id: string): Promise<Conversation> {
  return scoped(userId, async db => {
    const result = await db.query(
      "SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 AND id=$2", [userId, id],
    );
    if (!result.rows.length) throw new StoreError(404, "Nie znaleziono rozmowy.");
    const rows = await db.query(
      "SELECT * FROM (SELECT * FROM messages WHERE user_id=$1 AND conversation_id=$2 " +
      "ORDER BY ordinal DESC LIMIT 250) recent ORDER BY ordinal ASC", [userId,id],
    );
    return conversation(result.rows[0], rows.rows.map(message));
  });
}
export async function createConversation(userId: string): Promise<Conversation> {
  return scoped(userId, async db => {
    const id = randomUUID();
    const r = await db.query(
      "INSERT INTO conversations (id,user_id) VALUES ($1,$2) RETURNING id,title,created_at,updated_at", [id,userId],
    );
    return conversation(r.rows[0]);
  });
}
export async function renameConversation(userId: string, id: string, title: string): Promise<Conversation> {
  const trimmed = title.trim().slice(0,100);
  if (!trimmed) throw new StoreError(400, "Podaj nazwę rozmowy.");
  return scoped(userId, async db => {
    const r = await db.query(
      "UPDATE conversations SET title=$3,updated_at=now() WHERE user_id=$1 AND id=$2 " +
      "RETURNING id,title,created_at,updated_at", [userId,id,trimmed],
    );
    if (!r.rows.length) throw new StoreError(404,"Nie znaleziono rozmowy.");
    return conversation(r.rows[0]);
  });
}
export async function deleteConversation(userId: string, id: string): Promise<void> {
  await scoped(userId, async db => {
    const r = await db.query("DELETE FROM conversations WHERE user_id=$1 AND id=$2 RETURNING id", [userId,id]);
    if (!r.rows.length) throw new StoreError(404,"Nie znaleziono rozmowy.");
  });
}
export async function appendTurn(userId: string, conversationId: string, content: string, modelId: string, requestId: string): Promise<SendResult> {
  const cleaned = content.trim();
  if (cleaned.length < 2 || cleaned.length > 20000) throw new StoreError(400,"Wiadomość musi mieć 2–20000 znaków.");
  return scoped(userId, async db => {
    const c = await db.query("SELECT id,title FROM conversations WHERE user_id=$1 AND id=$2 FOR UPDATE", [userId,conversationId]);
    if (!c.rows.length) throw new StoreError(404,"Nie znaleziono rozmowy.");
    const prior = await db.query(
      "SELECT user_message_id,assistant_message_id FROM chat_turns WHERE user_id=$1 AND client_request_id=$2",
      [userId,requestId],
    );
    let user: Message, assistant: Message;
    if (prior.rows.length) {
      const r = prior.rows[0];
      const existing = await db.query(
        "SELECT * FROM messages WHERE user_id=$1 AND conversation_id=$2 AND id=ANY($3::uuid[])",
        [userId,conversationId,[r.user_message_id,r.assistant_message_id]],
      );
      if (existing.rows.length !== 2) throw new StoreError(409,"Identyfikator żądania wykorzystano w innej rozmowie.");
      user = message(existing.rows.find(x=>x.role==="user")!);
      assistant = message(existing.rows.find(x=>x.role==="assistant")!);
    } else {
      // The upstream timeout is 80s. Close replies left streaming after a crashed process.
      await db.query(
        "WITH stale AS (UPDATE messages SET status='interrupted',error_code='interrupted',updated_at=now() " +
        "WHERE user_id=$1 AND conversation_id=$2 AND role='assistant' AND status='streaming' " +
        "AND created_at < now() - interval '3 minutes' RETURNING id) " +
        "UPDATE chat_turns SET status='interrupted',updated_at=now() WHERE user_id=$1 AND conversation_id=$2 " +
        "AND assistant_message_id IN (SELECT id FROM stale)", [userId,conversationId],
      );
      const active = await db.query(
        "SELECT 1 FROM messages WHERE user_id=$1 AND conversation_id=$2 AND role='assistant' AND status='streaming'",
        [userId,conversationId],
      );
      if (active.rows.length) throw new StoreError(409,"Poczekaj na zakończenie poprzedniej odpowiedzi.");
      const uid=randomUUID(),aid=randomUUID();
      const messages = await db.query(
        "INSERT INTO messages (id,conversation_id,user_id,role,content,status,execution_id) VALUES " +
        "($1,$3,$4,'user',$5,'completed',NULL),($2,$3,$4,'assistant','','streaming',$2) " +
        "RETURNING *",
        [uid,aid,conversationId,userId,cleaned],
      );
      user = message(messages.rows.find(x=>x.role==="user")!);
      assistant = message(messages.rows.find(x=>x.role==="assistant")!);
      await db.query(
        "INSERT INTO chat_turns (id,user_id,conversation_id,client_request_id,user_message_id,assistant_message_id,model_id,status) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')",
        [randomUUID(),userId,conversationId,requestId,uid,aid,modelId],
      );
      await db.query(
        "UPDATE conversations SET title=CASE WHEN title='Nowa rozmowa' AND " +
        "(SELECT count(*) FROM messages WHERE user_id=$1 AND conversation_id=$2)=2 THEN $3 ELSE title END," +
        "updated_at=now() WHERE id=$2 AND user_id=$1",
        [userId,conversationId,cleaned.slice(0,46)],
      );
    }
    return {user,assistant,execution:execution(conversationId,assistant.id,assistant.createdAt)};
  });
}
export async function beginReply(userId: string, conversationId: string, assistantId: string, kind: "glm" | "cockpit"):
  Promise<{history: {role:"user"|"assistant";content:string}[];modelId:string}> {
  return scoped(userId, async db => {
    const turn = await db.query(
      "SELECT t.id,t.model_id,t.status,m.status AS message_status FROM chat_turns t " +
      "JOIN messages m ON m.id=t.assistant_message_id AND m.user_id=t.user_id " +
      "WHERE t.user_id=$1 AND t.conversation_id=$2 AND t.assistant_message_id=$3 FOR UPDATE OF t",
      [userId,conversationId,assistantId],
    );
    if (!turn.rows.length) throw new StoreError(404,"Nie znaleziono odpowiedzi.");
    const t=turn.rows[0];
    if (t.status!=="pending" || t.message_status!=="streaming") throw new StoreError(409,"Odpowiedź została już uruchomiona.");
    if (kind==="glm" && t.model_id!=="glm") throw new StoreError(400,"Błędny wybór modelu.");
    if (kind==="cockpit" && t.model_id==="glm") throw new StoreError(400,"Błędny wybór modelu.");
    await db.query(
      "UPDATE chat_turns SET status='running',updated_at=now() WHERE id=$1 AND user_id=$2", [t.id,userId],
    );
    const result=await db.query(
      "SELECT role,content FROM messages WHERE user_id=$1 AND conversation_id=$2 " +
      "AND status='completed' AND role IN ('user','assistant') AND length(content)>0 " +
      "ORDER BY ordinal DESC LIMIT 40", [userId,conversationId],
    );
    return {modelId:String(t.model_id), history:result.rows.reverse().map(r=>({role:r.role,content:r.content}))};
  });
}
export async function finishReply(userId:string,conversationId:string,assistantId:string,
  status:"completed"|"error"|"interrupted",content:string,errorCode?:string):Promise<void> {
  await scoped(userId, async db => {
    const m=await db.query(
      "UPDATE messages SET content=$4,status=$5,error_code=$6,updated_at=now() " +
      "WHERE user_id=$1 AND conversation_id=$2 AND id=$3 AND role='assistant' AND status='streaming' RETURNING id",
      [userId,conversationId,assistantId,content.slice(0,200000),status,errorCode||null],
    );
    if (!m.rows.length) throw new StoreError(409,"Wiadomość została już zamknięta.");
    await db.query(
      "UPDATE chat_turns SET status=$4,updated_at=now() WHERE user_id=$1 AND conversation_id=$2 " +
      "AND assistant_message_id=$3 AND status='running'",
      [userId,conversationId,assistantId,status],
    );
    await db.query("UPDATE conversations SET updated_at=now() WHERE user_id=$1 AND id=$2",[userId,conversationId]);
  });
}
