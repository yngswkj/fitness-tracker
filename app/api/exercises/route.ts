import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// エクササイズの取得
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const workoutId = searchParams.get('workout_id')

        if (!workoutId) {
            return NextResponse.json(
                { error: 'workout_id parameter is required' },
                { status: 400 }
            )
        }

        // ワークアウトの所有者確認
        const { rows: workoutRows } = await sql`
            SELECT id FROM workouts
            WHERE id = ${workoutId} AND user_id = ${session.user.id}
        `

        if (workoutRows.length === 0) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
        }

        // エクササイズ一覧を取得
        const { rows } = await sql`
            SELECT id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
            FROM exercises
            WHERE workout_id = ${workoutId}
            ORDER BY order_index ASC, created_at ASC
        `

        return NextResponse.json({ exercises: rows })

    } catch (error) {
        console.error('Get exercises error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// エクササイズの追加
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { workout_id, exercise_name, sets, reps, weight, rest_seconds, order_index } = body

        // バリデーション
        if (!workout_id || !exercise_name || !sets || !reps) {
            return NextResponse.json(
                { error: 'workout_id, exercise_name, sets, repsは必須です' },
                { status: 400 }
            )
        }

        if (exercise_name.trim().length === 0) {
            return NextResponse.json(
                { error: 'エクササイズ名を入力してください' },
                { status: 400 }
            )
        }

        if (exercise_name.length > 100) {
            return NextResponse.json(
                { error: 'エクササイズ名は100文字以内で入力してください' },
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

        // ワークアウトの所有者確認
        const { rows: workoutRows } = await sql`
            SELECT id FROM workouts
            WHERE id = ${workout_id} AND user_id = ${session.user.id}
        `

        if (workoutRows.length === 0) {
            return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
        }

        // order_indexが指定されていない場合は最後に追加
        let finalOrderIndex = order_index
        if (finalOrderIndex === null || finalOrderIndex === undefined) {
            const { rows: maxOrderRows } = await sql`
                SELECT COALESCE(MAX(order_index), 0) + 1 as next_order
                FROM exercises
                WHERE workout_id = ${workout_id}
            `
            finalOrderIndex = maxOrderRows[0].next_order
        }

        const { rows } = await sql`
            INSERT INTO exercises (
                workout_id, exercise_name, sets, reps, weight, rest_seconds, order_index
            )
            VALUES (
                ${workout_id}, ${exercise_name.trim()}, ${sets}, ${reps}, 
                ${weight || null}, ${rest_seconds || null}, ${finalOrderIndex}
            )
            RETURNING id, exercise_name, sets, reps, weight, rest_seconds, order_index, created_at
        `

        return NextResponse.json({
            message: 'エクササイズを追加しました',
            exercise: rows[0]
        }, { status: 201 })

    } catch (error) {
        console.error('Create exercise error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}