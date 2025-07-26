// Fitbit API操作のユーティリティ関数

export interface FitbitTokens {
    access_token: string
    refresh_token: string
    expires_at: Date
}

export interface FitbitActivityData {
    date: string
    steps: number
    calories_burned: number
    distance_km: number
    active_minutes: number
    very_active_minutes?: number
    fairly_active_minutes?: number
    lightly_active_minutes?: number
    sedentary_minutes?: number
}

export interface FitbitHeartRateData {
    date: string
    resting_heart_rate?: number
    fat_burn_minutes?: number
    cardio_minutes?: number
    peak_minutes?: number
}

export interface FitbitSleepData {
    date: string
    sleep_hours?: number
    time_in_bed_hours?: number
    sleep_efficiency?: number
    deep_sleep_minutes?: number
    light_sleep_minutes?: number
    rem_sleep_minutes?: number
    wake_minutes?: number
}

export interface FitbitBodyData {
    date: string
    weight?: number
    body_fat?: number
    bmi?: number
}

/**
 * アクセストークンが有効かチェックし、必要に応じてリフレッシュ
 */
export async function ensureValidToken(tokens: FitbitTokens, userId?: string): Promise<FitbitTokens | null> {
    const now = new Date()
    const expiresAt = new Date(tokens.expires_at)
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()
    const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60)

    console.log(`Token expiry check: expires at ${expiresAt.toISOString()}, current time ${now.toISOString()}, hours until expiry: ${hoursUntilExpiry.toFixed(2)}`)

    // 既に期限切れの場合のみリフレッシュ（実際に期限切れになってから）
    if (timeUntilExpiry <= 0) {
        console.log('Token has expired, attempting to refresh...')
        try {
            const refreshedTokens = await refreshFitbitToken(tokens.refresh_token)
            if (!refreshedTokens) {
                // リフレッシュに失敗した場合は無効なトークンとして扱う
                if (userId) {
                    await invalidateFitbitToken(userId)
                }
                throw new Error('FITBIT_TOKEN_INVALID')
            }

            // 新しいトークンをデータベースに保存
            if (userId) {
                await updateFitbitToken(userId, refreshedTokens)
            }

            return refreshedTokens
        } catch (error) {
            if (error instanceof Error && error.message === 'FITBIT_TOKEN_INVALID' && userId) {
                // 無効なトークンをデータベースから削除
                await invalidateFitbitToken(userId)
            }
            throw error
        }
    }

    console.log('Token is still valid, no refresh needed')
    return tokens
}

/**
 * Fitbitアクセストークンをリフレッシュ
 */
export async function refreshFitbitToken(refreshToken: string): Promise<FitbitTokens | null> {
    try {
        console.log(`Attempting to refresh Fitbit token with refresh token: ${refreshToken.substring(0, 10)}...`)

        const clientId = process.env.FITBIT_CLIENT_ID
        const clientSecret = process.env.FITBIT_CLIENT_SECRET

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
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Token refresh failed:', errorText)

            // invalid_grantエラーの場合は特別な処理
            try {
                const errorData = JSON.parse(errorText)
                if (errorData.errors && errorData.errors.some((e: any) => e.errorType === 'invalid_grant')) {
                    throw new Error('FITBIT_TOKEN_INVALID')
                }
            } catch (parseError) {
                // JSONパースエラーの場合でも、エラーテキストに'invalid_grant'が含まれているかチェック
                if (errorText.includes('invalid_grant')) {
                    throw new Error('FITBIT_TOKEN_INVALID')
                }
            }

            // その他のエラーの場合も無効なトークンとして扱う
            throw new Error('FITBIT_TOKEN_INVALID')
        }

        const tokenData = await response.json()
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        return {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt
        }
    } catch (error) {
        console.error('Token refresh error:', error)

        // 無効なトークンエラーを再スロー
        if (error instanceof Error && error.message === 'FITBIT_TOKEN_INVALID') {
            throw error
        }

        return null
    }
}

/**
 * 無効なFitbitトークンをデータベースから削除
 */
export async function invalidateFitbitToken(userId: string): Promise<void> {
    try {
        const { sql } = await import('@vercel/postgres')
        await sql`
            DELETE FROM fitbit_tokens 
            WHERE user_id = ${userId}
        `
        console.log(`Invalidated Fitbit token for user ${userId}`)
    } catch (error) {
        console.error('Failed to invalidate Fitbit token:', error)
    }
}

/**
 * Fitbitトークンをデータベースに更新
 */
