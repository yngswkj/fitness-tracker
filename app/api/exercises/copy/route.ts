import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// エクササイズのコピー（過去のワークアウトから）
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { source_workout_id, target_workout_id, exercise_ids } = body

        // バリデーション
        if (!source_workout_id || !target_workout_id) {
            return NextResponse.json(
                { error: 'source_workout_id と target_workout_id は必須です' },
                { status: 400 }
            )
        }

        if (source_workout_id === target_workout_id) {
            return NextResponse.json(
                { error: '同じワークアウト内でのコピーはできません' },
                { status: 400 }
            )
        }

        // 両方のワークアウトの所有者確認
        const { rows: workoutRows } = await sql`
            SELECT id FROM workouts
            WHERE id IN (${source_workout_id}, ${target_workout_id}) AND user_id = ${session.user.id}
        `

        if (workoutRows.length !== 2) {
            return NextResponse.json({ error: 'ワークアウトが見つからないか、権限がありません' }, { status: 404 })
        }

        // コピー対象のエクササイズを取得
        let sourceExercisesQuery
        let sourceExercisesParams

        if (exercise_ids && Array.isArray(exercise_ids) && exercise_ids.length > 0) {
            // 特定のエクササイズのみコピー
            sourceExercisesQuery = `
                SELECT exercise_name, sets, reps, weight, rest_seconds
                FROM exercises
                WHERE workout_id = $1 AND id = ANY($2)
                ORDER BY order_index ASC
            `
            sourceExercisesParams = [source_workout_id, exercise_ids]
        } else {
            // 全エクササイズをコピー
            sourceExercisesQuery = `
                SELECT exercise_name, sets, reps, weight, rest_seconds
                FROM exercises
                WHERE workout_id = $1
                ORDER BY order_index ASC
            `
            sourceExercisesParams = [source_workout_id]
        }

        const result = await sql.query(sourceExercisesQuery, sourceExercisesParams)
        const sourceExercises = result.rows as unknown as Array<{
            exercise_name: string;
            sets: number;
            reps: number;
            weight: number | null;
            rest_seconds: number | null;
        }>

        if (sourceExercises.length === 0) {
            return NextResponse.json(
                { error: 'コピーするエクササイズが見つかりません' },
                { status: 404 }
            )
        }

        // ターゲットワークアウトの現在の最大order_indexを取得
        const { rows: maxOrderRows } = await sql`
            SELECT COALESCE(MAX(order_index), 0) as max_order
            FROM exercises
            WHERE workout_id = ${target_workout_id}
        `

        let currentMaxOrder = maxOrderRows[0].max_order

        // エクササイズをコピー
        const copiedExercises = []
        for (const exercise of sourceExercises) {
            currentMaxOrder += 1

            const { rows } = await sql`
                INSERT INTO exercises (
                    workout_id, exercise_name, sets, reps, weight, rest_seconds, order_index
                )
                VALUES (
                    ${target_workout_id}, ${exercise.exercise_name}, ${exercise.sets}, ${exercise.reps},
                    ${exercise.weight}, ${exercise.rest_seconds}, ${currentMaxOrder}
                )
                RETURNING id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
            `

            if (rows.length > 0) {
                copiedExercises.push(rows[0])
            }
        }

        return NextResponse.json({
            message: `${copiedExercises.length}個のエクササイズをコピーしました`,
            copied_exercises: copiedExercises
        }, { status: 201 })

    } catch (error) {
        console.error('Copy exercises error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ワークアウトテンプレートの取得（コピー用）
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '10')

        // 過去のワークアウトをテンプレート候補として取得
        const { rows: workoutTemplates } = await sql`
            SELECT 
                w.id,
                w.name,
                w.started_at,
                COUNT(e.id) as exercise_count,
                ARRAY_AGG(
                    JSON_BUILD_OBJECT(
                        'id', e.id,
                        'exercise_name', e.exercise_name,
                        'sets', e.sets,
                        'reps', e.reps,
                        'weight', e.weight,
                        'rest_seconds', e.rest_seconds
                    ) ORDER BY e.order_index ASC
                ) as exercises
            FROM workouts w
            LEFT JOIN exercises e ON w.id = e.workout_id
            WHERE w.user_id = ${session.user.id} 
                AND w.ended_at IS NOT NULL
            GROUP BY w.id, w.name, w.started_at
            HAVING COUNT(e.id) > 0
            ORDER BY w.started_at DESC
            LIMIT ${limit}
        `

        return NextResponse.json({
            workout_templates: workoutTemplates
        })

    } catch (error) {
        console.error('Get workout templates error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}