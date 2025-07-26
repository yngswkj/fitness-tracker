import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

/**
 * 無効なHealthPlanetトークンをデータベースから削除
 */
async function invalidateHealthPlanetToken(userId: string): Promise<void> {
    try {
        await sql`
            DELETE FROM healthplanet_tokens 
            WHERE user_id = ${userId}
        `
        console.log(`Invalidated HealthPlanet token for user ${userId}`)
    } catch (error) {
        console.error('Failed to invalidate HealthPlanet token:', error)
    }
}

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
            batchSize = 5
        } = await request.json()

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

        console.log('Retrieved HealthPlanet token for import:')
        console.log('User ID:', userId)
        console.log('Token length:', token.length)
        console.log('Token starts with:', token.substring(0, 10) + '...')
        console.log('Expires at:', expiresAt.toISOString())
        console.log('Updated at:', updatedAt.toISOString())
        console.log('Current time:', new Date().toISOString())

        // トークンの有効期限チェック
        if (expiresAt <= new Date()) {
            // 期限切れトークンを削除
            await invalidateHealthPlanetToken(userId)

            return NextResponse.json(
                {
                    error: 'HEALTHPLANET_REAUTH_REQUIRED',
                    title: 'HealthPlanetの再認証が必要です',
                    message: 'HealthPlanetのアクセストークンの有効期限が切れました。設定ページで再度連携してください。',
                    instructions: [
                        '1. 下の「設定ページへ」ボタンをクリック',
                        '2. HealthPlanet連携セクションで「HealthPlanetと連携」をクリック',
                        '3. HealthPlanetアカウントでログインして認証を完了',
                        '4. 再度データ同期を実行'
                    ],
                    action: 'reauth',
                    actionUrl: '/settings'
                },
                { status: 401 }
            )
        }

        // 期間制限（最大3ヶ月）
        const start = new Date(startDate)
        const end = new Date(endDate)
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

        let adjustedEndDate = endDate
        let dateRangeAdjusted = false

        if (daysDiff > 90) {
            const maxEndDate = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)
            adjustedEndDate = maxEndDate.toISOString().split('T')[0]
            dateRangeAdjusted = true
        }

        // インポート対象の日付リストを生成
        const dates = []
        const currentDate = new Date(start)
        const endDateObj = new Date(adjustedEndDate)

        while (currentDate <= endDateObj) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }

        // 既存データをチェック
        const { rows: existingData } = await sql`
            SELECT date FROM fitbit_data 
            WHERE user_id = ${userId} 
            AND date >= ${startDate} 
            AND date <= ${adjustedEndDate}
            AND (weight IS NOT NULL OR body_fat IS NOT NULL)
        `
        const existingDates = new Set(existingData.map(row => row.date))
        const targetDates = dates.filter(date => !existingDates.has(date))

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
                    progress: 0,
                    dateRangeAdjusted
                }
                safeStreamWrite(controller, encoder, initialData)

                // 非同期でインポート処理を実行
                processHealthPlanetImport(controller, encoder, userId, targetDates, token, batchSize)
                    .catch(error => {
                        console.error('HealthPlanet import process error:', error)
                        const errorData = {
                            type: 'error',
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }
                        safeStreamWrite(controller, encoder, errorData)
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
        console.error('HealthPlanet import progress API error:', error)
        return NextResponse.json(
            { error: 'Failed to start import', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

// ストリーム書き込みを安全に行うヘルパー関数
function safeStreamWrite(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: any): boolean {
    try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        return true
    } catch (error) {
        console.error('Stream write error:', error)
        return false
    }
}

async function processHealthPlanetImport(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    userId: string,
    targetDates: string[],
    accessToken: string,
    batchSize: number
) {
    let processedCount = 0
    let successCount = 0
    let errorCount = 0
    const results: any[] = []
    let authErrorOccurred = false

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
                    safeStreamWrite(controller, encoder, progressData)

                    const result = await importHealthPlanetDataForDate(userId, date, accessToken)
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
                    safeStreamWrite(controller, encoder, updatedProgressData)

                    // API制限を避けるため待機
                    await new Promise(resolve => setTimeout(resolve, 1000))

                } catch (error) {
                    console.error(`Failed to import HealthPlanet data for ${date}:`, error)
                    console.log(`Error type: ${typeof error}, Error message: ${error instanceof Error ? error.message : 'Unknown'}`)

                    // 認証エラーの場合は処理を中断
                    if (error instanceof Error && error.message === 'HEALTHPLANET_TOKEN_INVALID') {
                        console.log(`HealthPlanet token invalid for ${date}, stopping import process`)

                        // 無効なトークンを削除
                        await invalidateHealthPlanetToken(userId)

                        // 認証エラーで処理中断の通知を送信
                        const authErrorData = {
                            type: 'auth_error',
                            message: 'HealthPlanetのアクセストークンが無効になったため、データ同期を継続できません。以下の手順で再認証を行ってください。',
                            title: 'HealthPlanetの再認証が必要です',
                            instructions: [
                                '1. 下の「設定ページへ」ボタンをクリック',
                                '2. HealthPlanet連携セクションで「HealthPlanetと連携」をクリック',
                                '3. HealthPlanetアカウントでログインして認証を完了',
                                '4. 再度データ同期を実行'
                            ],
                            actionUrl: '/settings',
                            processedDays: processedCount,
                            successfulImports: successCount,
                            failedImports: errorCount,
                            remainingDays: targetDates.length - processedCount,
                            totalDays: targetDates.length,
                            lastProcessedDate: date
                        }
                        console.log('Sending auth_error event:', authErrorData)
                        safeStreamWrite(controller, encoder, authErrorData)
                        authErrorOccurred = true
                        if (!controller.desiredSize === null) {
                            try {
                                controller.close()
                            } catch (closeError) {
                                console.error('Stream close error:', closeError)
                            }
                        }
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

        // 認証エラーが発生した場合は完了通知を送信しない
        if (authErrorOccurred) {
            return
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
                endDate: targetDates[targetDates.length - 1]
            },
            results: results.slice(-20) // 最新の20件のみ
        }
        safeStreamWrite(controller, encoder, completeData)

    } catch (error) {
        console.error('Process HealthPlanet import error:', error)
        const errorData = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }
        safeStreamWrite(controller, encoder, errorData)
    } finally {
        if (!controller.desiredSize === null) {
            try {
                controller.close()
            } catch (closeError) {
                console.error('Stream close error in finally:', closeError)
            }
        }
    }
}

async function importHealthPlanetDataForDate(
    userId: string,
    date: string,
    accessToken: string
) {
    try {
        // HealthPlanet APIから体重・体脂肪率データを取得
        // 日付を正しい形式に変換（YYYYMMDD形式）
        const formattedDate = date.replace(/-/g, '')

        // HealthPlanet APIの正しいエンドポイント
        // tag: 6021=体重, 6022=体脂肪率
        // 公式仕様に従い: date=0, from/toパラメータを使用
        // 日時フォーマット: YYYYMMDDHHMMSS（秒まで指定）
        const fromDateTime = `${formattedDate}000000`  // 00:00:00
        const toDateTime = `${formattedDate}235959`    // 23:59:59
        const apiUrl = `https://www.healthplanet.jp/status/innerscan.json?access_token=${encodeURIComponent(accessToken)}&tag=6021,6022&date=0&from=${fromDateTime}&to=${toDateTime}`

        console.log(`HealthPlanet API request for ${date} (formatted: ${formattedDate}):`)
        console.log(`URL (token masked): https://www.healthplanet.jp/status/innerscan.json?access_token=***&tag=6021,6022&date=0&from=${fromDateTime}&to=${toDateTime}`)
        console.log(`Token length: ${accessToken.length}`)
        console.log(`Token starts with: ${accessToken.substring(0, 10)}...`)
        console.log(`Token is numeric: ${/^\d+/.test(accessToken)}`)

        // トークンが数字で始まる場合は警告
        if (/^\d+/.test(accessToken)) {
            console.warn('WARNING: Access token starts with numbers, this may not be a valid HealthPlanet token')
        }

        // 方法1: クエリパラメータでアクセストークンを送信（現在の方法）
        let response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FitnessTrackingApp/1.0'
            }
        })

        // 401エラーの場合、Authorizationヘッダーでも試してみる
        if (response.status === 401) {
            console.log('Query parameter method failed, trying Authorization header...')
            const apiUrlWithoutToken = `https://www.healthplanet.jp/status/innerscan.json?tag=6021,6022&date=0&from=${fromDateTime}&to=${toDateTime}`
            response = await fetch(apiUrlWithoutToken, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'FitnessTrackingApp/1.0'
                }
            })
            console.log(`Authorization header method response status: ${response.status}`)
        }

        console.log(`HealthPlanet API response status: ${response.status}`)
        console.log(`HealthPlanet API response headers:`, Object.fromEntries(response.headers.entries()))

        if (!response.ok) {
            const responseText = await response.text()
            console.log(`HealthPlanet API error response body: ${responseText}`)

            if (response.status === 401) {
                console.log('Throwing HEALTHPLANET_TOKEN_INVALID error')
                throw new Error('HEALTHPLANET_TOKEN_INVALID')
            }
            throw new Error(`HealthPlanet API error: ${response.status} - ${responseText}`)
        }

        const data = await response.json()
        let weight = null
        let bodyFat = null

        if (data.data && Array.isArray(data.data)) {
            for (const item of data.data) {
                if (item.tag === '6021') { // 体重
                    weight = parseFloat(item.keydata)
                } else if (item.tag === '6022') { // 体脂肪率
                    bodyFat = parseFloat(item.keydata)
                }
            }
        }

        // データベースに保存（既存データがある場合は更新）
        await sql`
            INSERT INTO fitbit_data (
                user_id, date, weight, body_fat, synced_at
            )
            VALUES (
                ${userId}, ${date}, ${weight}, ${bodyFat}, NOW()
            )
            ON CONFLICT (user_id, date)
            DO UPDATE SET
                weight = COALESCE(EXCLUDED.weight, fitbit_data.weight),
                body_fat = COALESCE(EXCLUDED.body_fat, fitbit_data.body_fat),
                synced_at = NOW()
        `

        return {
            date,
            success: true,
            data: {
                weight,
                body_fat: bodyFat
            }
        }

    } catch (error) {
        console.error(`HealthPlanet import error for ${date}:`, error)

        // 認証エラーの場合は例外を再投げ（上位のauth_error処理に委ねる）
        if (error instanceof Error && error.message === 'HEALTHPLANET_TOKEN_INVALID') {
            throw error
        }

        return {
            date,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}