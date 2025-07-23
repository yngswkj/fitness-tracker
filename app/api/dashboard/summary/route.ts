import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        const { searchParams } = new URL(request.url)
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

        // 食事記録数を取得
        const { rows: mealRows } = await sql`
      SELECT COUNT(*) as count
      FROM meals
      WHERE user_id = ${userId}
      AND DATE(recorded_at) = ${date}
    `

        // ワークアウト数を取得
        const { rows: workoutRows } = await sql`
      SELECT COUNT(*) as count
      FROM workouts
      WHERE user_id = ${userId}
      AND DATE(started_at) = ${date}
    `

        // 食事からのカロリー合計を取得
        const { rows: calorieRows } = await sql`
      SELECT COALESCE(SUM(calories), 0) as total_calories
      FROM meals
      WHERE user_id = ${userId}
      AND DATE(recorded_at) = ${date}
    `

        // Fitbitデータから歩数を取得
        const { rows: stepsRows } = await sql`
      SELECT COALESCE(steps, 0) as steps
      FROM fitbit_data
      WHERE user_id = ${userId}
      AND date = ${date}
    `

        const summary = {
            meals: parseInt(mealRows[0]?.count || '0'),
            workouts: parseInt(workoutRows[0]?.count || '0'),
            calories: parseInt(calorieRows[0]?.total_calories || '0'),
            steps: parseInt(stepsRows[0]?.steps || '0'),
        }

        return NextResponse.json(summary)
    } catch (error) {
        console.error('Dashboard summary error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}