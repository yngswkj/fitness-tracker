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

        // Fitbitトークンの存在確認
        const { rows } = await sql`
      SELECT 
        access_token,
        refresh_token,
        expires_at,
        updated_at
      FROM fitbit_tokens 
      WHERE user_id = ${session.user.id}
    `

        if (rows.length === 0) {
            return NextResponse.json({
                connected: false
            })
        }

        const token = rows[0]
        const now = new Date()
        const expiresAt = new Date(token.expires_at)
        const isExpired = now >= expiresAt

        // 最後の同期時間を取得
        const { rows: syncRows } = await sql`
      SELECT MAX(synced_at) as last_sync
      FROM fitbit_data
      WHERE user_id = ${session.user.id}
    `

        return NextResponse.json({
            connected: true,
            tokenExpired: isExpired,
            lastSync: syncRows[0]?.last_sync || null,
            tokenUpdatedAt: token.updated_at
        })

    } catch (error) {
        console.error('Fitbit status check error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}