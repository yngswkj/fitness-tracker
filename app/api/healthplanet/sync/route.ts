import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { sql } from '@vercel/postgres'
import {
    ensureValidHealthPlanetToken,
    getHealthPlanetData,
    HealthPlanetTokens
} from '@/lib/healthplanet'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id
        const { fromDate, toDate } = await request.json()

        // デフォルトで過去30日間
        const defaultToDate = new Date().toISOString().split('T')[0]
        const defaultFromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const syncFromDate = fromDate || defaultFromDate
        const syncToDate = toDate || defaultToDate

        // HealthPlanetトークンを取得
        const { rows: tokenRows } = await sql`
            SELECT access_token, refresh_token, expires_at
            FROM healthplanet_tokens
            WHERE user_id = ${userId}
        `

        if (tokenRows.length === 0) {
            return NextResponse.json(
                { error: 'HealthPlanetアカウントが連携されていません' },
                { status: 400 }
            )
        }

        let tokens: HealthPlanetTokens = {
            access_token: tokenRows[0].access_token,
            refresh_token: tokenRows[0].refresh_token,
            expires_at: new Date(tokenRows[0].expires_at)
        }

        // トークンの有効性を確認し、必要に応じてリフレッシュ
        const validTokens = await ensureValidHealthPlanetToken(tokens)
        if (!validTokens) {
            return NextResponse.json(
                { error: 'HealthPlanetトークンの更新に失敗しました' },
                { status: 400 }
            )
        }

        // トークンが更新された場合はデータベースに保存
        if (validTokens.access_token !== tokens.access_token) {
            await sql`
                UPDATE healthplanet_tokens
                SET 
                    access_token = ${validTokens.access_token},
                    refresh_token = ${validTokens.refresh_token},
                    expires_at = ${validTokens.expires_at.toISOString()},
                    updated_at = NOW()
                WHERE user_id = ${userId}
            `
            tokens = validTokens
        }

        // デバッグ: トークン情報を確認
        console.log('HealthPlanet Sync Debug:')
        console.log('Access Token:', tokens.access_token.substring(0, 20) + '...')
        console.log('From Date:', syncFromDate)
        console.log('To Date:', syncToDate)

        // HealthPlanetからデータを取得
        const healthPlanetData = await getHealthPlanetData(syncFromDate, syncToDate, tokens.access_token)

        const syncResults = []
        let successCount = 0
        let errorCount = 0

        // 各日付のデータをfitbit_dataテーブルに統合
        for (const data of healthPlanetData) {
            try {
                await sql`
                    INSERT INTO fitbit_data (
                        user_id, date, weight, body_fat, synced_at
                    )
                    VALUES (
                        ${userId}, ${data.date}, ${data.weight || null}, ${data.body_fat || null}, NOW()
                    )
                    ON CONFLICT (user_id, date)
                    DO UPDATE SET
                        weight = COALESCE(EXCLUDED.weight, fitbit_data.weight),
                        body_fat = COALESCE(EXCLUDED.body_fat, fitbit_data.body_fat),
                        synced_at = NOW()
                `

                syncResults.push({
                    date: data.date,
                    success: true,
                    data: {
                        weight: data.weight,
                        body_fat: data.body_fat
                    }
                })
                successCount++

            } catch (error) {
                console.error(`Failed to sync HealthPlanet data for ${data.date}:`, error)
                syncResults.push({
                    date: data.date,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
                errorCount++
            }
        }

        return NextResponse.json({
            success: true,
            message: `HealthPlanetデータ同期が完了しました`,
            summary: {
                period: `${syncFromDate} 〜 ${syncToDate}`,
                totalRecords: healthPlanetData.length,
                successfulSyncs: successCount,
                failedSyncs: errorCount
            },
            results: syncResults
        })

    } catch (error) {
        console.error('HealthPlanet sync error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}