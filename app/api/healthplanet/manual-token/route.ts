import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { sql } from '@vercel/postgres'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id
        const { access_token, refresh_token, expires_in } = await request.json()

        // 必須パラメータの確認
        if (!access_token || !refresh_token || !expires_in) {
            return NextResponse.json(
                { error: 'access_token, refresh_token, expires_in are required' },
                { status: 400 }
            )
        }

        // expires_inから有効期限を計算
        const expiresAt = new Date(Date.now() + expires_in * 1000)

        console.log('Manual HealthPlanet token registration:')
        console.log('User ID:', userId)
        console.log('Access Token:', access_token.substring(0, 20) + '...')
        console.log('Refresh Token:', refresh_token.substring(0, 20) + '...')
        console.log('Expires At:', expiresAt.toISOString())

        // トークンをデータベースに保存
        await sql`
            INSERT INTO healthplanet_tokens (
                user_id, access_token, refresh_token, expires_at, created_at, updated_at
            )
            VALUES (
                ${userId}, 
                ${access_token}, 
                ${refresh_token}, 
                ${expiresAt.toISOString()}, 
                NOW(), 
                NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
        `

        return NextResponse.json({
            success: true,
            message: 'HealthPlanetトークンが正常に登録されました',
            data: {
                userId,
                expiresAt: expiresAt.toISOString(),
                expiresInDays: Math.round(expires_in / (24 * 60 * 60))
            }
        })

    } catch (error) {
        console.error('Manual token registration error:', error)
        return NextResponse.json(
            { error: 'トークン登録中にエラーが発生しました' },
            { status: 500 }
        )
    }
}