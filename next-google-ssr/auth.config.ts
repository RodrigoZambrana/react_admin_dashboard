import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const config = {
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;

export default config;
