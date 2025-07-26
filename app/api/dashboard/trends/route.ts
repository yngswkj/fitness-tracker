import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// 週次・月次トレンドデータの取得
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const period = searchParams.get('period') || 'week' // week, month
        const weeks = parseInt(searchParams.get('weeks') || '12')
        const months = parseInt(searchParams.get('months') || '6')

        let trendsData = {}

        if (period === 'week') {
            // 週次データの取得
            trendsData = await getWeeklyTrends(session.user.id, weeks)
        } else if (period === 'month') {
            // 月次データの取得
            trendsData = await getMonthlyTrends(session.user.id, months)
        }

        return NextResponse.json(trendsData)

    } catch (error) {
        console.error('Get trends error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// 週次トレンドデータの取得
async function getWeeklyTrends(userId: string, weeks: number) {
    // ワークアウトの週次データ
    const { rows: workoutTrends } = await sql`
        SELECT 
            DATE_TRUNC('week', started_at) as week_start,
            COUNT(*) as workout_count,
            COUNT(CASE WHEN ended_at IS NOT NULL THEN 1 END) as completed_workouts,
            AVG(CASE 
                WHEN ended_at IS NOT NULL THEN 
                    EXTRACT(EPOCH FROM (ended_at - started_at))/60
                ELSE NULL 
            END) as avg_duration_minutes,
            SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END) as total_completed
        FROM workouts
        WHERE user_id = ${userId}
            AND started_at >= NOW() - INTERVAL '1 week' * ${weeks}
        GROUP BY DATE_TRUNC('week', started_at)
        ORDER BY week_start DESC
    `

    // 食事記録の週次データ
    const { rows: mealTrends } = await sql`
        SELECT 
            DATE_TRUNC('week', recorded_at) as week_start,
            COUNT(*) as meal_count,
            AVG(calories) as avg_calories,
            AVG(protein) as avg_protein,
            AVG(carbs) as avg_carbs,
            AVG(fat) as avg_fat,
            SUM(calories) as total_calories
        FROM meals
        WHERE user_id = ${userId}
            AND recorded_at >= NOW() - INTERVAL '1 week' * ${weeks}
            AND calories IS NOT NULL
        GROUP BY DATE_TRUNC('week', recorded_at)
        ORDER BY week_start DESC
    `

    // エクササイズの週次データ
    const { rows: exerciseTrends } = await sql`
        SELECT 
            DATE_TRUNC('week', w.started_at) as week_start,
            COUNT(e.id) as total_exercises,
            COUNT(DISTINCT e.exercise_name) as unique_exercises,
            SUM(e.sets * e.reps) as total_reps,
            AVG(e.weight) as avg_weight,
            MAX(e.weight) as max_weight
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE w.user_id = ${userId}
            AND w.started_at >= NOW() - INTERVAL '1 week' * ${weeks}
            AND w.ended_at IS NOT NULL
        GROUP BY DATE_TRUNC('week', w.started_at)
        ORDER BY week_start DESC
    `

    return {
        period: 'week',
        weeks: weeks,
        workouts: workoutTrends,
        meals: mealTrends,
        exercises: exerciseTrends
    }
}

// 月次トレンドデータの取得
async function getMonthlyTrends(userId: string, months: number) {
    // ワークアウトの月次データ
    const { rows: workoutTrends } = await sql`
        SELECT 
            DATE_TRUNC('month', started_at) as month_start,
            COUNT(*) as workout_count,
            COUNT(CASE WHEN ended_at IS NOT NULL THEN 1 END) as completed_workouts,
            AVG(CASE 
                WHEN ended_at IS NOT NULL THEN 
                    EXTRACT(EPOCH FROM (ended_at - started_at))/60
                ELSE NULL 
            END) as avg_duration_minutes,
            SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END) as total_completed
        FROM workouts
        WHERE user_id = ${userId}
            AND started_at >= NOW() - INTERVAL '1 month' * ${months}
        GROUP BY DATE_TRUNC('month', started_at)
        ORDER BY month_start DESC
    `

    // 食事記録の月次データ
    const { rows: mealTrends } = await sql`
        SELECT 
            DATE_TRUNC('month', recorded_at) as month_start,
            COUNT(*) as meal_count,
            AVG(calories) as avg_calories,
            AVG(protein) as avg_protein,
            AVG(carbs) as avg_carbs,
            AVG(fat) as avg_fat,
            SUM(calories) as total_calories
        FROM meals
        WHERE user_id = ${userId}
            AND recorded_at >= NOW() - INTERVAL '1 month' * ${months}
            AND calories IS NOT NULL
        GROUP BY DATE_TRUNC('month', recorded_at)
        ORDER BY month_start DESC
    `

    // エクササイズの月次データ
    const { rows: exerciseTrends } = await sql`
        SELECT 
            DATE_TRUNC('month', w.started_at) as month_start,
            COUNT(e.id) as total_exercises,
            COUNT(DISTINCT e.exercise_name) as unique_exercises,
            SUM(e.sets * e.reps) as total_reps,
            AVG(e.weight) as avg_weight,
            MAX(e.weight) as max_weight
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE w.user_id = ${userId}
            AND w.started_at >= NOW() - INTERVAL '1 month' * ${months}
            AND w.ended_at IS NOT NULL
        GROUP BY DATE_TRUNC('month', w.started_at)
        ORDER BY month_start DESC
    `

    return {
        period: 'month',
        months: months,
        workouts: workoutTrends,
        meals: mealTrends,
        exercises: exerciseTrends
    }
}