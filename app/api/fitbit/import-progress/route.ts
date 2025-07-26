import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
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
        try {
            const validTokens = await ensureValidToken(tokens, userId)
            if (!validTokens) {
                return NextResponse.json(
                    {
                        error: 'FITBIT_REAUTH_REQUIRED',
                        title: 'Fitbitの再認証が必要です',
                        message: 'Fitbitのアクセストークンが無効になったため、データ同期を継続できません。以下の手順で再認証を行ってください。',
                        instructions: [
                            '1. 下の「設定ページへ」ボタンをクリック',
                            '2. Fitbit連携セクションで「Fitbitと連携」をクリック',
                            '3. Fitbitアカウントでログインして認証を完了',
                            '4. 再度データ同期を実行'
                        ],
                        action: 'reauth',
                        actionUrl: '/settings'
                    },
                    { status: 401 }
                )
            }
            tokens = validTokens
        } catch (error) {
            if (error instanceof Error && error.message === 'FITBIT_TOKEN_INVALID') {
                return NextResponse.json(
                    {
                        error: 'FITBIT_REAUTH_REQUIRED',
                        title: 'Fitbitの再認証が必要です',
                        message: 'Fitbitのアクセストークンが無効になったため、データ同期を継続できません。以下の手順で再認証を行ってください。',
                        instructions: [
                            '1. 下の「設定ページへ」ボタンをクリック',
                            '2. Fitbit連携セクションで「Fitbitと連携」をクリック',
                            '3. Fitbitアカウントでログインして認証を完了',
                            '4. 再度データ同期を実行'
                        ],
                        action: 'reauth',
                        actionUrl: '/settings'
                    },
                    { status: 401 }
                )
            }
            return NextResponse.json(
                {
                    error: 'FITBIT_REAUTH_REQUIRED',
                    title: 'Fitbitの再認証が必要です',
                    message: 'Fitbitトークンの確認中にエラーが発生しました。再認証を行ってください。',
                    instructions: [
                        '1. 下の「設定ページへ」ボタンをクリック',
                        '2. Fitbit連携セクションで「Fitbitと連携」をクリック',
                        '3. Fitbitアカウントでログインして認証を完了',
                        '4. 再度データ同期を実行'
                    ],
                    action: 'reauth',
                    actionUrl: '/settings'
                },
                { status: 401 }
            )
        }

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

        // Server-Sent Events のレスポンスを設定
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            start(controller) {
                // 初期状態を送信
                const initialData = {
                    type: 'start',
                    totalDays: targetDates.length,
                    processedDays: 0,
                    successfulImports: 0,
                    failedImports: 0,
                    remainingDays: targetDates.length,
                    currentDate: null,
                    progress: 0
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`))

                // 非同期でインポート処理を実行
                processImport(controller, encoder, userId, targetDates, tokens.access_token, dataTypes, overwriteExisting, batchSize)
                    .catch(error => {
                        console.error('Import process error:', error)
                        const errorData = {
                            type: 'error',
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
                        controller.close()
                    })
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            }
        })

    } catch (error) {
        console.error('Import progress API error:', error)
        return NextResponse.json(
            { error: 'Failed to start import', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

async function processImport(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    userId: string,
    targetDates: string[],
    accessToken: string,
    dataTypes: string[],
    overwriteExisting: boolean,
    batchSize: number
) {
    let processedCount = 0
    let successCount = 0
    let errorCount = 0
    const results: any[] = []

    try {
        // バッチ処理でデータを取得・保存
        for (let i = 0; i < targetDates.length; i += batchSize) {
            const batch = targetDates.slice(i, i + batchSize)

            for (const date of batch) {
                try {
                    // 現在処理中の日付を送信
                    const progressData = {
                        type: 'progress',
                        totalDays: targetDates.length,
                        processedDays: processedCount,
                        successfulImports: successCount,
                        failedImports: errorCount,
                        remainingDays: targetDates.length - processedCount,
                        currentDate: date,
                        progress: Math.round((processedCount / targetDates.length) * 100)
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`))

                    const result = await importFitbitDataForDate(userId, date, accessToken, dataTypes, overwriteExisting)
                    results.push(result)

                    if (result.success) {
                        successCount++
                    } else {
                        errorCount++
                    }

                    processedCount++

                    // 進捗更新を送信
                    const updatedProgressData = {
                        type: 'progress',
                        totalDays: targetDates.length,
                        processedDays: processedCount,
                        successfulImports: successCount,
                        failedImports: errorCount,
                        remainingDays: targetDates.length - processedCount,
                        currentDate: date,
                        progress: Math.round((processedCount / targetDates.length) * 100),
                        lastResult: result
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(updatedProgressData)}\n\n`))

                    // API制限を避けるため待機
                    await new Promise(resolve => setTimeout(resolve, 1000))

                } catch (error) {
                    console.error(`Failed to import data for ${date}:`, error)

                    // レート制限エラーの場合は処理を中断
                    if (error instanceof Error && error.message.includes('429')) {
                        console.log(`Rate limit hit for ${date}, stopping import process`)

                        // レート制限エラーで処理中断の通知を送信
                        const rateLimitErrorData = {
                            type: 'rate_limit_error',
                            message: 'API制限に達したため、処理を中断しました。1時間後に再度実行してください。',
                            processedDays: processedCount,
                            successfulImports: successCount,
                            failedImports: errorCount,
                            remainingDays: targetDates.length - processedCount,
                            totalDays: targetDates.length,
                            lastProcessedDate: date
                        }
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(rateLimitErrorData)}\n\n`))
                        controller.close()
                        return // 処理を中断
                    }

                    const errorResult = {
                        date,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                    results.push(errorResult)
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

        // 完了通知を送信
        const completeData = {
            type: 'complete',
            summary: {
                totalDays: targetDates.length,
                processedDays: processedCount,
                successfulImports: successCount,
                failedImports: errorCount,
                startDate: targetDates[0],
                endDate: targetDates[targetDates.length - 1],
                dataTypes,
                overwriteExisting
            },
            results: results.slice(-20) // 最新の20件のみ
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`))

    } catch (error) {
        console.error('Process import error:', error)
        const errorData = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
    } finally {
        controller.close()
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
        // let bodyData = null // 体重・体脂肪データはHealthPlanetから取得するため不要

        // 各データタイプを順次取得し、間に待機時間を設ける
        if (dataTypes.includes('activity')) {
            try {
                activityData = await getFitbitActivityData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 1500))
            } catch (error) {
                console.warn(`Failed to fetch activity data for ${date}:`, error)
            }
        }

        if (dataTypes.includes('heart')) {
            try {
                heartRateData = await getFitbitHeartRateData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 1500))
            } catch (error) {
                console.warn(`Failed to fetch heart rate data for ${date}:`, error)
            }
        }

        if (dataTypes.includes('sleep')) {
            try {
                sleepData = await getFitbitSleepData(date, accessToken)
                await new Promise(resolve => setTimeout(resolve, 1500))
            } catch (error) {
                console.warn(`Failed to fetch sleep data for ${date}:`, error)
            }
        }

        // 体重・体脂肪データはHealthPlanetから取得するため、Fitbitからは取得しない
        // if (dataTypes.includes('body')) {
        //     try {
        //         bodyData = await getFitbitBodyData(date, accessToken)
        //         await new Promise(resolve => setTimeout(resolve, 2000))
        //     } catch (error) {
        //         console.warn(`Failed to fetch body data for ${date}:`, error)
        //         if (error instanceof Error && error.message.includes('429')) {
        //             await new Promise(resolve => setTimeout(resolve, 5000))
        //         }
        //     }
        // }

        // データベースに保存（体重・体脂肪はHealthPlanetから取得するため除外）
        if (overwriteExisting) {
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
                    steps = EXCLUDED.steps,
                    calories_burned = EXCLUDED.calories_burned,
                    distance_km = EXCLUDED.distance_km,
                    active_minutes = EXCLUDED.active_minutes,
                    sleep_hours = EXCLUDED.sleep_hours,
                    resting_heart_rate = EXCLUDED.resting_heart_rate,
                    synced_at = NOW()
            `
        } else {
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
        }

        return {
            date,
            success: true,
            data: {
                steps: activityData?.steps || 0,
                calories: activityData?.calories_burned || 0,
                sleep_hours: sleepData?.sleep_hours || 0,
                heart_rate: heartRateData?.resting_heart_rate || null
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