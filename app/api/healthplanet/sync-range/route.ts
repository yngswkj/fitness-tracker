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

        if (!fromDate || !toDate) {
            return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 })
        }

        // 日付の妥当性チェック
        const from = new Date(fromDate)
        const to = new Date(toDate)
        const today = new Date()

        if (from > to) {
            return NextResponse.json({ error: 'fromDate must be before toDate' }, { status: 400 })
        }

        if (to > today) {
            return NextResponse.json({ error: 'toDate cannot be in the future' }, { status: 400 })
        }

        // 3ヶ月制限チェック
        const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000
        const dateDiff = to.getTime() - from.getTime()

        let adjustedFromDate = fromDate
        if (dateDiff > threeMonthsInMs) {
            const adjustedFrom = new Date(to.getTime() - threeMonthsInMs)
            adjustedFromDate = adjustedFrom.toISOString().split('T')[0]
            console.log(`Date range exceeds 3 months. Adjusted from ${fromDate} to ${adjustedFromDate}`)
        }

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

        // 対象日付を生成
        const dates = []
        const currentDate = new Date(adjustedFromDate)
        const endDate = new Date(toDate)
        while (currentDate <= endDate) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // 未取得またはweightがNULLの日付を特定
        const { rows: existingData } = await sql`
            SELECT date FROM fitbit_data 
            WHERE user_id = ${userId} 
            AND date = ANY(${dates})
            AND weight IS NOT NULL
        `

        const existingDates = new Set(existingData.map(row => row.date))
        const targetDates = dates.filter(date => !existingDates.has(date))

        console.log(`HealthPlanet Sync Range: ${adjustedFromDate} to ${toDate}`)
        console.log(`Total dates: ${dates.length}, Target dates: ${targetDates.length}`)

        if (targetDates.length === 0) {
            return NextResponse.json({
                success: true,
                message: '対象期間内に同期が必要なデータはありません',
                summary: {
                    totalDays: dates.length,
                    processedDays: 0,
                    successfulSyncs: 0,
                    failedSyncs: 0
                }
            })
        }

        // HealthPlanetからデータを取得（一括取得）
        const healthPlanetData = await getHealthPlanetData(adjustedFromDate, toDate, tokens.access_token)

        const syncResults = []
        let successCount = 0
        let errorCount = 0

        // 取得したデータをfitbit_dataテーブルに統合
        for (const data of healthPlanetData) {
            // 対象日付のみ処理
            if (!targetDates.includes(data.date)) {
                continue
            }

            try {
                await sql`
                    INSERT INTO fitbit_data (
                        user_id, date, weight, body_fat, synced_at
                    )
                    VALUES (
                        ${userId}, 
                        ${data.date},
                        ${data.weight || null},
                        ${data.body_fat || null},
                        NOW()
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

        // 対象日付にデータがない場合の処理
        for (const date of targetDates) {
            const hasData = healthPlanetData.some(item => item.date === date)
            if (!hasData) {
                // データがない日付もDBに記録（weightとbody_fatはNULLのまま）
                try {
                    await sql`
                        INSERT INTO fitbit_data (user_id, date, synced_at)
                        VALUES (${userId}, ${date}, NOW())
                        ON CONFLICT (user_id, date)
                        DO UPDATE SET synced_at = NOW()
                    `

                    syncResults.push({
                        date,
                        success: true,
                        data: { weight: null, body_fat: null }
                    })
                    successCount++
                } catch (error) {
                    console.error(`Failed to record no-data entry for ${date}:`, error)
                    errorCount++
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `${successCount}日分のデータを同期しました`,
            summary: {
                totalDays: dates.length,
                processedDays: targetDates.length,
                successfulSyncs: successCount,
                failedSyncs: errorCount,
                dataFound: healthPlanetData.length,
                dateRangeAdjusted: adjustedFromDate !== fromDate
            },
            results: syncResults.slice(-10) // 最新の10件のみ返す
        })

    } catch (error) {
        console.error('HealthPlanet range sync error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}