import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        // Fitbitトークンを取得
        const { rows: tokenRows } = await sql`
            SELECT access_token, refresh_token, expires_at, created_at, updated_at
            FROM fitbit_tokens
            WHERE user_id = ${userId}
        `

        if (tokenRows.length === 0) {
            return NextResponse.json({ error: 'No Fitbit token found' }, { status: 404 })
        }

        const token = tokenRows[0]
        const now = new Date()
        const expiresAt = new Date(token.expires_at)
        const createdAt = new Date(token.created_at)
        const updatedAt = new Date(token.updated_at)

        const timeUntilExpiry = expiresAt.getTime() - now.getTime()
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60)
        const timeSinceCreated = now.getTime() - createdAt.getTime()
        const hoursSinceCreated = timeSinceCreated / (1000 * 60 * 60)

        return NextResponse.json({
            tokenInfo: {
                accessToken: token.access_token.substring(0, 10) + '...',
                refreshToken: token.refresh_token.substring(0, 10) + '...',
                expiresAt: expiresAt.toISOString(),
                createdAt: createdAt.toISOString(),
                updatedAt: updatedAt.toISOString(),
                currentTime: now.toISOString(),
                hoursUntilExpiry: hoursUntilExpiry.toFixed(2),
                hoursSinceCreated: hoursSinceCreated.toFixed(2),
                isExpired: timeUntilExpiry <= 0,
                needsRefresh: timeUntilExpiry < 30 * 60 * 1000
            }
        })

    } catch (error) {
        console.error('Debug token API error:', error)
        return NextResponse.json(
            { error: 'Failed to get token info', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}