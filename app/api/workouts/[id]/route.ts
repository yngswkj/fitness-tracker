import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// ワークアウト頻度目標の進捗を更新する関数
async function updateWorkoutFrequencyGoals(userId: string) {
    try {
        // アクティブなワークアウト頻度目標を取得
        const { rows: goals } = await sql`
            SELECT id, period FROM goals
            WHERE user_id = ${userId} 
            AND type = 'workout_frequency' 
            AND is_active = true
        `

        // 各目標の進捗を更新
        for (const goal of goals) {
            let workoutCount = 0

            switch (goal.period) {
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

            // 目標の現在値を更新
            await sql`
                UPDATE goals 
                SET current_value = ${workoutCount}
                WHERE id = ${goal.id}
            `
        }
    } catch (error) {
        console.error('Update workout frequency goals error:', error)
    }
}

// 特定のワークアウトの取得（エクササイズ詳細含む）
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workoutId = parseInt(params.id)
        if (isNaN(workoutId)) {
            return NextResponse.json({ error: 'Invalid workout ID' }, { status: 400 })
        }

        // ワークアウト基本情報を取得
        const { rows: workoutRows } = await sql`
            SELECT id, name, started_at, ended_at, notes, created_at
            FROM workouts
            WHERE id = ${workoutId} AND user_id = ${session.user.id}
        `

        if (workoutRows.length === 0) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
        }

        // エクササイズ詳細を取得
        const { rows: exerciseRows } = await sql`
            SELECT id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
            FROM exercises
            WHERE workout_id = ${workoutId}
            ORDER BY order_index ASC, created_at ASC
        `

        const workout = {
            ...workoutRows[0],
            exercises: exerciseRows,
            duration_minutes: workoutRows[0].ended_at
                ? Math.round((new Date(workoutRows[0].ended_at).getTime() - new Date(workoutRows[0].started_at).getTime()) / (1000 * 60))
                : null
        }

        return NextResponse.json({ workout })

    } catch (error) {
        console.error('Get workout error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ワークアウトの更新（終了・メモ更新）
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workoutId = parseInt(params.id)
        if (isNaN(workoutId)) {
            return NextResponse.json({ error: 'Invalid workout ID' }, { status: 400 })
        }

        const body = await request.json()
        const { name, ended_at, notes, action } = body

        // ワークアウトの存在確認
        const { rows: existingWorkout } = await sql`
            SELECT id, name, started_at, ended_at
            FROM workouts
            WHERE id = ${workoutId} AND user_id = ${session.user.id}
        `

        if (existingWorkout.length === 0) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
        }

        let updateQuery: string
        let updateParams: any[]

        if (action === 'complete') {
            // ワークアウト終了
            const endedAt = ended_at || new Date().toISOString()

            updateQuery = `
                UPDATE workouts 
                SET ended_at = $1, notes = $2
                WHERE id = $3 AND user_id = $4
                RETURNING id, name, started_at, ended_at, notes, created_at
            `
            updateParams = [endedAt, notes || existingWorkout[0].notes, workoutId, session.user.id]
        } else {
            // 基本情報更新
            const updatedName = name?.trim() || existingWorkout[0].name

            if (updatedName.length > 100) {
                return NextResponse.json(
                    { error: 'ワークアウト名は100文字以内で入力してください' },
                    { status: 400 }
                )
            }

            updateQuery = `
                UPDATE workouts 
                SET name = $1, notes = $2
                WHERE id = $3 AND user_id = $4
                RETURNING id, name, started_at, ended_at, notes, created_at
            `
            updateParams = [updatedName, notes, workoutId, session.user.id]
        }

        const { rows } = await sql.query(updateQuery, updateParams)

        // ワークアウト完了時に目標進捗を更新
        if (action === 'complete') {
            await updateWorkoutFrequencyGoals(session.user.id)
        }

        const message = action === 'complete'
            ? 'ワークアウトを完了しました'
            : 'ワークアウトを更新しました'

        return NextResponse.json({
            message,
            workout: rows[0]
        })

    } catch (error) {
        console.error('Update workout error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ワークアウトの削除
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workoutId = parseInt(params.id)
        if (isNaN(workoutId)) {
            return NextResponse.json({ error: 'Invalid workout ID' }, { status: 400 })
        }

        // ワークアウトの存在確認
        const { rows: existingWorkout } = await sql`
            SELECT id FROM workouts
            WHERE id = ${workoutId} AND user_id = ${session.user.id}
        `

        if (existingWorkout.length === 0) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
        }

        // エクササイズも含めて削除（CASCADE設定により自動削除されるが明示的に実行）
        await sql`DELETE FROM exercises WHERE workout_id = ${workoutId}`
        await sql`DELETE FROM workouts WHERE id = ${workoutId} AND user_id = ${session.user.id}`

        return NextResponse.json({
            message: 'ワークアウトを削除しました'
        })

    } catch (error) {
        console.error('Delete workout error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}