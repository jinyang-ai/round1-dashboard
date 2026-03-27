import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        // Check password against environment variable
        if (credentials.password === process.env.DASHBOARD_PASSWORD) {
          return {
            id: "grapevine-team",
            email: "team@grapevine.in",
            name: "Grapevine Team",
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: "jwt",
  },
});
