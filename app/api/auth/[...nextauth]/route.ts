import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || 'default-development-secret',
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          return null
        }

        const isValidPassword = await verifyPassword(credentials.password, user.password)

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin'
  },
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        if (typeof token.sub === 'string') {
          session.user = {
            ...session.user,
            id: token.sub
          }
        }
      }
      return session
    }
  }
})

export { handler as GET, handler as POST }