import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

// 使用済みコードのキャッシュ（メモリベース、10分間保持）
const usedCodes = new Map<string, number>()

// 古いコードを定期的にクリーンアップ
setInterval(() => {
    const now = Date.now()
    usedCodes.forEach((timestamp, code) => {
        if (now - timestamp > 10 * 60 * 1000) { // 10分経過
            usedCodes.delete(code)
        }
    })
}, 5 * 60 * 1000) // 5分ごとにクリーンアップ

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { code: rawCode, state } = await request.json()

        if (!rawCode || !state) {
            return NextResponse.json({ error: 'Code and state are required' }, { status: 400 })
        }

        // コードをトリムして余分な空白を除去
        const code = rawCode.trim()

        if (!code) {
            return NextResponse.json({ error: 'Code cannot be empty' }, { status: 400 })
        }

        // stateを検証
        let stateData
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        } catch {
            return NextResponse.json({ error: 'Invalid state format' }, { status: 400 })
        }

        if (stateData.userId !== session.user.id) {
            return NextResponse.json({ error: 'Invalid state - user mismatch' }, { status: 400 })
        }

        // stateの有効期限チェック（10分以内）
        if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
            return NextResponse.json({ error: 'State expired' }, { status: 400 })
        }

        // 開発環境でのみ実行可能
        if (!stateData.isDevelopment) {
            return NextResponse.json({ error: 'Manual code input only available in development' }, { status: 400 })
        }

        const clientId = process.env.HEALTHPLANET_CLIENT_ID
        const clientSecret = process.env.HEALTHPLANET_CLIENT_SECRET

        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: 'HealthPlanet credentials not configured' }, { status: 500 })
        }

        console.log('Processing manual code for user:', session.user.id)
        console.log('Code length:', code.length)
        console.log('Code starts with:', code.substring(0, 10) + '...')
        console.log('State timestamp:', new Date(stateData.timestamp).toISOString())

        // 最近使用されたコードかチェック（同じコードの重複使用を防ぐ）
        const codeKey = `${session.user.id}:${code}`
        if (usedCodes.has(codeKey)) {
            console.log('Code already used recently:', code.substring(0, 10) + '...')
            return NextResponse.json({
                error: 'このコードは既に使用されています。新しいコードを取得してください。',
                code_length: code.length
            }, { status: 400 })
        }

        // コードを使用済みとしてマーク
        usedCodes.set(codeKey, Date.now())

        const codeHash = Buffer.from(code).toString('base64').substring(0, 20)
        console.log('Code hash (first 20 chars):', codeHash)

        // 認証コードをアクセストークンに交換
        console.log('Attempting token exchange with:')
        console.log('Client ID:', clientId)
        console.log('Client Secret length:', clientSecret.length)
        console.log('Code length:', code.length)
        console.log('Redirect URI:', 'https://www.healthplanet.jp/success.html')

        const tokenResponse = await fetch('https://www.healthplanet.jp/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'FitnessTrackingApp/1.0'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: 'https://www.healthplanet.jp/success.html',
                code: code,
                grant_type: 'authorization_code',
            }),
        })

        console.log('Token exchange response status:', tokenResponse.status)
        console.log('Token exchange response headers:', Object.fromEntries(tokenResponse.headers.entries()))

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            console.error('Token exchange failed:')
            console.error('Status:', tokenResponse.status)
            console.error('Status Text:', tokenResponse.statusText)
            console.error('Response:', errorText)
            console.error('Code used:', code.substring(0, 10) + '...')
            console.error('Code length:', code.length)

            let errorMessage = 'Token exchange failed'
            if (tokenResponse.status === 400) {
                errorMessage = '認証コードが無効または期限切れです。新しいコードを取得してください。'
            } else if (tokenResponse.status === 401) {
                errorMessage = 'クライアント認証に失敗しました。設定を確認してください。'
            }

            return NextResponse.json({
                error: errorMessage,
                details: errorText,
                status: tokenResponse.status,
                code_length: code.length,
                debug_info: {
                    code_preview: code.substring(0, 10) + '...',
                    timestamp: new Date().toISOString()
                }
            }, { status: 400 })
        }

        const tokenData = await tokenResponse.json()
        console.log('Token exchange successful:')
        console.log('Full token response:', JSON.stringify(tokenData, null, 2))
        console.log('Token data keys:', Object.keys(tokenData))
        console.log('Access token:', tokenData.access_token ? 'present' : 'missing')
        console.log('Access token length:', tokenData.access_token?.length || 'undefined')
        console.log('Access token starts with:', tokenData.access_token?.substring(0, 10) + '...' || 'undefined')
        console.log('Expires in:', tokenData.expires_in)
        console.log('Token type:', tokenData.token_type)
        console.log('Refresh token:', tokenData.refresh_token ? 'present' : 'not present')
        console.log('Success with code length:', code.length)
        console.log('Success with code preview:', code.substring(0, 10) + '...')

        // アクセストークンが存在しない場合はエラー
        if (!tokenData.access_token) {
            console.error('No access_token in response:', tokenData)
            return NextResponse.json({
                error: 'No access token received from HealthPlanet',
                details: tokenData
            }, { status: 400 })
        }

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        // トークンをデータベースに保存
        console.log('Saving HealthPlanet token:')
        console.log('User ID:', session.user.id)
        console.log('Access token length:', tokenData.access_token.length)
        console.log('Access token starts with:', tokenData.access_token.substring(0, 10) + '...')
        console.log('Expires at:', expiresAt.toISOString())

        await sql`
            INSERT INTO healthplanet_tokens (
                user_id, access_token, refresh_token, expires_at, created_at, updated_at
            )
            VALUES (
                ${session.user.id}, ${tokenData.access_token}, ${tokenData.refresh_token}, 
                ${expiresAt.toISOString()}, NOW(), NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
        `

        console.log('HealthPlanet token saved successfully for user:', session.user.id)

        return NextResponse.json({
            success: true,
            message: 'HealthPlanet連携が完了しました'
        })

    } catch (error) {
        console.error('Manual code processing error:', error)
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}