import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

// 食事記録の取得
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const date = searchParams.get('date')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        let query
        let params: any[] = [session.user.id, limit, offset]

        if (date) {
            query = `
        SELECT id, meal_type, food_name, quantity, unit, calories, protein, carbs, fat, recorded_at, created_at
        FROM meals
        WHERE user_id = $1 AND DATE(recorded_at) = $4
        ORDER BY recorded_at DESC
        LIMIT $2 OFFSET $3
      `
            params = [session.user.id, limit, offset, date]
        } else {
            query = `
        SELECT id, meal_type, food_name, quantity, unit, calories, protein, carbs, fat, recorded_at, created_at
        FROM meals
        WHERE user_id = $1
        ORDER BY recorded_at DESC
        LIMIT $2 OFFSET $3
      `
        }

        const { rows } = await sql.query(query, params)

        // 日付別サマリーも取得
        const summaryQuery = date
            ? `
        SELECT 
          DATE(recorded_at) as date,
          COUNT(*) as meal_count,
          COALESCE(SUM(calories), 0) as total_calories,
          COALESCE(SUM(protein), 0) as total_protein,
          COALESCE(SUM(carbs), 0) as total_carbs,
          COALESCE(SUM(fat), 0) as total_fat
        FROM meals
        WHERE user_id = $1 AND DATE(recorded_at) = $2
        GROUP BY DATE(recorded_at)
      `
            : `
        SELECT 
          DATE(recorded_at) as date,
          COUNT(*) as meal_count,
          COALESCE(SUM(calories), 0) as total_calories,
          COALESCE(SUM(protein), 0) as total_protein,
          COALESCE(SUM(carbs), 0) as total_carbs,
          COALESCE(SUM(fat), 0) as total_fat
        FROM meals
        WHERE user_id = $1
        GROUP BY DATE(recorded_at)
        ORDER BY date DESC
        LIMIT 7
      `

        const summaryParams = date ? [session.user.id, date] : [session.user.id]
        const { rows: summaryRows } = await sql.query(summaryQuery, summaryParams)

        return NextResponse.json({
            meals: rows,
            summary: summaryRows,
            pagination: {
                limit,
                offset,
                hasMore: rows.length === limit
            }
        })

    } catch (error) {
        console.error('Get meals error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// 食事記録の作成
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            meal_type,
            food_name,
            quantity,
            unit,
            calories,
            protein,
            carbs,
            fat,
            recorded_at
        } = body

        // バリデーション
        if (!meal_type || !food_name || !quantity || !unit) {
            return NextResponse.json(
                { error: '必須フィールドが不足しています' },
                { status: 400 }
            )
        }

        if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal_type)) {
            return NextResponse.json(
                { error: '無効な食事タイプです' },
                { status: 400 }
            )
        }

        if (quantity <= 0) {
            return NextResponse.json(
                { error: '分量は0より大きい値を入力してください' },
                { status: 400 }
            )
        }

        const recordedAt = recorded_at || new Date().toISOString()

        const { rows } = await sql`
      INSERT INTO meals (
        user_id, meal_type, food_name, quantity, unit, 
        calories, protein, carbs, fat, recorded_at
      )
      VALUES (
        ${session.user.id}, ${meal_type}, ${food_name}, ${quantity}, ${unit},
        ${calories || null}, ${protein || null}, ${carbs || null}, ${fat || null}, ${recordedAt}
      )
      RETURNING id, meal_type, food_name, quantity, unit, calories, protein, carbs, fat, recorded_at, created_at
    `

        return NextResponse.json({
            message: '食事記録を作成しました',
            meal: rows[0]
        }, { status: 201 })

    } catch (error) {
        console.error('Create meal error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}