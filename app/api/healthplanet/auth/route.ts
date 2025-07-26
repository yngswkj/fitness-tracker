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
        const isDevelopment = process.env.NODE_ENV === 'development'

        // 開発環境では公式fallback URLを使用
        const redirectUri = isDevelopment
            ? 'https://www.healthplanet.jp/success.html'
            : process.env.HEALTHPLANET_REDIRECT_URI

        console.log('HealthPlanet Auth Debug:')
        console.log('Environment:', process.env.NODE_ENV)
        console.log('Client ID:', clientId)
        console.log('Redirect URI:', redirectUri)
        console.log('Is Development:', isDevelopment)

        if (!clientId) {
            return NextResponse.json(
                { error: 'HealthPlanet client ID not configured' },
                { status: 500 }
            )
        }

        if (!isDevelopment && !process.env.HEALTHPLANET_REDIRECT_URI) {
            return NextResponse.json(
                { error: 'HealthPlanet redirect URI not configured for production' },
                { status: 500 }
            )
        }

        // 認証用のstateパラメータを生成（開発環境フラグを追加）
        const state = Buffer.from(JSON.stringify({
            userId: session.user.id,
            timestamp: Date.now(),
            isDevelopment // 開発環境フラグを追加
        })).toString('base64')

        const authUrl = 'https://www.healthplanet.jp/oauth/auth' +
            '?client_id=' + encodeURIComponent(clientId) +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&scope=' + encodeURIComponent('innerscan') +
            '&response_type=' + encodeURIComponent('code') +
            '&state=' + encodeURIComponent(state)

        console.log('Generated Auth URL:', authUrl)

        return NextResponse.json({
            authUrl: authUrl,
            isDevelopment,
            manualCodeRequired: isDevelopment,
            state: state, // フロントエンドで手動コード処理に使用
            instructions: isDevelopment ? [
                '1. 上記URLでHealthPlanet認証を完了',
                '2. success.htmlページのURL末尾からcode=の値をコピー',
                '3. 下の入力欄にコードを貼り付けて「連携完了」をクリック'
            ] : undefined
        })

    } catch (error) {
        console.error('HealthPlanet auth error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}