import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { registerGoogleUser } from "@/lib/server/account-registration";
const policy = require("./lib/osa-jeff/policy.cjs") as {
  isAllowedGoogleProfile: (profile: unknown) => boolean;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !policy.isAllowedGoogleProfile(profile)) return false;
      return registerGoogleUser(profile);
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && typeof profile?.sub === "string") token.sub = profile.sub;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = typeof token.sub === "string" ? token.sub : "";
      return session;
    },
  },
});
