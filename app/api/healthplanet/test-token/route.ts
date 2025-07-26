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

        const userId = session.user.id

        // HealthPlanetトークンを取得
        const { rows: tokenRows } = await sql`
            SELECT access_token, expires_at, updated_at
            FROM healthplanet_tokens
            WHERE user_id = ${userId}
        `

        if (tokenRows.length === 0) {
            return NextResponse.json(
                { error: 'HealthPlanetアカウントが連携されていません' },
                { status: 400 }
            )
        }

        const token = tokenRows[0].access_token
        const expiresAt = new Date(tokenRows[0].expires_at)
        const updatedAt = new Date(tokenRows[0].updated_at)

        console.log('Testing HealthPlanet token:')
        console.log('User ID:', userId)
        console.log('Token length:', token.length)
        console.log('Token starts with:', token.substring(0, 10) + '...')
        console.log('Expires at:', expiresAt.toISOString())
        console.log('Updated at:', updatedAt.toISOString())
        console.log('Current time:', new Date().toISOString())

        // トークンの有効期限チェック
        if (expiresAt <= new Date()) {
            return NextResponse.json({
                error: 'Token expired',
                expiresAt: expiresAt.toISOString(),
                currentTime: new Date().toISOString()
            }, { status: 401 })
        }

        // 今日の日付でテスト
        const today = new Date().toISOString().split('T')[0]
        const formattedDate = today.replace(/-/g, '')

        // HealthPlanet APIをテスト
        // トークンにスラッシュ（/）が含まれるためURLエンコードが必要
        const apiUrl = `https://www.healthplanet.jp/status/innerscan.json?access_token=${encodeURIComponent(token)}&date=${formattedDate}&tag=6021,6022`

        console.log(`Testing HealthPlanet API for date: ${today} (formatted: ${formattedDate})`)

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FitnessTrackingApp/1.0'
            }
        })

        console.log(`HealthPlanet API response status: ${response.status}`)
        console.log(`HealthPlanet API response headers:`, Object.fromEntries(response.headers.entries()))

        const responseText = await response.text()
        console.log(`HealthPlanet API response body: ${responseText}`)

        let responseData
        try {
            responseData = JSON.parse(responseText)
        } catch (e) {
            responseData = { raw: responseText }
        }

        return NextResponse.json({
            tokenInfo: {
                length: token.length,
                prefix: token.substring(0, 10) + '...',
                expiresAt: expiresAt.toISOString(),
                updatedAt: updatedAt.toISOString(),
                isExpired: expiresAt <= new Date()
            },
            apiTest: {
                url: `https://www.healthplanet.jp/status/innerscan.json?access_token=***&date=${formattedDate}&tag=6021,6022`,
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                data: responseData
            }
        })

    } catch (error) {
        console.error('HealthPlanet token test error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}