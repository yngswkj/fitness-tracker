import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { getHealthPlanetDataSummary } from '@/lib/healthplanet'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        // HealthPlanetトークンの存在確認
        const { rows: tokenRows } = await sql`
            SELECT expires_at, updated_at
            FROM healthplanet_tokens
            WHERE user_id = ${userId}
        `

        if (tokenRows.length === 0) {
            return NextResponse.json({
                connected: false
            })
        }

        const token = tokenRows[0]
        const expiresAt = new Date(token.expires_at)
        const now = new Date()

        // データサマリーを取得
        const dataSummary = await getHealthPlanetDataSummary(userId, 30)

        return NextResponse.json({
            connected: true,
            tokenExpired: expiresAt < now,
            expiresAt: expiresAt.toISOString(),
            lastSync: dataSummary?.last_sync || null,
            summary: {
                daysWithWeight: parseInt(dataSummary?.days_with_weight || '0'),
                daysWithBodyFat: parseInt(dataSummary?.days_with_body_fat || '0'),
                averageWeight: dataSummary?.avg_weight ? Math.round(parseFloat(dataSummary.avg_weight) * 10) / 10 : null,
                averageBodyFat: dataSummary?.avg_body_fat ? Math.round(parseFloat(dataSummary.avg_body_fat) * 10) / 10 : null
            }
        })

    } catch (error) {
        console.error('HealthPlanet status error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}