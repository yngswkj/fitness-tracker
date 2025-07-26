import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// ユーザーIDを取得するヘルパー関数
async function getUserId(session: any) {
    if (!session?.user?.email) {
        throw new Error('Unauthorized')
    }

    const userResult = await sql`
        SELECT id FROM users WHERE email = ${session.user.email}
    `

    if (userResult.rows.length === 0) {
        throw new Error('User not found')
    }

    return userResult.rows[0].id
}

// 目標進捗の更新
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = await getUserId(session)

        const goalId = parseInt(params.id)
        if (isNaN(goalId)) {
            return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 })
        }

        const body = await request.json()
        const { date, value, notes } = body

        // バリデーション
        if (!date || value === undefined || value === null) {
            return NextResponse.json(
                { error: '日付と値は必須です' },
                { status: 400 }
            )
        }

        if (value < 0) {
            return NextResponse.json(
                { error: '値は0以上を入力してください' },
                { status: 400 }
            )
        }

        // 目標の存在確認
        const { rows: goalRows } = await sql`
            SELECT id, type, period FROM goals
            WHERE id = ${goalId} AND user_id = ${userId} AND is_active = true
        `

        if (goalRows.length === 0) {
            return NextResponse.json({ error: 'Goal not found or inactive' }, { status: 404 })
        }

        // 進捗データの挿入または更新
        const { rows: progressRows } = await sql`
            INSERT INTO goal_progress (goal_id, date, value, notes)
            VALUES (${goalId}, ${date}, ${value}, ${notes || null})
            ON CONFLICT (goal_id, date)
            DO UPDATE SET value = ${value}, notes = ${notes || null}
            RETURNING id, goal_id, date, value, notes, created_at
        `

        // 目標の現在値を更新（期間に応じて計算方法を変える）
        const updatedCurrentValue = await updateGoalCurrentValue(goalId, goalRows[0].type, goalRows[0].period, userId)

        return NextResponse.json({
            message: '進捗を更新しました',
            progress: progressRows[0]
        }, { status: 201 })

    } catch (error) {
        console.error('Update goal progress error:', error)
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (error instanceof Error && error.message === 'User not found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ワークアウト頻度を計算する関数
async function calculateWorkoutFrequency(userId: number, period: string): Promise<number> {
    let workoutCount = 0

    switch (period) {
        case 'daily':
            // 今日のワークアウト回数（完了したもののみ）
            const { rows: dailyRows } = await sql`
                SELECT COUNT(*) as count FROM workouts
                WHERE user_id = ${userId}
                AND DATE(started_at) = CURRENT_DATE
                AND ended_at IS NOT NULL
            `
            workoutCount = parseInt(dailyRows[0]?.count || '0')
            break

        case 'weekly':
            // 今週のワークアウト回数（完了したもののみ）
            const { rows: weeklyRows } = await sql`
                SELECT COUNT(*) as count FROM workouts
                WHERE user_id = ${userId}
                AND started_at >= DATE_TRUNC('week', CURRENT_DATE)
                AND started_at <= CURRENT_DATE + INTERVAL '1 day'
                AND ended_at IS NOT NULL
            `
            workoutCount = parseInt(weeklyRows[0]?.count || '0')
            break

        case 'monthly':
            // 今月のワークアウト回数（完了したもののみ）
            const { rows: monthlyRows } = await sql`
                SELECT COUNT(*) as count FROM workouts
                WHERE user_id = ${userId}
                AND started_at >= DATE_TRUNC('month', CURRENT_DATE)
                AND started_at <= CURRENT_DATE + INTERVAL '1 day'
                AND ended_at IS NOT NULL
            `
            workoutCount = parseInt(monthlyRows[0]?.count || '0')
            break

        case 'ongoing':
            // 全期間のワークアウト回数（完了したもののみ）
            const { rows: ongoingRows } = await sql`
                SELECT COUNT(*) as count FROM workouts
                WHERE user_id = ${userId}
                AND ended_at IS NOT NULL
            `
            workoutCount = parseInt(ongoingRows[0]?.count || '0')
            break
    }

    return workoutCount
}

// 目標の現在値を更新する関数
async function updateGoalCurrentValue(goalId: number, type: string, period: string, userId?: number) {
    let currentValue = 0

    // ワークアウト頻度目標の場合は動的に計算
    if (type === 'workout_frequency' && userId) {
        currentValue = await calculateWorkoutFrequency(userId, period)
    } else {
        // 従来の進捗データベースベースの計算
        switch (period) {
            case 'daily':
                // 今日の値
                const { rows: dailyRows } = await sql`
                    SELECT value FROM goal_progress
                    WHERE goal_id = ${goalId} AND date = CURRENT_DATE
                `
                currentValue = dailyRows.length > 0 ? dailyRows[0].value : 0
                break

            case 'weekly':
                // 今週の平均値
                const { rows: weeklyRows } = await sql`
                    SELECT AVG(value) as avg_value FROM goal_progress
                    WHERE goal_id = ${goalId} 
                        AND date >= DATE_TRUNC('week', CURRENT_DATE)
                        AND date <= CURRENT_DATE
                `
                currentValue = weeklyRows.length > 0 && weeklyRows[0].avg_value ? weeklyRows[0].avg_value : 0
                break

            case 'monthly':
                // 今月の平均値
                const { rows: monthlyRows } = await sql`
                    SELECT AVG(value) as avg_value FROM goal_progress
                    WHERE goal_id = ${goalId} 
                        AND date >= DATE_TRUNC('month', CURRENT_DATE)
                        AND date <= CURRENT_DATE
                `
                currentValue = monthlyRows.length > 0 && monthlyRows[0].avg_value ? monthlyRows[0].avg_value : 0
                break

            case 'ongoing':
                // 最新の値
                const { rows: ongoingRows } = await sql`
                    SELECT value FROM goal_progress
                    WHERE goal_id = ${goalId}
                    ORDER BY date DESC
                    LIMIT 1
                `
                currentValue = ongoingRows.length > 0 ? ongoingRows[0].value : 0
                break
        }
    }

    // 目標の現在値を更新
    await sql`
        UPDATE goals 
        SET current_value = ${currentValue}
        WHERE id = ${goalId}
    `

    return currentValue
}

// 目標進捗の取得
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = await getUserId(session)

        const goalId = parseInt(params.id)
        if (isNaN(goalId)) {
            return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '30')
        const summary = searchParams.get('summary') === 'true'

        // 目標の基本情報を取得
        const { rows: goalRows } = await sql`
            SELECT id, type, title, target_value, current_value, unit, period, start_date, end_date
            FROM goals
            WHERE id = ${goalId} AND user_id = ${userId}
        `

        if (goalRows.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
        }

        const goal = goalRows[0]

        // ワークアウト頻度目標の場合は最新の値を動的に計算
        if (goal.type === 'workout_frequency') {
            const latestCurrentValue = await calculateWorkoutFrequency(userId, goal.period)

            // データベースの値も更新
            await sql`
                UPDATE goals 
                SET current_value = ${latestCurrentValue}
                WHERE id = ${goalId}
            `

            goal.current_value = latestCurrentValue
        }

        if (summary) {
            // サマリー情報を返す
            const progressPercentage = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0
            const isAchieved = goal.current_value >= goal.target_value

            // 期間の開始・終了日を計算
            let periodStart = goal.start_date
            let periodEnd = goal.end_date || new Date().toISOString().split('T')[0]

            if (goal.period === 'daily') {
                const today = new Date()
                periodStart = today.toISOString().split('T')[0]
                periodEnd = periodStart
            } else if (goal.period === 'weekly') {
                const today = new Date()
                const dayOfWeek = today.getDay()
                const startOfWeek = new Date(today)
                startOfWeek.setDate(today.getDate() - dayOfWeek)
                const endOfWeek = new Date(startOfWeek)
                endOfWeek.setDate(startOfWeek.getDate() + 6)
                periodStart = startOfWeek.toISOString().split('T')[0]
                periodEnd = endOfWeek.toISOString().split('T')[0]
            } else if (goal.period === 'monthly') {
                const today = new Date()
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
                periodStart = startOfMonth.toISOString().split('T')[0]
                periodEnd = endOfMonth.toISOString().split('T')[0]
            }

            // 最終更新日を取得
            const { rows: lastUpdateRows } = await sql`
                SELECT MAX(created_at) as last_updated
                FROM goal_progress
                WHERE goal_id = ${goalId}
            `

            return NextResponse.json({
                goal_id: goalId,
                current_value: parseFloat(goal.current_value) || 0,
                progress_percentage: Math.round(progressPercentage * 100) / 100,
                is_achieved: isAchieved,
                period_start: periodStart,
                period_end: periodEnd,
                last_updated: lastUpdateRows[0]?.last_updated || null
            })
        }

        // 進捗履歴を取得
        const { rows: progressRows } = await sql`
            SELECT id, date, value, notes, created_at
            FROM goal_progress
            WHERE goal_id = ${goalId}
            ORDER BY date DESC
            LIMIT ${limit}
        `

        return NextResponse.json({ progress: progressRows })

    } catch (error) {
        console.error('Get goal progress error:', error)
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (error instanceof Error && error.message === 'User not found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}