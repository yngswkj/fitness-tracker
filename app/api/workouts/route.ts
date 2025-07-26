import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import { authOptions } from '@/lib/auth'

// ワークアウト記録の取得
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        let query
        let params: any[] = [session.user.id, limit, offset]

        if (from && to) {
            query = `
                SELECT 
                    w.id, w.name, w.started_at, w.ended_at, w.notes, w.created_at,
                    COUNT(e.id) as exercise_count,
                    CASE 
                        WHEN w.ended_at IS NOT NULL THEN 
                            EXTRACT(EPOCH FROM (w.ended_at - w.started_at))/60
                        ELSE NULL 
                    END as duration_minutes
                FROM workouts w
                LEFT JOIN exercises e ON w.id = e.workout_id
                WHERE w.user_id = $1 
                    AND DATE(w.started_at) >= $4 
                    AND DATE(w.started_at) <= $5
                GROUP BY w.id, w.name, w.started_at, w.ended_at, w.notes, w.created_at
                ORDER BY w.started_at DESC
                LIMIT $2 OFFSET $3
            `
            params = [session.user.id, limit, offset, from, to]
        } else {
            query = `
                SELECT 
                    w.id, w.name, w.started_at, w.ended_at, w.notes, w.created_at,
                    COUNT(e.id) as exercise_count,
                    CASE 
                        WHEN w.ended_at IS NOT NULL THEN 
                            EXTRACT(EPOCH FROM (w.ended_at - w.started_at))/60
                        ELSE NULL 
                    END as duration_minutes
                FROM workouts w
                LEFT JOIN exercises e ON w.id = e.workout_id
                WHERE w.user_id = $1
                GROUP BY w.id, w.name, w.started_at, w.ended_at, w.notes, w.created_at
                ORDER BY w.started_at DESC
                LIMIT $2 OFFSET $3
            `
        }

        const { rows } = await sql.query(query, params)

        // 週次・月次サマリーも取得
        const summaryQuery = `
            SELECT 
                DATE_TRUNC('week', started_at) as week_start,
                COUNT(*) as workout_count,
                AVG(CASE 
                    WHEN ended_at IS NOT NULL THEN 
                        EXTRACT(EPOCH FROM (ended_at - started_at))/60
                    ELSE NULL 
                END) as avg_duration_minutes,
                SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END) as completed_workouts
            FROM workouts
            WHERE user_id = $1 
                AND started_at >= NOW() - INTERVAL '4 weeks'
            GROUP BY DATE_TRUNC('week', started_at)
            ORDER BY week_start DESC
        `

        const { rows: summaryRows } = await sql.query(summaryQuery, [session.user.id])

        return NextResponse.json({
            workouts: rows,
            summary: summaryRows,
            pagination: {
                limit,
                offset,
                hasMore: rows.length === limit
            }
        })

    } catch (error) {
        console.error('Get workouts error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ワークアウトセッションの開始
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name, notes, started_at } = body

        // バリデーション
        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'ワークアウト名は必須です' },
                { status: 400 }
            )
        }

        if (name.length > 100) {
            return NextResponse.json(
                { error: 'ワークアウト名は100文字以内で入力してください' },
                { status: 400 }
            )
        }

        const startedAt = started_at || new Date().toISOString()

        // 進行中のワークアウトがないかチェック
        const { rows: activeWorkouts } = await sql`
            SELECT id FROM workouts 
            WHERE user_id = ${session.user.id} AND ended_at IS NULL
        `

        if (activeWorkouts.length > 0) {
            return NextResponse.json(
                { error: '進行中のワークアウトがあります。先に終了してください。' },
                { status: 400 }
            )
        }

        const { rows } = await sql`
            INSERT INTO workouts (user_id, name, started_at, notes)
            VALUES (${session.user.id}, ${name.trim()}, ${startedAt}, ${notes || null})
            RETURNING id, name, started_at, ended_at, notes, created_at
        `

        return NextResponse.json({
            message: 'ワークアウトを開始しました',
            workout: rows[0]
        }, { status: 201 })

    } catch (error) {
        console.error('Create workout error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}