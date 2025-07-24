import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const clientId = process.env.HEALTHPLANET_CLIENT_ID
        const redirectUri = process.env.HEALTHPLANET_REDIRECT_URI

        // デバッグログ
        console.log('HealthPlanet Auth Debug:')
        console.log('Client ID:', clientId)
        console.log('Redirect URI:', redirectUri)

        if (!clientId || !redirectUri) {
            return NextResponse.json(
                { error: 'HealthPlanet credentials not configured' },
                { status: 500 }
            )
        }

        // 認証用のstateパラメータを生成（セキュリティのため）
        const state = Buffer.from(JSON.stringify({
            userId: session.user.id,
            timestamp: Date.now()
        })).toString('base64')

        // HealthPlanet APIの正しい認証エンドポイントを使用
        // 公式ドキュメントに基づいて修正
        const authUrl = 'https://www.healthplanet.jp/oauth/auth' +
            '?client_id=' + encodeURIComponent(clientId) +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&scope=' + encodeURIComponent('innerscan') +
            '&response_type=' + encodeURIComponent('code') +
            '&state=' + encodeURIComponent(state)

        // 生成されたURLをログ出力
        console.log('Generated Auth URL:', authUrl)
        console.log('URL Parameters:')
        console.log('- client_id:', clientId)
        console.log('- redirect_uri:', redirectUri)
        console.log('- scope: innerscan')
        console.log('- response_type: code')
        console.log('- state:', state)

        // URLの長さとエンコーディングを確認
        console.log('URL Length:', authUrl.length)
        console.log('Encoded Redirect URI:', encodeURIComponent(redirectUri))

        return NextResponse.json({
            authUrl: authUrl,
            debug: {
                clientId,
                redirectUri,
                urlLength: authUrl.length
            }
        })

    } catch (error) {
        console.error('HealthPlanet auth error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}