export async function updateFitbitToken(userId: string, tokens: FitbitTokens): Promise<void> {
    try {
        const { sql } = await import('@vercel/postgres')
        await sql`
            UPDATE fitbit_tokens 
            SET access_token = ${tokens.access_token},
                refresh_token = ${tokens.refresh_token},
                expires_at = ${tokens.expires_at.toISOString()}
            WHERE user_id = ${userId}
        `
        console.log(`Updated Fitbit token for user ${userId}, expires at ${tokens.expires_at.toISOString()}`)
    } catch (error) {
        console.error('Failed to update Fitbit token:', error)
    }
}

/**
 * Fitbit APIリクエストを実行
 */
export async function makeFitbitRequest(endpoint: string, accessToken: string): Promise<any> {
    try {
        const response = await fetch(`https://api.fitbit.com/1${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Fitbit API request failed for ${endpoint}:`, response.status, errorText)

            // 401エラーの場合は認証エラー
            if (response.status === 401) {
                throw new Error('FITBIT_TOKEN_INVALID')
            }

            // 429エラーの場合は特別なエラーメッセージを投げる
            if (response.status === 429) {
                throw new Error(`429 Rate limit exceeded for ${endpoint}`)
            }

            // その他のHTTPエラー
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        return await response.json()
    } catch (error) {
        console.error(`Fitbit API request error for ${endpoint}:`, error)
        throw error
    }
}

/**
 * 指定日のFitbit活動データを取得
 */
export async function getFitbitActivityData(date: string, accessToken: string): Promise<FitbitActivityData | null> {
    try {
        const data = await makeFitbitRequest(`/user/-/activities/date/${date}.json`, accessToken)

        if (!data.summary) {
            return null
        }

        const summary = data.summary
        return {
            date,
            steps: parseInt(summary.steps || '0'),
            calories_burned: parseInt(summary.caloriesOut || '0'),
            distance_km: parseFloat(summary.distances?.[0]?.distance || '0'),
            active_minutes: parseInt(summary.veryActiveMinutes || '0') + parseInt(summary.fairlyActiveMinutes || '0'),
            very_active_minutes: parseInt(summary.veryActiveMinutes || '0'),
            fairly_active_minutes: parseInt(summary.fairlyActiveMinutes || '0'),
            lightly_active_minutes: parseInt(summary.lightlyActiveMinutes || '0'),
            sedentary_minutes: parseInt(summary.sedentaryMinutes || '0')
        }
    } catch (error) {
        console.error('Failed to fetch activity data:', error)
        // 429エラーの場合は上位に伝播させる
        if (error instanceof Error && error.message.includes('429')) {
            throw error
        }
        return null
    }
}

/**
 * 指定日のFitbit心拍数データを取得
 */
export async function getFitbitHeartRateData(date: string, accessToken: string): Promise<FitbitHeartRateData | null> {
    try {
        const data = await makeFitbitRequest(`/user/-/activities/heart/date/${date}/1d.json`, accessToken)

        if (!data['activities-heart'] || data['activities-heart'].length === 0) {
            return { date }
        }

        const heartData = data['activities-heart'][0]
        const result: FitbitHeartRateData = { date }

        if (heartData.value) {
            if (heartData.value.restingHeartRate) {
                result.resting_heart_rate = parseInt(heartData.value.restingHeartRate)
            }

            // 心拍数ゾーン
            if (heartData.value.heartRateZones) {
                const zones = heartData.value.heartRateZones
                const fatBurnZone = zones.find((zone: any) => zone.name === 'Fat Burn')
                const cardioZone = zones.find((zone: any) => zone.name === 'Cardio')
                const peakZone = zones.find((zone: any) => zone.name === 'Peak')

                if (fatBurnZone) result.fat_burn_minutes = parseInt(fatBurnZone.minutes || '0')
                if (cardioZone) result.cardio_minutes = parseInt(cardioZone.minutes || '0')
                if (peakZone) result.peak_minutes = parseInt(peakZone.minutes || '0')
            }
        }

        return result
    } catch (error) {
        console.error('Failed to fetch heart rate data:', error)
        // 429エラーの場合は上位に伝播させる
        if (error instanceof Error && error.message.includes('429')) {
            throw error
        }
        return { date }
    }
}

/**
 * 指定日のFitbit睡眠データを取得
 */
