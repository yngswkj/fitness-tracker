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
          expires_at = ${validTokens.expires_at},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
            tokens = validTokens
        }

        // 同期する日付範囲を決定（前日まで過去7日間）
        const dates = []
        for (let i = 1; i <= 7; i++) { // i=1から開始して今日を除外
            const date = new Date()
            date.setDate(date.getDate() - i)
            dates.push(date.toISOString().split('T')[0])
        }

        // 既存データをチェックして、データが存在しない日付またはstepsがNULLの日付を対象にする
        const { rows: existingData } = await sql`
            SELECT date FROM fitbit_data 
            WHERE user_id = ${userId} 
            AND date = ANY(${dates})
            AND steps IS NOT NULL
        `

        const existingDates = new Set(existingData.map(row => row.date))
        const newDates = dates.filter(date => !existingDates.has(date))

        const syncResults = []

        // 新しい日付のみを同期（既存データがある日付はスキップ）
        for (const date of newDates) {
            try {
                const result = await syncFitbitDataForDate(userId, date, tokens.access_token)
                syncResults.push(result)
            } catch (error) {
                console.error(`Failed to sync data for ${date}:`, error)
                syncResults.push({
                    date,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        const successCount = syncResults.filter(r => r.success).length
        const errorCount = syncResults.filter(r => !r.success).length

        return NextResponse.json({
            message: `データ同期が完了しました`,
            results: {
                total: syncResults.length,
                success: successCount,
                errors: errorCount,
                details: syncResults
            }
        })

    } catch (error) {
        console.error('Fitbit sync error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

async function syncFitbitDataForDate(userId: string, date: string, accessToken: string) {
    try {
        // 順次処理でデータを取得（レート制限回避）
        let activityData = null
        let heartRateData = null
        let sleepData = null
        let bodyData = null

        // 各データタイプを順次取得し、間に待機時間を設ける
        try {
            activityData = await getFitbitActivityData(date, accessToken)
            await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
        } catch (error) {
            console.warn(`Failed to fetch activity data for ${date}:`, error)
        }

        try {
            heartRateData = await getFitbitHeartRateData(date, accessToken)
            await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
        } catch (error) {
            console.warn(`Failed to fetch heart rate data for ${date}:`, error)
        }

        try {
            sleepData = await getFitbitSleepData(date, accessToken)
            await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
        } catch (error) {
            console.warn(`Failed to fetch sleep data for ${date}:`, error)
        }



        // データベースに保存（体重・体脂肪はHealthPlanetから取得するため除外）
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
            }
        }

    } catch (error) {
        console.error(`Sync error for ${date}:`, error)
        return {
            date,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}