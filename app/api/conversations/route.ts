import { requireUser } from "@/lib/server/account";
import { createConversation, listConversations } from "@/lib/server/chat-store";
import { fail, guardMutation, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ conversations: await listConversations(user.id) });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  const denied=guardMutation(request); if (denied) return denied;
  try {
    const user=await requireUser();
    return json({ conversation: await createConversation(user.id) }, 201);
  } catch (error) { return fail(error); }
}
