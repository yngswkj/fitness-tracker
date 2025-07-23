import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { sql } from '@vercel/postgres'
import {
    ensureValidToken,
    getFitbitActivityData,
    getFitbitHeartRateData,
    getFitbitSleepData,
    getFitbitBodyData,
    FitbitTokens
} from '@/lib/fitbit'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id
        const { startDate, endDate, dataTypes = ['activity', 'heart', 'sleep', 'body'] } = await request.json()

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
        }

        // 日付の妥当性チェック
        const start = new Date(startDate)
        const end = new Date(endDate)
        const today = new Date()

        if (start > end) {
            return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 })
        }

        if (end > today) {
            return NextResponse.json({ error: 'endDate cannot be in the future' }, { status: 400 })
        }

        // 期間が長すぎる場合の制限（1年以内）
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff > 365) {
            return NextResponse.json({ error: 'Import period cannot exceed 365 days' }, { status: 400 })
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

        // インポート対象の日付リストを生成
        const dates = []
        const currentDate = new Date(start)
        while (currentDate <= end) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // 既存データをチェック
        const { rows: existingData } = await sql`
            SELECT date FROM fitbit_data 
            WHERE user_id = ${userId} 
            AND date >= ${startDate} 
            AND date <= ${endDate}
        `

        const existingDates = new Set(existingData.map(row => row.date))
        const newDates = dates.filter(date => !existingDates.has(date))
        const duplicateDates = dates.filter(date => existingDates.has(date))

        return NextResponse.json({
            success: true,
            importPlan: {
                totalDays: dates.length,
                newDays: newDates.length,
                duplicateDays: duplicateDates.length,
                startDate,
                endDate,
                dataTypes,
                newDates: newDates.slice(0, 10), // 最初の10日分のみ表示
                duplicateDates: duplicateDates.slice(0, 10)
            }
        })

    } catch (error) {
        console.error('Import history preparation error:', error)
        return NextResponse.json(
            { error: 'Failed to prepare import', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id
        const {
            startDate,
            endDate,
            dataTypes = ['activity', 'heart', 'sleep', 'body'],
            overwriteExisting = false,
            batchSize = 5
        } = await request.json()

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

        // トークンの有効性を確認
        const validTokens = await ensureValidToken(tokens)
        if (!validTokens) {
            return NextResponse.json(
                { error: 'Fitbitトークンの更新に失敗しました' },
                { status: 400 }
            )
        }
        tokens = validTokens

        // インポート対象の日付リストを生成
        const dates = []
        const currentDate = new Date(startDate)
        const endDateObj = new Date(endDate)

        while (currentDate <= endDateObj) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // 既存データをチェック（上書きしない場合）
        let targetDates = dates
        if (!overwriteExisting) {
            const { rows: existingData } = await sql`
                SELECT date FROM fitbit_data 
                WHERE user_id = ${userId} 
                AND date >= ${startDate} 
                AND date <= ${endDate}
            `
            const existingDates = new Set(existingData.map(row => row.date))
            targetDates = dates.filter(date => !existingDates.has(date))
        }

        const results = []
        let processedCount = 0
        let successCount = 0
        let errorCount = 0

        // バッチ処理でデータを取得・保存
        for (let i = 0; i < targetDates.length; i += batchSize) {
            const batch = targetDates.slice(i, i + batchSize)

            for (const date of batch) {
                try {
                    const result = await importFitbitDataForDate(userId, date, tokens.access_token, dataTypes, overwriteExisting)
                    results.push(result)

                    if (result.success) {
                        successCount++
                    } else {
                        errorCount++
                    }

                    processedCount++

                    // API制限を避けるため待機（成功時は1秒）
                    await new Promise(resolve => setTimeout(resolve, 1000))

                } catch (error) {
                    console.error(`Failed to import data for ${date}:`, error)

                    // レート制限エラーの場合は長めに待機
                    if (error instanceof Error && error.message.includes('429')) {
                        console.log(`Rate limit hit for ${date}, waiting 60 seconds...`)
                        await new Promise(resolve => setTimeout(resolve, 60000)) // 60秒待機
                    }

                    results.push({
                        date,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    })
                    errorCount++
                    processedCount++

                    // エラー時は追加で待機
                    await new Promise(resolve => setTimeout(resolve, 2000))
                }
            }

            // バッチ間でより長い待機
            if (i + batchSize < targetDates.length) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        return NextResponse.json({
            success: errorCount === 0 || successCount > 0,
            summary: {
                totalDays: targetDates.length,
                processedDays: processedCount,
                successfulImports: successCount,
                failedImports: errorCount,
                startDate,
                endDate,
                dataTypes,
                overwriteExisting
            },
            results: results.slice(-20) // 最新の20件のみ返す
        })

    } catch (error) {
        console.error('Import history execution error:', error)
        return NextResponse.json(
            { error: 'Failed to execute import', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

async function importFitbitDataForDate(
    userId: string,
    date: string,
    accessToken: string,
    dataTypes: string[],
    overwriteExisting: boolean
) {
    try {
        // 順次処理でデータを取得（レート制限回避）
        let activityData = null
        let heartRateData = null
        let sleepData = null
        let bodyData = null

        // 各データタイプを順次取得し、間に待機時間を設ける
        if (dataTypes.includes('activity')) {
            try {
                activityData = await getFitbitActivityData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
            } catch (error) {
                console.warn(`Failed to fetch activity data for ${date}:`, error)
            }
        }

        if (dataTypes.includes('heart')) {
            try {
                heartRateData = await getFitbitHeartRateData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
            } catch (error) {
                console.warn(`Failed to fetch heart rate data for ${date}:`, error)
            }
        }

        if (dataTypes.includes('sleep')) {
            try {
                sleepData = await getFitbitSleepData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
            } catch (error) {
                console.warn(`Failed to fetch sleep data for ${date}:`, error)
            }
        }

        if (dataTypes.includes('body')) {
            try {
                bodyData = await getFitbitBodyData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 2000)) // 体重データは2秒待機（より厳しい制限）
            } catch (error) {
                console.warn(`Failed to fetch body data for ${date}:`, error)
                // 体重データのエラーは特に429が多いので、さらに長く待機
                if (error instanceof Error && error.message.includes('429')) {
                    await new Promise(resolve => setTimeout(resolve, 5000))
                }
            }
        }

        // データベースに保存
        if (overwriteExisting) {
            // 上書きモード：UPSERT
            await sql`
                INSERT INTO fitbit_data (
                    user_id, date, steps, calories_burned, distance_km, active_minutes,
                    sleep_hours, resting_heart_rate, weight, body_fat, synced_at
                )
                VALUES (
                    ${userId}, ${date},
                    ${activityData?.steps || null},
                    ${activityData?.calories_burned || null},
                    ${activityData?.distance_km || null},
                    ${activityData?.active_minutes || null},
                    ${sleepData?.sleep_hours || null},
                    ${heartRateData?.resting_heart_rate || null},
                    ${bodyData?.weight || null},
                    ${bodyData?.body_fat || null},
                    NOW()
                )
                ON CONFLICT (user_id, date)
                DO UPDATE SET
                    steps = EXCLUDED.steps,
                    calories_burned = EXCLUDED.calories_burned,
                    distance_km = EXCLUDED.distance_km,
                    active_minutes = EXCLUDED.active_minutes,
                    sleep_hours = EXCLUDED.sleep_hours,
                    resting_heart_rate = EXCLUDED.resting_heart_rate,
                    weight = EXCLUDED.weight,
                    body_fat = EXCLUDED.body_fat,
                    synced_at = NOW()
            `
        } else {
            // 新規のみモード：INSERT IGNORE
            await sql`
                INSERT INTO fitbit_data (
                    user_id, date, steps, calories_burned, distance_km, active_minutes,
                    sleep_hours, resting_heart_rate, weight, body_fat, synced_at
                )
                VALUES (
                    ${userId}, ${date},
                    ${activityData?.steps || null},
                    ${activityData?.calories_burned || null},
                    ${activityData?.distance_km || null},
                    ${activityData?.active_minutes || null},
                    ${sleepData?.sleep_hours || null},
                    ${heartRateData?.resting_heart_rate || null},
                    ${bodyData?.weight || null},
                    ${bodyData?.body_fat || null},
                    NOW()
                )
                ON CONFLICT (user_id, date) DO NOTHING
            `
        }

        return {
            date,
            success: true,
            data: {
                steps: activityData?.steps || 0,
                calories: activityData?.calories_burned || 0,
                sleep_hours: sleepData?.sleep_hours || 0,
                heart_rate: heartRateData?.resting_heart_rate || null,
                weight: bodyData?.weight || null
            }
        }

    } catch (error) {
        console.error(`Import error for ${date}:`, error)
        return {
            date,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}