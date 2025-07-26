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

// ワークアウト頻度を計算する関数
async function calculateWorkoutFrequency(userId: number, period: string): Promise<number> {
    let workoutCount = 0

    switch (period) {
        case 'daily':
            const { rows: dailyRows } = await sql`
                SELECT COUNT(*) as count FROM workouts
                WHERE user_id = ${userId}
                AND DATE(started_at) = CURRENT_DATE
                AND ended_at IS NOT NULL
            `
            workoutCount = parseInt(dailyRows[0]?.count || '0')
            break

        case 'weekly':
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

// 全ての目標進捗を更新
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = await getUserId(session)

        // アクティブなワークアウト頻度目標を取得
        const { rows: workoutGoals } = await sql`
            SELECT id, period, target_value FROM goals
            WHERE user_id = ${userId} 
            AND type = 'workout_frequency' 
            AND is_active = true
        `

        const updatedGoals = []

        // 各ワークアウト頻度目標の進捗を更新
        for (const goal of workoutGoals) {
            const currentValue = await calculateWorkoutFrequency(userId, goal.period)

            await sql`
                UPDATE goals 
                SET current_value = ${currentValue}
                WHERE id = ${goal.id}
            `

            updatedGoals.push({
                id: goal.id,
                current_value: currentValue,
                target_value: goal.target_value,
                progress_percentage: goal.target_value > 0 ? Math.round((currentValue / goal.target_value) * 100) : 0
            })
        }

        return NextResponse.json({
            message: `${updatedGoals.length}個のワークアウト頻度目標を更新しました`,
            updated_goals: updatedGoals
        })

    } catch (error) {
        console.error('Refresh goal progress error:', error)
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