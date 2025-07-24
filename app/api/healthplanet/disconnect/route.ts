import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        // HealthPlanetトークンを削除
        await sql`
            DELETE FROM healthplanet_tokens
            WHERE user_id = ${userId}
        `

        return NextResponse.json({
            success: true,
            message: 'HealthPlanetアカウントの連携を解除しました'
        })

    } catch (error) {
        console.error('HealthPlanet disconnect error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}