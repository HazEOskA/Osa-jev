import "server-only";
import { scoped } from "./db";
import { auth } from "@/auth";
const policy = require("@/lib/osa-jeff/policy.cjs") as {
  allowedEmails: () => Set<string>;
  isConfigured: () => boolean;
};

export class AccessError extends Error {
  constructor(public code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_CONFIGURED") {
    super(code);
  }
}
export async function requireUser(): Promise<{ id: string; email: string }> {
  if (!policy.isConfigured()) throw new AccessError("NOT_CONFIGURED");
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!id || !email) throw new AccessError("UNAUTHORIZED");
  if (!policy.allowedEmails().has(email)) throw new AccessError("FORBIDDEN");
  const found = await scoped(id, async db =>
    db.query("SELECT id FROM users WHERE id=$1 AND email=$2 AND enabled=true", [id, email]),
  );
  if (found.rowCount !== 1) throw new AccessError("FORBIDDEN");
  return { id, email };
}
