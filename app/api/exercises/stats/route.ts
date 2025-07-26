import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// エクササイズ統計情報の取得
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const exerciseName = searchParams.get('exercise_name')
        const period = searchParams.get('period') || '30' // デフォルト30日
        const limit = parseInt(searchParams.get('limit') || '50')

        if (!exerciseName) {
            return NextResponse.json(
                { error: 'exercise_name parameter is required' },
                { status: 400 }
            )
        }

        // 指定期間内のエクササイズ履歴を取得
        const { rows: exerciseHistory } = await sql`
            SELECT 
                e.id,
                e.sets,
                e.reps,
                e.weight,
                e.rest_seconds,
                w.started_at as workout_date,
                w.name as workout_name,
                w.id as workout_id
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE w.user_id = ${session.user.id}
                AND LOWER(e.exercise_name) = LOWER(${exerciseName})
                AND w.started_at >= NOW() - INTERVAL '1 day' * ${period}
                AND w.ended_at IS NOT NULL
            ORDER BY w.started_at DESC
            LIMIT ${limit}
        `

        if (exerciseHistory.length === 0) {
            return NextResponse.json({
                exercise_name: exerciseName,
                period_days: parseInt(period),
                history: [],
                stats: {
                    total_workouts: 0,
                    total_sets: 0,
                    total_reps: 0,
                    max_weight: null,
                    avg_weight: null,
                    max_reps: null,
                    avg_reps: null,
                    progress_trend: null
                }
            })
        }

        // 統計情報を計算
        const totalWorkouts = exerciseHistory.length
        const totalSets = exerciseHistory.reduce((sum, ex) => sum + ex.sets, 0)
        const totalReps = exerciseHistory.reduce((sum, ex) => sum + (ex.sets * ex.reps), 0)

        const weightsWithValues = exerciseHistory.filter(ex => ex.weight !== null && ex.weight > 0)
        const maxWeight = weightsWithValues.length > 0
            ? Math.max(...weightsWithValues.map(ex => ex.weight))
            : null
        const avgWeight = weightsWithValues.length > 0
            ? weightsWithValues.reduce((sum, ex) => sum + ex.weight, 0) / weightsWithValues.length
            : null

        const maxReps = Math.max(...exerciseHistory.map(ex => ex.reps))
        const avgReps = exerciseHistory.reduce((sum, ex) => sum + ex.reps, 0) / exerciseHistory.length

        // 進捗トレンド分析（最新5回と過去5回を比較）
        let progressTrend = null
        if (exerciseHistory.length >= 10) {
            const recent5 = exerciseHistory.slice(0, 5)
            const past5 = exerciseHistory.slice(-5)

            const recentAvgWeight = recent5
                .filter(ex => ex.weight !== null && ex.weight > 0)
                .reduce((sum, ex, _, arr) => sum + ex.weight / arr.length, 0)

            const pastAvgWeight = past5
                .filter(ex => ex.weight !== null && ex.weight > 0)
                .reduce((sum, ex, _, arr) => sum + ex.weight / arr.length, 0)

            if (recentAvgWeight > 0 && pastAvgWeight > 0) {
                const weightChange = ((recentAvgWeight - pastAvgWeight) / pastAvgWeight) * 100
                progressTrend = {
                    weight_change_percent: Math.round(weightChange * 100) / 100,
                    trend: weightChange > 5 ? 'improving' : weightChange < -5 ? 'declining' : 'stable'
                }
            }
        }

        // 個人記録（PR）を取得
        const { rows: personalRecords } = await sql`
            SELECT 
                MAX(e.weight) as max_weight_pr,
                MAX(e.reps) as max_reps_pr,
                MAX(e.sets * e.reps) as max_volume_pr
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE w.user_id = ${session.user.id}
                AND LOWER(e.exercise_name) = LOWER(${exerciseName})
                AND w.ended_at IS NOT NULL
                AND e.weight IS NOT NULL
                AND e.weight > 0
        `

        const personalRecord = personalRecords[0] || {
            max_weight_pr: null,
            max_reps_pr: null,
            max_volume_pr: null
        }

        return NextResponse.json({
            exercise_name: exerciseName,
            period_days: parseInt(period),
            history: exerciseHistory,
            stats: {
                total_workouts: totalWorkouts,
                total_sets: totalSets,
                total_reps: totalReps,
                max_weight: maxWeight,
                avg_weight: avgWeight ? Math.round(avgWeight * 100) / 100 : null,
                max_reps: maxReps,
                avg_reps: Math.round(avgReps * 100) / 100,
                progress_trend: progressTrend
            },
            personal_records: personalRecord
        })

    } catch (error) {
        console.error('Get exercise stats error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// 人気エクササイズランキングの取得
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { period = 30, limit = 10 } = body

        // 期間内で最も頻繁に行われたエクササイズを取得
        const { rows: popularExercises } = await sql`
            SELECT 
                e.exercise_name,
                COUNT(DISTINCT w.id) as workout_count,
                COUNT(e.id) as total_sets,
                SUM(e.sets * e.reps) as total_volume,
                AVG(e.weight) as avg_weight,
                MAX(e.weight) as max_weight,
                MIN(w.started_at) as first_performed,
                MAX(w.started_at) as last_performed
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE w.user_id = ${session.user.id}
                AND w.started_at >= NOW() - INTERVAL '1 day' * ${period}
                AND w.ended_at IS NOT NULL
            GROUP BY e.exercise_name
            ORDER BY workout_count DESC, total_volume DESC
            LIMIT ${limit}
        `

        return NextResponse.json({
            period_days: period,
            popular_exercises: popularExercises.map(ex => ({
                ...ex,
                avg_weight: ex.avg_weight ? Math.round(ex.avg_weight * 100) / 100 : null
            }))
        })

    } catch (error) {
        console.error('Get popular exercises error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}