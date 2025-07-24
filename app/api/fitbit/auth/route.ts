import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            console.error('No session or user ID found')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const clientId = process.env.FITBIT_CLIENT_ID
        const nextAuthUrl = process.env.NEXTAUTH_URL

        console.log('Environment check:', {
            clientId: clientId ? 'Set' : 'Not set',
            nextAuthUrl: nextAuthUrl ? 'Set' : 'Not set',
            userId: session.user.id
        })

        if (!clientId || clientId === 'your-actual-fitbit-client-id') {
            console.error('FITBIT_CLIENT_ID environment variable not set or still placeholder')
            return NextResponse.json({
                error: 'Fitbit client ID not configured',
                details: 'Please set up your Fitbit Developer Console app and update FITBIT_CLIENT_ID in .env.local'
            }, { status: 500 })
        }

        if (!nextAuthUrl) {
            console.error('NEXTAUTH_URL environment variable not set')
            return NextResponse.json({
                error: 'NextAuth URL not configured',
                details: 'NEXTAUTH_URL environment variable is missing'
            }, { status: 500 })
        }

        // OAuth認証用のURLを生成
        const redirectUri = `${nextAuthUrl}/api/fitbit/callback`
        const scope = 'activity heartrate location nutrition profile settings sleep social weight'
        const state = session.user.id // セキュリティのためユーザーIDを状態として使用

        const authUrl = new URL('https://www.fitbit.com/oauth2/authorize')
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('client_id', clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('scope', scope)
        authUrl.searchParams.set('state', state)

        console.log('Generated auth URL:', authUrl.toString())

        return NextResponse.json({
            authUrl: authUrl.toString()
        })

    } catch (error) {
        console.error('Fitbit auth URL generation error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}