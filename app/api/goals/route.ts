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

// 目標一覧の取得
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = await getUserId(session)

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const isActive = searchParams.get('active') !== 'false'

        let query = `
            SELECT 
                g.id, g.type, g.title, g.description, g.target_value, g.current_value,
                g.unit, g.period, g.start_date, g.end_date, g.is_active, g.created_at,
                CASE 
                    WHEN g.is_active = true THEN 'active'
                    WHEN g.current_value >= g.target_value THEN 'completed'
                    ELSE 'paused'
                END as status,
                CASE 
                    WHEN g.target_value > 0 THEN (g.current_value / g.target_value) * 100
                    ELSE 0 
                END as progress_percentage
            FROM goals g
            WHERE g.user_id = $1
        `
        const params: any[] = [userId]

        if (type) {
            query += ` AND g.type = $${params.length + 1}`
            params.push(type)
        }

        if (isActive) {
            query += ` AND g.is_active = true`
        }

        query += ` ORDER BY g.created_at DESC`

        const { rows: goals } = await sql.query(query, params)

        // 各目標の最新進捗を取得
        const goalsWithProgress = await Promise.all(
            goals.map(async (goal) => {
                const { rows: recentProgress } = await sql`
                    SELECT date, value, notes
                    FROM goal_progress
                    WHERE goal_id = ${goal.id}
                    ORDER BY date DESC
                    LIMIT 7
                `

                return {
                    ...goal,
                    recent_progress: recentProgress
                }
            })
        )

        return NextResponse.json({ goals: goalsWithProgress })

    } catch (error) {
        console.error('Get goals error:', error)
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

// 新しい目標の作成
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = await getUserId(session)

        const body = await request.json()
        const {
            type,
            title,
            description,
            target_value,
            unit,
            period,
            start_date,
            end_date
        } = body

        // バリデーション
        if (!type || !title || !target_value || !unit || !period || !start_date) {
            return NextResponse.json(
                { error: '必須フィールドが不足しています' },
                { status: 400 }
            )
        }

        if (target_value <= 0) {
            return NextResponse.json(
                { error: '目標値は0より大きい値を入力してください' },
                { status: 400 }
            )
        }

        const validTypes = ['workout_frequency', 'calories_daily', 'protein_daily', 'weight_target', 'exercise_pr']
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: '無効な目標タイプです' },
                { status: 400 }
            )
        }

        const validPeriods = ['daily', 'weekly', 'monthly', 'ongoing']
        if (!validPeriods.includes(period)) {
            return NextResponse.json(
                { error: '無効な期間タイプです' },
                { status: 400 }
            )
        }

        // 同じタイプのアクティブな目標が既に存在するかチェック
        const { rows: existingGoals } = await sql`
            SELECT id FROM goals
            WHERE user_id = ${userId} 
                AND type = ${type} 
                AND is_active = true
        `

        if (existingGoals.length > 0) {
            return NextResponse.json(
                { error: 'このタイプの目標は既に設定されています。既存の目標を無効にしてから新しい目標を設定してください。' },
                { status: 400 }
            )
        }

        const { rows } = await sql`
            INSERT INTO goals (
                user_id, type, title, description, target_value, unit, period, start_date, end_date
            )
            VALUES (
                ${userId}, ${type}, ${title.trim()}, ${description?.trim() || null}, 
                ${target_value}, ${unit}, ${period}, ${start_date}, ${end_date || null}
            )
            RETURNING id, type, title, description, target_value, current_value, unit, period, 
                     start_date, end_date, is_active, created_at,
                     CASE 
                         WHEN is_active = true THEN 'active'
                         WHEN current_value >= target_value THEN 'completed'
                         ELSE 'paused'
                     END as status
        `

        return NextResponse.json({
            message: '目標を作成しました',
            goal: rows[0]
        }, { status: 201 })

    } catch (error) {
        console.error('Create goal error:', error)
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