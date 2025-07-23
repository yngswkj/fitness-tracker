import NextAuth, { NextAuthOptions, Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { JWT } from 'next-auth/jwt'

// 拡張された Session 型を定義
interface ExtendedSession extends Session {
    user: {
        id: string
        name?: string | null
        email?: string | null
        image?: string | null
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                try {
                    const { rows } = await sql`
            SELECT id, email, name, password_hash 
            FROM users 
            WHERE email = ${credentials.email}
          `

                    if (rows.length === 0) {
                        return null
                    }

                    const user = rows[0]
                    const isValid = await bcrypt.compare(credentials.password, user.password_hash)

                    if (!isValid) {
                        return null
                    }

                    return {
                        id: user.id.toString(),
                        email: user.email,
                        name: user.name,
                    }
                } catch (error) {
                    console.error('Auth error:', error)
                    return null
                }
            }
        })
    ],
    session: {
        strategy: 'jwt',
    },
    pages: {
        signIn: '/auth/signin',
    },
    callbacks: {
        async jwt({ token, user }: { token: JWT; user: any }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
        async session({ session, token }: { session: Session; token: JWT }): Promise<ExtendedSession> {
            if (token && token.id) {
                return {
                    ...session,
                    user: {
                        ...session.user,
                        id: token.id as string
                    }
                } as ExtendedSession
            }
            return session as ExtendedSession
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }