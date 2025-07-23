import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        if (error) {
            console.error('HealthPlanet OAuth error:', error)
            return NextResponse.redirect(
                new URL('/settings?error=healthplanet_auth_failed', request.url)
            )
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?error=missing_code', request.url)
            )
        }

        // stateパラメータを検証
        let stateData
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        } catch {
            return NextResponse.redirect(
                new URL('/settings?error=invalid_state', request.url)
            )
        }

        const { userId, timestamp } = stateData

        // stateの有効期限チェック（10分以内）
        if (Date.now() - timestamp > 10 * 60 * 1000) {
            return NextResponse.redirect(
                new URL('/settings?error=expired_state', request.url)
            )
        }

        // 認証コードをアクセストークンに交換
        const clientId = process.env.HEALTHPLANET_CLIENT_ID
        const clientSecret = process.env.HEALTHPLANET_CLIENT_SECRET
        const redirectUri = process.env.HEALTHPLANET_REDIRECT_URI

        if (!clientId || !clientSecret || !redirectUri) {
            return NextResponse.redirect(
                new URL('/settings?error=server_config_error', request.url)
            )
        }

        const tokenResponse = await fetch('https://www.healthplanet.jp/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code,
                grant_type: 'authorization_code',
            }),
        })

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            console.error('HealthPlanet token exchange failed:', errorText)
            return NextResponse.redirect(
                new URL('/settings?error=token_exchange_failed', request.url)
            )
        }

        const tokenData = await tokenResponse.json()
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        // トークンをデータベースに保存
        await sql`
            INSERT INTO healthplanet_tokens (
                user_id, access_token, refresh_token, expires_at, created_at, updated_at
            )
            VALUES (
                ${userId}, ${tokenData.access_token}, ${tokenData.refresh_token}, 
                ${expiresAt.toISOString()}, NOW(), NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
        `

        return NextResponse.redirect(
            new URL('/settings?success=healthplanet_connected', request.url)
        )

    } catch (error) {
        console.error('HealthPlanet callback error:', error)
        return NextResponse.redirect(
            new URL('/settings?error=callback_failed', request.url)
        )
    }
}