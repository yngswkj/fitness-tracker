// HealthPlanet API操作のユーティリティ関数

export interface HealthPlanetTokens {
    access_token: string
    refresh_token: string
    expires_at: Date
}

export interface HealthPlanetData {
    date: string
    weight?: number
    body_fat?: number
    muscle_mass?: number
    bone_mass?: number
    visceral_fat?: number
}

/**
 * アクセストークンが有効かチェックし、必要に応じてリフレッシュ
 */
export async function ensureValidHealthPlanetToken(tokens: HealthPlanetTokens): Promise<HealthPlanetTokens | null> {
    const now = new Date()
    const expiresAt = new Date(tokens.expires_at)

    // 1時間以内に期限切れの場合はリフレッシュ
    if (expiresAt.getTime() - now.getTime() < 60 * 60 * 1000) {
        return await refreshHealthPlanetToken(tokens.refresh_token)
    }

    return tokens
}

/**
 * HealthPlanetアクセストークンをリフレッシュ
 */
export async function refreshHealthPlanetToken(refreshToken: string): Promise<HealthPlanetTokens | null> {
    try {
        const clientId = process.env.HEALTHPLANET_CLIENT_ID
        const clientSecret = process.env.HEALTHPLANET_CLIENT_SECRET

        if (!clientId || !clientSecret) {
            throw new Error('HealthPlanet credentials not configured')
        }

        const response = await fetch('https://www.healthplanet.jp/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('HealthPlanet token refresh failed:', errorText)
            return null
        }

        const tokenData = await response.json()
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        return {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt
        }
    } catch (error) {
        console.error('HealthPlanet token refresh error:', error)
        return null
    }
}

/**
 * HealthPlanet APIリクエストを実行（公式仕様に基づく）
 */
export async function makeHealthPlanetRequest(endpoint: string, accessToken: string, params: Record<string, string> = {}): Promise<any> {
    try {
        // HealthPlanet APIの正しいベースURL（公式仕様: GETリクエスト、XMLエンドポイント）
        const url = new URL(`https://www.healthplanet.jp${endpoint}`)

        // アクセストークンをクエリパラメータとして追加
        url.searchParams.append('access_token', accessToken)

        // その他のパラメータを追加
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value)
        })

        console.log('HealthPlanet API Request:')
        console.log('URL:', url.toString())

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Fitness-Tracking-App/1.0'
            }
        })

        console.log('Response Status:', response.status)
        console.log('Response Headers:', Object.fromEntries(response.headers.entries()))

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`HealthPlanet API request failed for ${endpoint}:`, errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        // JSONレスポンスを取得
        const data = await response.json()
        console.log('HealthPlanet API Response:', data)
        return data
    } catch (error) {
        console.error(`HealthPlanet API request error for ${endpoint}:`, error)
        throw error
    }
}



/**
 * 指定期間のHealthPlanet体重データを取得（3ヶ月制限対応）
 */
