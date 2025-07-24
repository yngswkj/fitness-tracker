import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id
        const { searchParams } = new URL(request.url)
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        if (!from || !to) {
            return NextResponse.json({ error: 'from and to parameters are required' }, { status: 400 })
        }

        // Fetch Fitbit data from database
        const { rows } = await sql`
            SELECT 
                id, date, steps, calories_burned, distance_km, active_minutes,
                sleep_hours, resting_heart_rate, weight, body_fat, synced_at
            FROM fitbit_data
            WHERE user_id = ${userId}
            AND date >= ${from}
            AND date <= ${to}
            ORDER BY date DESC
        `

        return NextResponse.json({
            success: true,
            data: rows,
            period: { from, to }
        })

    } catch (error) {
        console.error('Error fetching Fitbit data:', error)
        return NextResponse.json(
            { error: 'Failed to fetch Fitbit data' },
            { status: 500 }
        )
    }
}