export async function getFitbitSleepData(date: string, accessToken: string): Promise<FitbitSleepData | null> {
    try {
        const data = await makeFitbitRequest(`/user/-/sleep/date/${date}.json`, accessToken)

        const result: FitbitSleepData = { date }

        if (data.summary) {
            if (data.summary.totalMinutesAsleep) {
                result.sleep_hours = parseFloat((data.summary.totalMinutesAsleep / 60).toFixed(2))
            }
            if (data.summary.totalTimeInBed) {
                result.time_in_bed_hours = parseFloat((data.summary.totalTimeInBed / 60).toFixed(2))
            }
            if (data.summary.efficiency) {
                result.sleep_efficiency = parseInt(data.summary.efficiency)
            }

            // 睡眠ステージ詳細
            if (data.summary.stages) {
                const stages = data.summary.stages
                if (stages.deep) result.deep_sleep_minutes = parseInt(stages.deep)
                if (stages.light) result.light_sleep_minutes = parseInt(stages.light)
                if (stages.rem) result.rem_sleep_minutes = parseInt(stages.rem)
                if (stages.wake) result.wake_minutes = parseInt(stages.wake)
            }
        }

        return result
    } catch (error) {
        console.error('Failed to fetch sleep data:', error)
        // 429エラーの場合は上位に伝播させる
        if (error instanceof Error && error.message.includes('429')) {
            throw error
        }
        return { date }
    }
}

/**
 * 指定日のFitbit体重・体組成データを取得
 */
export async function getFitbitBodyData(date: string, accessToken: string): Promise<FitbitBodyData | null> {
    try {
        const result: FitbitBodyData = { date }

        // 体重データ取得
        try {
            const weightData = await makeFitbitRequest(`/user/-/body/log/weight/date/${date}.json`, accessToken)
            if (weightData.weight && weightData.weight.length > 0) {
                const latestWeight = weightData.weight[weightData.weight.length - 1]
                result.weight = parseFloat(latestWeight.weight)
                if (latestWeight.fat) {
                    result.body_fat = parseFloat(latestWeight.fat)
                }
            }
        } catch (error) {
            console.warn('Failed to fetch weight data:', error)
        }

        // 体脂肪率データ取得（別途）
        if (!result.body_fat) {
            try {
                const fatData = await makeFitbitRequest(`/user/-/body/log/fat/date/${date}.json`, accessToken)
                if (fatData.fat && fatData.fat.length > 0) {
                    const latestFat = fatData.fat[fatData.fat.length - 1]
                    result.body_fat = parseFloat(latestFat.fat)
                }
            } catch (error) {
                console.warn('Failed to fetch fat data:', error)
            }
        }

        // BMI計算（体重が取得できている場合）
        if (result.weight) {
            try {
                const profile = await makeFitbitRequest('/user/-/profile.json', accessToken)
                if (profile.user && profile.user.height) {
                    const heightCm = parseFloat(profile.user.height)
                    const heightM = heightCm / 100
                    result.bmi = parseFloat((result.weight / (heightM * heightM)).toFixed(2))
                }
            } catch (error) {
                console.warn('Failed to calculate BMI:', error)
            }
        }

        return result
    } catch (error) {
        console.error('Failed to fetch body data:', error)
        return { date }
    }
}

/**
 * Fitbitデータの概要を取得
 */
export async function getFitbitDataSummary(userId: string, days: number) {
    try {
        const { sql } = await import('@vercel/postgres')
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

        const { rows } = await sql`
            SELECT 
                COUNT(*) as total_days,
                COUNT(CASE WHEN steps IS NOT NULL AND steps > 0 THEN 1 END) as days_with_steps,
                COUNT(CASE WHEN sleep_hours IS NOT NULL AND sleep_hours > 0 THEN 1 END) as days_with_sleep,
                COUNT(CASE WHEN resting_heart_rate IS NOT NULL THEN 1 END) as days_with_heart_rate,
                AVG(CASE WHEN steps IS NOT NULL AND steps > 0 THEN steps END) as avg_steps,
                AVG(CASE WHEN sleep_hours IS NOT NULL AND sleep_hours > 0 THEN sleep_hours END) as avg_sleep_hours,
                MAX(synced_at) as last_sync
            FROM fitbit_data
            WHERE user_id = ${userId}
            AND date >= ${cutoffDateStr}
        `

        return rows[0] || null
    } catch (error) {
        console.error('Error getting Fitbit data summary:', error)
        return null
    }
}

/**
 * 同期エラーを取得
 */
export async function getSyncErrors(userId: string, days: number) {
    try {
        // For now, return empty array since we don't have a sync_errors table
        // In a real implementation, you would create a sync_errors table to track errors
        return []
    } catch (error) {
        console.error('Error getting sync errors:', error)
        return []
    }
}

/**
 * 古い同期エラーをクリア
 */
export async function clearOldSyncErrors(userId: string, days: number) {
    try {
        // For now, return success since we don't have a sync_errors table
        // In a real implementation, you would delete old errors from the sync_errors table
        return { success: true }
    } catch (error) {
        console.error('Error clearing old sync errors:', error)
        return { success: false, error: error.message }
    }
}