import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// エクササイズの順序変更
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { workout_id, exercise_orders } = body

        // バリデーション
        if (!workout_id || !exercise_orders || !Array.isArray(exercise_orders)) {
            return NextResponse.json(
                { error: 'workout_id と exercise_orders (配列) は必須です' },
                { status: 400 }
            )
        }

        // ワークアウトの所有者確認
        const { rows: workoutRows } = await sql`
            SELECT id FROM workouts
            WHERE id = ${workout_id} AND user_id = ${session.user.id}
        `

        if (workoutRows.length === 0) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
        }

        // 現在のエクササイズ一覧を取得して検証
        const { rows: currentExercises } = await sql`
            SELECT id FROM exercises
            WHERE workout_id = ${workout_id}
        `

        const currentExerciseIds = currentExercises.map(e => e.id)
        const providedExerciseIds = exercise_orders.map(item => item.exercise_id)

        // 提供されたエクササイズIDが全て存在するかチェック
        const invalidIds = providedExerciseIds.filter(id => !currentExerciseIds.includes(id))
        if (invalidIds.length > 0) {
            return NextResponse.json(
                { error: `無効なエクササイズID: ${invalidIds.join(', ')}` },
                { status: 400 }
            )
        }

        // 全てのエクササイズが含まれているかチェック
        if (currentExerciseIds.length !== providedExerciseIds.length) {
            return NextResponse.json(
                { error: '全てのエクササイズの順序を指定してください' },
                { status: 400 }
            )
        }

        // 順序を更新
        for (let i = 0; i < exercise_orders.length; i++) {
            const { exercise_id } = exercise_orders[i]
            const newOrderIndex = i + 1

            await sql`
                UPDATE exercises 
                SET order_index = ${newOrderIndex}
                WHERE id = ${exercise_id} AND workout_id = ${workout_id}
            `
        }

        // 更新後のエクササイズ一覧を取得
        const { rows: updatedExercises } = await sql`
            SELECT id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
            FROM exercises
            WHERE workout_id = ${workout_id}
            ORDER BY order_index ASC
        `

        return NextResponse.json({
            message: 'エクササイズの順序を更新しました',
            exercises: updatedExercises
        })

    } catch (error) {
        console.error('Reorder exercises error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}