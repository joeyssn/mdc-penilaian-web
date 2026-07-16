import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

// --- DUMMY ACCOUNTS FOR TESTING ---
const DUMMY_USERS = [
  { id: "1", name: "Admin Utama", nis_niy: "admin123", password: "password", role: "admin" },
  { id: "2", name: "Ferry Biru", nis_niy: "teacher123", password: "password", role: "teacher" },
  { id: "3", name: "Arwindo", nis_niy: "student123", password: "password", role: "student" },
];

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        nis_niy: { label: "NIS / NIY", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.nis_niy || !credentials?.password) return null;

        // 1. CHECK DUMMY ACCOUNTS FIRST
        const dummyUser = DUMMY_USERS.find(
          (u) => u.nis_niy === credentials.nis_niy && u.password === credentials.password
        );

        // If a dummy account matches, log them in immediately
        if (dummyUser) {
          return {
            id: dummyUser.id,
            name: dummyUser.name,
            nis_niy: dummyUser.nis_niy,
            role: dummyUser.role, 
          };
        }

        // 2. CHECK REAL DATABASE (If it's not a dummy account)
        const user = await prisma.user.findFirst({
          where: { nis_niy: credentials.nis_niy }
        });

        if (!user) return null; 
        
        const isPasswordValid = credentials.password === user.password;
        if (!isPasswordValid) return null;

        return {
          id: user.id.toString(),
          name: user.name,
          nis_niy: user.nis_niy,
          role: user.role || "student", 
        };
      }
    })
  ],
  // This section ensures the "role" gets saved into the browser session
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.nis_niy = user.nis_niy;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.nis_niy = token.nis_niy as string;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  }
});

export { handler as GET, handler as POST };