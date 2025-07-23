import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.redirect(new URL('/auth/signin', request.url))
        }

        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        // エラーチェック
        if (error) {
            console.error('Fitbit OAuth error:', error)
            return NextResponse.redirect(new URL('/settings?error=fitbit_auth_failed', request.url))
        }

        if (!code) {
            return NextResponse.redirect(new URL('/settings?error=missing_code', request.url))
        }

        // 状態の検証
        if (state !== session.user.id) {
            return NextResponse.redirect(new URL('/settings?error=invalid_state', request.url))
        }

        // アクセストークンを取得
        const tokenResponse = await exchangeCodeForToken(code)
        if (!tokenResponse) {
            return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url))
        }

        // トークンをデータベースに保存
        await saveTokens(session.user.id, tokenResponse)

        // ユーザープロフィールを取得してユーザーIDを更新
        const userProfile = await getFitbitUserProfile(tokenResponse.access_token)
        if (userProfile) {
            await updateUserFitbitId(session.user.id, userProfile.user.encodedId)
        }

        return NextResponse.redirect(new URL('/settings?success=fitbit_connected', request.url))

    } catch (error) {
        console.error('Fitbit callback error:', error)
        return NextResponse.redirect(new URL('/settings?error=callback_failed', request.url))
    }
}

async function exchangeCodeForToken(code: string) {
    try {
        const clientId = process.env.FITBIT_CLIENT_ID
        const clientSecret = process.env.FITBIT_CLIENT_SECRET
        const redirectUri = `${process.env.NEXTAUTH_URL}/api/fitbit/callback`

        if (!clientId || !clientSecret) {
            throw new Error('Fitbit credentials not configured')
        }

        const response = await fetch('https://api.fitbit.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code: code,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Token exchange failed:', errorText)
            return null
        }

        return await response.json()
    } catch (error) {
        console.error('Token exchange error:', error)
        return null
    }
}

async function saveTokens(userId: string, tokenData: any) {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    await sql`
    INSERT INTO fitbit_tokens (user_id, access_token, refresh_token, expires_at)
    VALUES (${userId}, ${tokenData.access_token}, ${tokenData.refresh_token}, ${expiresAt})
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `
}

async function getFitbitUserProfile(accessToken: string) {
    try {
        const response = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        })

        if (!response.ok) {
            return null
        }

        return await response.json()
    } catch (error) {
        console.error('Failed to get Fitbit user profile:', error)
        return null
    }
}

async function updateUserFitbitId(userId: string, fitbitUserId: string) {
    await sql`
    UPDATE users 
    SET fitbit_user_id = ${fitbitUserId}, updated_at = NOW()
    WHERE id = ${userId}
  `
}