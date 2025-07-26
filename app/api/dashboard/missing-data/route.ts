import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get('days') || '7')

        // ユーザーIDを取得
        const userResult = await sql`
            SELECT id FROM users WHERE email = ${session.user.email}
        `

        if (userResult.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const userId = userResult.rows[0].id
        const today = new Date()
        const startDate = subDays(today, days - 1)

        // 過去N日間の各日について、データの有無をチェック
        const missingData = []

        for (let i = 0; i < days; i++) {
            const checkDate = subDays(today, i)
            const dateStr = format(checkDate, 'yyyy-MM-dd')
            const dayStart = startOfDay(checkDate)
            const dayEnd = endOfDay(checkDate)

            // 食事記録のチェック
            const mealsResult = await sql`
                SELECT COUNT(*) as count 
                FROM meals 
                WHERE user_id = ${userId} 
                AND created_at >= ${dayStart.toISOString()} 
                AND created_at <= ${dayEnd.toISOString()}
            `
            const mealsCount = parseInt(mealsResult.rows[0].count)

            // ワークアウト記録のチェック
            const workoutsResult = await sql`
                SELECT COUNT(*) as count 
                FROM workouts 
                WHERE user_id = ${userId} 
                AND created_at >= ${dayStart.toISOString()} 
                AND created_at <= ${dayEnd.toISOString()}
            `
            const workoutsCount = parseInt(workoutsResult.rows[0].count)

            // Fitbitデータのチェック
            const fitbitResult = await sql`
                SELECT COUNT(*) as count 
                FROM fitbit_data 
                WHERE user_id = ${userId} 
                AND date = ${dateStr}
            `
            const fitbitCount = parseInt(fitbitResult.rows[0].count)

            // データ不足の判定
            const missing = {
                date: dateStr,
                meals: mealsCount === 0,
                workouts: workoutsCount === 0 && i < 2, // 今日と昨日のみワークアウト不足をチェック
                activity: fitbitCount === 0,
                hasAnyMissing: false
            }

            missing.hasAnyMissing = missing.meals || missing.workouts || missing.activity

            if (missing.hasAnyMissing) {
                missingData.push(missing)
            }
        }

        // 連続して記録がない日数をカウント
        let consecutiveMissingDays = 0
        for (let i = 0; i < days; i++) {
            const checkDate = subDays(today, i)
            const dateStr = format(checkDate, 'yyyy-MM-dd')

            const dayMissing = missingData.find(m => m.date === dateStr)
            if (dayMissing) {
                consecutiveMissingDays++
            } else {
                break
            }
        }

        // 今週の記録状況
        const weeklyStats = {
            totalDays: 7,
            recordedDays: 0,
            mealDays: 0,
            workoutDays: 0,
            activityDays: 0
        }

        for (let i = 0; i < 7; i++) {
            const checkDate = subDays(today, i)
            const dateStr = format(checkDate, 'yyyy-MM-dd')
            const dayStart = startOfDay(checkDate)
            const dayEnd = endOfDay(checkDate)

            // 各データタイプの記録状況をチェック
            const [meals, workouts, activity] = await Promise.all([
                sql`SELECT COUNT(*) as count FROM meals WHERE user_id = ${userId} AND created_at >= ${dayStart.toISOString()} AND created_at <= ${dayEnd.toISOString()}`,
                sql`SELECT COUNT(*) as count FROM workouts WHERE user_id = ${userId} AND created_at >= ${dayStart.toISOString()} AND created_at <= ${dayEnd.toISOString()}`,
                sql`SELECT COUNT(*) as count FROM fitbit_data WHERE user_id = ${userId} AND date = ${dateStr}`
            ])

            const hasMeals = parseInt(meals.rows[0].count) > 0
            const hasWorkouts = parseInt(workouts.rows[0].count) > 0
            const hasActivity = parseInt(activity.rows[0].count) > 0

            if (hasMeals) weeklyStats.mealDays++
            if (hasWorkouts) weeklyStats.workoutDays++
            if (hasActivity) weeklyStats.activityDays++
            if (hasMeals || hasWorkouts || hasActivity) weeklyStats.recordedDays++
        }

        // 優先度の高い通知を生成
        const notifications = []

        // 今日のデータ不足
        const todayMissing = missingData.find(m => m.date === format(today, 'yyyy-MM-dd'))
        if (todayMissing) {
            if (todayMissing.meals) {
                notifications.push({
                    type: 'missing_meals',
                    priority: 'high',
                    title: '今日の食事記録がありません',
                    message: '健康管理のために食事を記録しましょう',
                    action: 'record_meal',
                    actionUrl: '/meals'
                })
            }

            if (todayMissing.workouts && new Date().getHours() >= 18) {
                notifications.push({
                    type: 'missing_workout',
                    priority: 'medium',
                    title: '今日のワークアウトはいかがですか？',
                    message: '軽い運動でも健康に良い効果があります',
                    action: 'start_workout',
                    actionUrl: '/workouts'
                })
            }
        }

        // 連続記録なしの警告
        if (consecutiveMissingDays >= 3) {
            notifications.push({
                type: 'consecutive_missing',
                priority: 'high',
                title: `${consecutiveMissingDays}日間記録がありません`,
                message: '継続的な記録が健康管理の鍵です。今日から再開しませんか？',
                action: 'quick_record',
                actionUrl: '/'
            })
        }

        // 週間記録率が低い場合
        const weeklyRecordRate = (weeklyStats.recordedDays / weeklyStats.totalDays) * 100
        if (weeklyRecordRate < 50) {
            notifications.push({
                type: 'low_weekly_rate',
                priority: 'medium',
                title: '今週の記録率が低めです',
                message: `今週は${weeklyStats.recordedDays}/${weeklyStats.totalDays}日の記録があります。目標達成のために記録を増やしましょう`,
                action: 'view_goals',
                actionUrl: '/goals'
            })
        }

        return NextResponse.json({
            missingData,
            consecutiveMissingDays,
            weeklyStats,
            notifications,
            summary: {
                totalMissingDays: missingData.length,
                weeklyRecordRate: Math.round(weeklyRecordRate),
                needsAttention: notifications.some(n => n.priority === 'high')
            }
        })

    } catch (error) {
        console.error('Missing data check error:', error)
        return NextResponse.json(
            { error: 'Failed to check missing data' },
            { status: 500 }
        )
    }
}