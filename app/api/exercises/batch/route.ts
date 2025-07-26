import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// エクササイズのバッチ更新
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { workout_id, exercises } = body

        // バリデーション
        if (!workout_id || !exercises || !Array.isArray(exercises)) {
            return NextResponse.json(
                { error: 'workout_id と exercises (配列) は必須です' },
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

        // 各エクササイズのバリデーション
        for (const exercise of exercises) {
            const { id, exercise_name, sets, reps, weight, rest_seconds } = exercise

            if (!id || !exercise_name || !sets || !reps) {
                return NextResponse.json(
                    { error: 'id, exercise_name, sets, repsは必須です' },
                    { status: 400 }
                )
            }

            if (exercise_name.trim().length === 0 || exercise_name.length > 100) {
                return NextResponse.json(
                    { error: 'エクササイズ名は1-100文字で入力してください' },
                    { status: 400 }
                )
            }

            if (sets <= 0 || reps <= 0) {
                return NextResponse.json(
                    { error: 'セット数とレップ数は1以上の値を入力してください' },
                    { status: 400 }
                )
            }

            if (weight !== null && weight !== undefined && weight < 0) {
                return NextResponse.json(
                    { error: '重量は0以上の値を入力してください' },
                    { status: 400 }
                )
            }

            if (rest_seconds !== null && rest_seconds !== undefined && rest_seconds < 0) {
                return NextResponse.json(
                    { error: '休憩時間は0以上の値を入力してください' },
                    { status: 400 }
                )
            }
        }

        // エクササイズの所有者確認
        const exerciseIds = exercises.map(e => e.id)
        const placeholders = exerciseIds.map((_, i) => `$${i + 3}`).join(',')
        const { rows: existingExercises } = await sql.query(`
            SELECT e.id
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE e.id IN (${placeholders}) AND w.user_id = $1 AND e.workout_id = $2
        `, [session.user.id, workout_id, ...exerciseIds])

        if (existingExercises.length !== exerciseIds.length) {
            return NextResponse.json(
                { error: '一部のエクササイズが見つからないか、権限がありません' },
                { status: 404 }
            )
        }

        // バッチ更新
        const updatedExercises = []
        for (const exercise of exercises) {
            const { id, exercise_name, sets, reps, weight, rest_seconds } = exercise

            const { rows } = await sql`
                UPDATE exercises 
                SET 
                    exercise_name = ${exercise_name.trim()},
                    sets = ${sets},
                    reps = ${reps},
                    weight = ${weight || null},
                    rest_seconds = ${rest_seconds || null}
                WHERE id = ${id}
                RETURNING id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
            `

            if (rows.length > 0) {
                updatedExercises.push(rows[0])
            }
        }

        // 順序でソート
        updatedExercises.sort((a, b) => a.order_index - b.order_index)

        return NextResponse.json({
            message: `${updatedExercises.length}個のエクササイズを更新しました`,
            exercises: updatedExercises
        })

    } catch (error) {
        console.error('Batch update exercises error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// エクササイズのバッチ削除
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { workout_id, exercise_ids } = body

        // バリデーション
        if (!workout_id || !exercise_ids || !Array.isArray(exercise_ids)) {
            return NextResponse.json(
                { error: 'workout_id と exercise_ids (配列) は必須です' },
                { status: 400 }
            )
        }

        if (exercise_ids.length === 0) {
            return NextResponse.json(
                { error: '削除するエクササイズIDを指定してください' },
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

        // エクササイズの所有者確認と削除前の順序取得
        const placeholders = exercise_ids.map((_, i) => `$${i + 3}`).join(',')
        const { rows: existingExercises } = await sql.query(`
            SELECT e.id, e.order_index
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE e.id IN (${placeholders}) AND w.user_id = $1 AND e.workout_id = $2
            ORDER BY e.order_index ASC
        `, [session.user.id, workout_id, ...exercise_ids])

        if (existingExercises.length !== exercise_ids.length) {
            return NextResponse.json(
                { error: '一部のエクササイズが見つからないか、権限がありません' },
                { status: 404 }
            )
        }

        // エクササイズを削除
        const deletePlaceholders = exercise_ids.map((_, i) => `$${i + 2}`).join(',')
        await sql.query(`
            DELETE FROM exercises 
            WHERE id IN (${deletePlaceholders}) AND workout_id = $1
        `, [workout_id, ...exercise_ids])

        // 残りのエクササイズの順序を調整
        const { rows: remainingExercises } = await sql`
            SELECT id, order_index
            FROM exercises
            WHERE workout_id = ${workout_id}
            ORDER BY order_index ASC
        `

        // 順序を1から連番で振り直し
        for (let i = 0; i < remainingExercises.length; i++) {
            const newOrderIndex = i + 1
            await sql`
                UPDATE exercises 
                SET order_index = ${newOrderIndex}
                WHERE id = ${remainingExercises[i].id}
            `
        }

        return NextResponse.json({
            message: `${existingExercises.length}個のエクササイズを削除しました`,
            deleted_count: existingExercises.length
        })

    } catch (error) {
        console.error('Batch delete exercises error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}