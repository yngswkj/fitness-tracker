import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getSyncErrors, clearOldSyncErrors } from '@/lib/fitbit'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get('days') || '7')

        const errors = await getSyncErrors(session.user.id, days)

        return NextResponse.json({
            success: true,
            errors
        })

    } catch (error) {
        console.error('Error fetching sync errors:', error)
        return NextResponse.json(
            { error: 'Failed to fetch sync errors' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { days = 30 } = await request.json()

        await clearOldSyncErrors(session.user.id, days)

        return NextResponse.json({
            success: true,
            message: 'Old sync errors cleared'
        })

    } catch (error) {
        console.error('Error clearing sync errors:', error)
        return NextResponse.json(
            { error: 'Failed to clear sync errors' },
            { status: 500 }
        )
    }
}