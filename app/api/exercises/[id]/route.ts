import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// 特定のエクササイズの取得
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const exerciseId = parseInt(params.id)
        if (isNaN(exerciseId)) {
            return NextResponse.json({ error: 'Invalid exercise ID' }, { status: 400 })
        }

        // エクササイズとワークアウトの所有者確認
        const { rows } = await sql`
            SELECT e.id, e.exercise_name, e.sets, e.reps, e.weight, e.rest_seconds, e.order_index, e.created_at
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE e.id = ${exerciseId} AND w.user_id = ${session.user.id}
        `

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
        }

        return NextResponse.json({ exercise: rows[0] })

    } catch (error) {
        console.error('Get exercise error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// エクササイズの更新
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const exerciseId = parseInt(params.id)
        if (isNaN(exerciseId)) {
            return NextResponse.json({ error: 'Invalid exercise ID' }, { status: 400 })
        }

        const body = await request.json()
        const { exercise_name, sets, reps, weight, rest_seconds, order_index } = body

        // エクササイズとワークアウトの所有者確認
        const { rows: existingExercise } = await sql`
            SELECT e.id, e.exercise_name, e.sets, e.reps, e.weight, e.rest_seconds, e.order_index
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE e.id = ${exerciseId} AND w.user_id = ${session.user.id}
        `

        if (existingExercise.length === 0) {
            return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
        }

        const current = existingExercise[0]

        // バリデーション
        const updatedExerciseName = exercise_name?.trim() || current.exercise_name
        const updatedSets = sets !== undefined ? sets : current.sets
        const updatedReps = reps !== undefined ? reps : current.reps
        const updatedWeight = weight !== undefined ? weight : current.weight
        const updatedRestSeconds = rest_seconds !== undefined ? rest_seconds : current.rest_seconds
        const updatedOrderIndex = order_index !== undefined ? order_index : current.order_index

        if (updatedExerciseName.length === 0) {
            return NextResponse.json(
                { error: 'エクササイズ名を入力してください' },
                { status: 400 }
            )
        }

        if (updatedExerciseName.length > 100) {
            return NextResponse.json(
                { error: 'エクササイズ名は100文字以内で入力してください' },
                { status: 400 }
            )
        }

        if (updatedSets <= 0 || updatedReps <= 0) {
            return NextResponse.json(
                { error: 'セット数とレップ数は1以上の値を入力してください' },
                { status: 400 }
            )
        }

        if (updatedWeight !== null && updatedWeight !== undefined && updatedWeight < 0) {
            return NextResponse.json(
                { error: '重量は0以上の値を入力してください' },
                { status: 400 }
            )
        }

        if (updatedRestSeconds !== null && updatedRestSeconds !== undefined && updatedRestSeconds < 0) {
            return NextResponse.json(
                { error: '休憩時間は0以上の値を入力してください' },
                { status: 400 }
            )
        }

        const { rows } = await sql`
            UPDATE exercises 
            SET 
                exercise_name = ${updatedExerciseName},
                sets = ${updatedSets},
                reps = ${updatedReps},
                weight = ${updatedWeight || null},
                rest_seconds = ${updatedRestSeconds || null},
                order_index = ${updatedOrderIndex}
            WHERE id = ${exerciseId}
            RETURNING id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
        `

        return NextResponse.json({
            message: 'エクササイズを更新しました',
            exercise: rows[0]
        })

    } catch (error) {
        console.error('Update exercise error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// エクササイズの削除
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const exerciseId = parseInt(params.id)
        if (isNaN(exerciseId)) {
            return NextResponse.json({ error: 'Invalid exercise ID' }, { status: 400 })
        }

        // エクササイズとワークアウトの所有者確認
        const { rows: existingExercise } = await sql`
            SELECT e.id, e.workout_id, e.order_index
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE e.id = ${exerciseId} AND w.user_id = ${session.user.id}
        `

        if (existingExercise.length === 0) {
            return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
        }

        const { workout_id, order_index } = existingExercise[0]

        // エクササイズを削除
        await sql`DELETE FROM exercises WHERE id = ${exerciseId}`

        // 削除されたエクササイズより後のorder_indexを調整
        await sql`
            UPDATE exercises 
            SET order_index = order_index - 1
            WHERE workout_id = ${workout_id} AND order_index > ${order_index}
        `

        return NextResponse.json({
            message: 'エクササイズを削除しました'
        })

    } catch (error) {
        console.error('Delete exercise error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}