export async function getHealthPlanetData(fromDate: string, toDate: string, accessToken: string): Promise<HealthPlanetData[]> {
    try {
        // 3ヶ月制限を考慮した日付範囲の調整
        const { adjustedFromDate, adjustedToDate } = adjustDateRangeFor3MonthLimit(fromDate, toDate)

        // HealthPlanet API仕様に合わせた日付形式（yyyyMMddHHmmss）
        const fromDateTime = adjustedFromDate.replace(/-/g, '') + '000000' // 00:00:00
        const toDateTime = adjustedToDate.replace(/-/g, '') + '235959'     // 23:59:59

        console.log('HealthPlanet Data Request:')
        console.log('Original From:', fromDate, 'To:', toDate)
        console.log('Adjusted From:', adjustedFromDate, 'To:', adjustedToDate)
        console.log('API From:', fromDateTime, 'To:', toDateTime)
        console.log('Access Token (first 30 chars):', accessToken.substring(0, 30) + '...')

        const data = await makeHealthPlanetRequest('/status/innerscan.json', accessToken, {
            date: '1',        // 測定日で取得（必須）
            from: fromDateTime, // yyyyMMddHHmmss形式
            to: toDateTime,     // yyyyMMddHHmmss形式
            tag: '6021,6022'    // 体重,体脂肪率（公式例に合わせて簡素化）
        })

        if (!data.data || !Array.isArray(data.data)) {
            return []
        }

        // 日付ごとにデータをグループ化
        const groupedData: { [date: string]: HealthPlanetData } = {}

        data.data.forEach((item: any) => {
            const date = formatHealthPlanetDate(item.date)

            if (!groupedData[date]) {
                groupedData[date] = { date }
            }

            // タグに応じてデータを設定
            switch (item.tag) {
                case '6021': // 体重
                    groupedData[date].weight = parseFloat(item.keydata)
                    break
                case '6022': // 体脂肪率
                    groupedData[date].body_fat = parseFloat(item.keydata)
                    break
                case '6023': // 筋肉量
                    groupedData[date].muscle_mass = parseFloat(item.keydata)
                    break
                case '6024': // 骨量
                    groupedData[date].bone_mass = parseFloat(item.keydata)
                    break
                case '6025': // 内臓脂肪レベル
                    groupedData[date].visceral_fat = parseFloat(item.keydata)
                    break
            }
        })

        return Object.values(groupedData)
    } catch (error) {
        console.error('Failed to fetch HealthPlanet data:', error)
        throw error
    }
}

/**
 * 3ヶ月制限を考慮した日付範囲の調整
 */
function adjustDateRangeFor3MonthLimit(fromDate: string, toDate: string): { adjustedFromDate: string, adjustedToDate: string } {
    const from = new Date(fromDate)
    const to = new Date(toDate)

    // 3ヶ月 = 90日として計算
    const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000
    const dateDiff = to.getTime() - from.getTime()

    if (dateDiff > threeMonthsInMs) {
        // 3ヶ月を超える場合は、toDateから3ヶ月前をfromDateとする
        const adjustedFrom = new Date(to.getTime() - threeMonthsInMs)
        console.log(`Date range exceeds 3 months. Adjusted from ${fromDate} to ${adjustedFrom.toISOString().split('T')[0]}`)

        return {
            adjustedFromDate: adjustedFrom.toISOString().split('T')[0],
            adjustedToDate: toDate
        }
    }

    return {
        adjustedFromDate: fromDate,
        adjustedToDate: toDate
    }
}

/**
 * HealthPlanetの日付形式をYYYY-MM-DD形式に変換
 */
function formatHealthPlanetDate(dateString: string): string {
    // HealthPlanetの日付形式: YYYYMMDDhhmmss
    const year = dateString.substring(0, 4)
    const month = dateString.substring(4, 6)
    const day = dateString.substring(6, 8)
    return `${year}-${month}-${day}`
}

/**
 * HealthPlanetデータの概要を取得
 */
export async function getHealthPlanetDataSummary(userId: string, days: number) {
    try {
        const { sql } = await import('@vercel/postgres')
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

        const { rows } = await sql`
            SELECT 
                COUNT(CASE WHEN weight IS NOT NULL THEN 1 END) as days_with_weight,
                COUNT(CASE WHEN body_fat IS NOT NULL THEN 1 END) as days_with_body_fat,
                AVG(CASE WHEN weight IS NOT NULL THEN weight END) as avg_weight,
                AVG(CASE WHEN body_fat IS NOT NULL THEN body_fat END) as avg_body_fat,
                MAX(synced_at) as last_sync
            FROM fitbit_data
            WHERE user_id = ${userId}
            AND date >= ${cutoffDateStr}
            AND (weight IS NOT NULL OR body_fat IS NOT NULL)
        `

        return rows[0] || null
    } catch (error) {
        console.error('Error getting HealthPlanet data summary:', error)
        return null
    }
}