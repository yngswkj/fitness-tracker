import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { sql } from '@vercel/postgres'
import {
    ensureValidToken,
    getFitbitActivityData,
    getFitbitHeartRateData,
    getFitbitSleepData,
    FitbitTokens
} from '@/lib/fitbit'

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
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(23, 59, 59, 999)

        if (from > to) {
            return NextResponse.json({ error: 'fromDate must be before toDate' }, { status: 400 })
        }

        if (to > yesterday) {
            return NextResponse.json({ error: 'toDate must be yesterday or earlier' }, { status: 400 })
        }

        // Fitbitトークンを取得
        const { rows: tokenRows } = await sql`
            SELECT access_token, refresh_token, expires_at
            FROM fitbit_tokens
            WHERE user_id = ${userId}
        `

        if (tokenRows.length === 0) {
            return NextResponse.json(
                { error: 'Fitbitアカウントが連携されていません' },
                { status: 400 }
            )
        }

        let tokens: FitbitTokens = {
            access_token: tokenRows[0].access_token,
            refresh_token: tokenRows[0].refresh_token,
            expires_at: new Date(tokenRows[0].expires_at)
        }

        // トークンの有効性を確認し、必要に応じてリフレッシュ
        const validTokens = await ensureValidToken(tokens)
        if (!validTokens) {
            return NextResponse.json(
                { error: 'Fitbitトークンの更新に失敗しました' },
                { status: 400 }
            )
        }

        // トークンが更新された場合はデータベースに保存
        if (validTokens.access_token !== tokens.access_token) {
            await sql`
                UPDATE fitbit_tokens
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
        const currentDate = new Date(from)
        while (currentDate <= to) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // 未取得またはstepsがNULLの日付を特定
        const { rows: existingData } = await sql`
            SELECT date FROM fitbit_data 
            WHERE user_id = ${userId} 
            AND date = ANY(${dates})
            AND steps IS NOT NULL
        `

        const existingDates = new Set(existingData.map(row => row.date))
        const targetDates = dates.filter(date => !existingDates.has(date))

        console.log(`Fitbit Sync Range: ${fromDate} to ${toDate}`)
        console.log(`Total dates: ${dates.length}, Target dates: ${targetDates.length}`)

        if (targetDates.length === 0) {
            return NextResponse.json({
                success: true,
                message: '対象期間内に同期が必要なデータはありません',
                summary: {
                    totalDays: dates.length,
                    processedDays: 0,
                    successfulSyncs: 0,
                    failedSyncs: 0,
                    rateLimitHit: false
                }
            })
        }

        const syncResults = []
        let successCount = 0
        let errorCount = 0
        let rateLimitHit = false

        // 各日付のデータを同期（レート制限対応）
        for (const date of targetDates) {
            try {
                const result = await syncFitbitDataForDateWithRateLimit(userId, date, tokens.access_token)
                syncResults.push(result)

                if (result.success) {
                    successCount++
                } else {
                    errorCount++

                    // レート制限エラーの場合は処理を中断
                    if (result.rateLimitError) {
                        rateLimitHit = true
                        console.log(`Rate limit hit at ${date}, stopping sync process`)
                        break
                    }
                }

                // API制限を避けるため待機（成功時は1秒、エラー時は2秒）
                await new Promise(resolve => setTimeout(resolve, result.success ? 1000 : 2000))

            } catch (error) {
                console.error(`Failed to sync data for ${date}:`, error)
                syncResults.push({
                    date,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    rateLimitError: false
                })
                errorCount++
            }
        }

        const message = rateLimitHit
            ? `${successCount}日分のデータを同期しました（レート制限により中断）`
            : `${successCount}日分のデータを同期しました`

        return NextResponse.json({
            success: true,
            message,
            summary: {
                totalDays: dates.length,
                processedDays: syncResults.length,
                successfulSyncs: successCount,
                failedSyncs: errorCount,
                rateLimitHit
            },
            results: syncResults.slice(-10) // 最新の10件のみ返す
        })

    } catch (error) {
        console.error('Fitbit range sync error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

async function syncFitbitDataForDateWithRateLimit(userId: string, date: string, accessToken: string) {
    try {
        // 順次処理でデータを取得（レート制限回避）
        let activityData = null
        let heartRateData = null
        let sleepData = null
        let errors: string[] = []

        // 活動データ取得
        try {
            activityData = await getFitbitActivityData(date, accessToken)
            await new Promise(resolve => setTimeout(resolve, 1500))
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.warn(`Failed to fetch activity data for ${date}:`, errorMsg)
            errors.push(`Activity: ${errorMsg}`)

            if (error instanceof Error && error.message.includes('429')) {
                return { date, success: false, error: 'Rate limit exceeded', rateLimitError: true }
            }
        }

        // 心拍数データ取得
        try {
            heartRateData = await getFitbitHeartRateData(date, accessToken)
            await new Promise(resolve => setTimeout(resolve, 1500))
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.warn(`Failed to fetch heart rate data for ${date}:`, errorMsg)
            errors.push(`Heart Rate: ${errorMsg}`)

            if (error instanceof Error && error.message.includes('429')) {
                return { date, success: false, error: 'Rate limit exceeded', rateLimitError: true }
            }
        }

        // 睡眠データ取得
        try {
            sleepData = await getFitbitSleepData(date, accessToken)
            await new Promise(resolve => setTimeout(resolve, 1500))
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.warn(`Failed to fetch sleep data for ${date}:`, errorMsg)
            errors.push(`Sleep: ${errorMsg}`)

            if (error instanceof Error && error.message.includes('429')) {
                return { date, success: false, error: 'Rate limit exceeded', rateLimitError: true }
            }
        }

        // すべてのデータ取得に失敗した場合はエラーとする
        if (!activityData && !heartRateData && !sleepData) {
            return {
                date,
                success: false,
                error: `All data fetch failed: ${errors.join(', ')}`,
                rateLimitError: false
            }
        }

        // データベースに保存（UPSERT）- 体重・体脂肪はHealthPlanetから取得するため除外
        await sql`
            INSERT INTO fitbit_data (
                user_id, date, steps, calories_burned, distance_km, active_minutes,
                sleep_hours, resting_heart_rate, synced_at
            )
            VALUES (
                ${userId}, ${date},
                ${activityData?.steps || null},
                ${activityData?.calories_burned || null},
                ${activityData?.distance_km || null},
                ${activityData?.active_minutes || null},
                ${sleepData?.sleep_hours || null},
                ${heartRateData?.resting_heart_rate || null},
                NOW()
            )
            ON CONFLICT (user_id, date)
            DO UPDATE SET
                steps = COALESCE(EXCLUDED.steps, fitbit_data.steps),
                calories_burned = COALESCE(EXCLUDED.calories_burned, fitbit_data.calories_burned),
                distance_km = COALESCE(EXCLUDED.distance_km, fitbit_data.distance_km),
                active_minutes = COALESCE(EXCLUDED.active_minutes, fitbit_data.active_minutes),
                sleep_hours = COALESCE(EXCLUDED.sleep_hours, fitbit_data.sleep_hours),
                resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, fitbit_data.resting_heart_rate),
                synced_at = NOW()
        `

        return {
            date,
            success: true,
            data: {
                steps: activityData?.steps || 0,
                calories: activityData?.calories_burned || 0,
                sleep_hours: sleepData?.sleep_hours || 0,
                heart_rate: heartRateData?.resting_heart_rate || null
            },
            rateLimitError: false
        }

    } catch (error) {
        console.error(`Sync error for ${date}:`, error)
        return {
            date,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            rateLimitError: error instanceof Error && error.message.includes('429')
        }
    }
}