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

// 特定の目標の取得
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

        // 目標の基本情報を取得
        const { rows: goalRows } = await sql`
            SELECT 
                id, type, title, description, target_value, current_value,
                unit, period, start_date, end_date, is_active, created_at,
                CASE 
                    WHEN is_active = true THEN 'active'
                    WHEN current_value >= target_value THEN 'completed'
                    ELSE 'paused'
                END as status,
                CASE 
                    WHEN target_value > 0 THEN (current_value / target_value) * 100
                    ELSE 0 
                END as progress_percentage
            FROM goals
            WHERE id = ${goalId} AND user_id = ${userId}
        `

        if (goalRows.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
        }

        // 進捗履歴を取得
        const { rows: progressRows } = await sql`
            SELECT date, value, notes, created_at
            FROM goal_progress
            WHERE goal_id = ${goalId}
            ORDER BY date DESC
            LIMIT 30
        `

        const goal = {
            ...goalRows[0],
            progress_history: progressRows
        }

        return NextResponse.json({ goal })

    } catch (error) {
        console.error('Get goal error:', error)
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

// 目標の更新
export async function PUT(
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
        const { title, description, target_value, end_date, is_active } = body

        // 目標の存在確認
        const { rows: existingGoal } = await sql`
            SELECT id, title, description, target_value, end_date, is_active
            FROM goals
            WHERE id = ${goalId} AND user_id = ${userId}
        `

        if (existingGoal.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
        }

        const current = existingGoal[0]

        // 更新データの準備
        const updatedTitle = title?.trim() || current.title
        const updatedDescription = description !== undefined ? description?.trim() : current.description
        const updatedTargetValue = target_value !== undefined ? target_value : current.target_value
        const updatedEndDate = end_date !== undefined ? end_date : current.end_date
        const updatedIsActive = is_active !== undefined ? is_active : current.is_active

        // バリデーション
        if (updatedTitle.length === 0) {
            return NextResponse.json(
                { error: '目標タイトルを入力してください' },
                { status: 400 }
            )
        }

        if (updatedTargetValue <= 0) {
            return NextResponse.json(
                { error: '目標値は0より大きい値を入力してください' },
                { status: 400 }
            )
        }

        const { rows } = await sql`
            UPDATE goals 
            SET 
                title = ${updatedTitle},
                description = ${updatedDescription},
                target_value = ${updatedTargetValue},
                end_date = ${updatedEndDate},
                is_active = ${updatedIsActive}
            WHERE id = ${goalId} AND user_id = ${userId}
            RETURNING id, type, title, description, target_value, current_value, unit, period, 
                     start_date, end_date, is_active, created_at,
                     CASE 
                         WHEN is_active = true THEN 'active'
                         WHEN current_value >= target_value THEN 'completed'
                         ELSE 'paused'
                     END as status
        `

        return NextResponse.json({
            message: '目標を更新しました',
            goal: rows[0]
        })

    } catch (error) {
        console.error('Update goal error:', error)
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

// 目標の削除
export async function DELETE(
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

        // 目標の存在確認
        const { rows: existingGoal } = await sql`
            SELECT id FROM goals
            WHERE id = ${goalId} AND user_id = ${userId}
        `

        if (existingGoal.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
        }

        // 進捗データも含めて削除（CASCADE設定により自動削除されるが明示的に実行）
        await sql`DELETE FROM goal_progress WHERE goal_id = ${goalId}`
        await sql`DELETE FROM goals WHERE id = ${goalId} AND user_id = ${userId}`

        return NextResponse.json({
            message: '目標を削除しました'
        })

    } catch (error) {
        console.error('Delete goal error:', error)
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