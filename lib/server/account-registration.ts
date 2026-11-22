import "server-only";
import { scoped } from "./db";
const policy = require("@/lib/osa-jeff/policy.cjs") as {
  isAllowedGoogleProfile: (profile: unknown) => boolean;
  isConfigured: () => boolean;
};
export async function registerGoogleUser(profile: unknown): Promise<boolean> {
  if (!policy.isConfigured() || !policy.isAllowedGoogleProfile(profile)) return false;
  const data = profile as { sub: string; email: string; name?: string };
  const email = data.email.trim().toLowerCase();
  try {
    return await scoped(data.sub, async db => {
      const result = await db.query(
        "INSERT INTO users (id, email, display_name, enabled) VALUES ($1,$2,$3,true) " +
        "ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name, last_seen_at=now() " +
        "WHERE users.email=EXCLUDED.email AND users.enabled=true RETURNING id",
        [data.sub, email, (data.name || "").slice(0, 120)],
      );
      return result.rowCount === 1;
    });
  } catch {
    return false;
  }
}
