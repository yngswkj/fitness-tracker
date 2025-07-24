import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getFitbitDataSummary, getSyncErrors } from '../../../../lib/fitbit'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get('days') || '7')

        // Get Fitbit data summary
        const dataSummary = await getFitbitDataSummary(userId, days)

        // Get recent sync errors
        const recentErrors = await getSyncErrors(userId, days)

        // Get sync frequency analysis
        const syncFrequency = await getSyncFrequency(userId, days)

        // Calculate sync health score
        const healthScore = calculateSyncHealthScore(dataSummary, recentErrors, syncFrequency)

        return NextResponse.json({
            success: true,
            period: `${days} days`,
            summary: {
                totalDays: parseInt(dataSummary?.total_days || '0'),
                daysWithSteps: parseInt(dataSummary?.days_with_steps || '0'),
                daysWithSleep: parseInt(dataSummary?.days_with_sleep || '0'),
                daysWithHeartRate: parseInt(dataSummary?.days_with_heart_rate || '0'),
                averageSteps: Math.round(parseFloat(dataSummary?.avg_steps || '0')),
                averageSleepHours: Math.round(parseFloat(dataSummary?.avg_sleep_hours || '0') * 100) / 100,
                lastSync: dataSummary?.last_sync
            },
            errors: {
                total: recentErrors.length,
                byType: groupErrorsByType(recentErrors),
                recent: recentErrors.slice(0, 5) // Last 5 errors
            },
            syncFrequency,
            healthScore: {
                overall: healthScore,
                status: getHealthStatus(healthScore),
                recommendations: getHealthRecommendations(healthScore, dataSummary, recentErrors)
            }
        })

    } catch (error) {
        console.error('Error fetching sync status:', error)
        return NextResponse.json(
            { error: 'Failed to fetch sync status' },
            { status: 500 }
        )
    }
}

async function getSyncFrequency(userId: string, days: number) {
    try {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        const cutoffDateStr = cutoffDate.toISOString()

        const { rows } = await sql`
            SELECT 
                DATE(synced_at) as sync_date,
                COUNT(*) as sync_count,
                MAX(synced_at) as last_sync_time
            FROM fitbit_data 
            WHERE user_id = ${userId} 
            AND synced_at >= ${cutoffDateStr}
            GROUP BY DATE(synced_at)
            ORDER BY sync_date DESC
        `

        const totalSyncs = rows.reduce((sum, row) => sum + parseInt(row.sync_count), 0)
        const daysWithSyncs = rows.length
        const averageSyncsPerDay = daysWithSyncs > 0 ? totalSyncs / daysWithSyncs : 0

        return {
            totalSyncs,
            daysWithSyncs,
            averageSyncsPerDay: Math.round(averageSyncsPerDay * 100) / 100,
            dailyBreakdown: rows
        }
    } catch (error) {
        console.error('Error getting sync frequency:', error)
        return {
            totalSyncs: 0,
            daysWithSyncs: 0,
            averageSyncsPerDay: 0,
            dailyBreakdown: []
        }
    }
}

function groupErrorsByType(errors: any[]) {
    const grouped: { [key: string]: number } = {}
    errors.forEach(error => {
        grouped[error.error_type] = (grouped[error.error_type] || 0) + 1
    })
    return grouped
}

function calculateSyncHealthScore(dataSummary: any, errors: any[], syncFrequency: any): number {
    let score = 100

    // Deduct points for missing data
    const totalDays = parseInt(dataSummary?.total_days || '0')
    const daysWithSteps = parseInt(dataSummary?.days_with_steps || '0')
    const daysWithSleep = parseInt(dataSummary?.days_with_sleep || '0')
    const daysWithHeartRate = parseInt(dataSummary?.days_with_heart_rate || '0')

    if (totalDays > 0) {
        const stepsCompleteness = daysWithSteps / totalDays
        const sleepCompleteness = daysWithSleep / totalDays
        const heartRateCompleteness = daysWithHeartRate / totalDays

        // Weight different data types
        const dataScore = (stepsCompleteness * 0.4 + sleepCompleteness * 0.3 + heartRateCompleteness * 0.3) * 60
        score = Math.min(score, 40 + dataScore)
    }

    // Deduct points for errors
    const errorPenalty = Math.min(errors.length * 5, 30)
    score -= errorPenalty

    // Deduct points for infrequent syncing
    if (syncFrequency.averageSyncsPerDay < 0.5) {
        score -= 20
    } else if (syncFrequency.averageSyncsPerDay < 1) {
        score -= 10
    }

    return Math.max(0, Math.round(score))
}

function getHealthStatus(score: number): string {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    if (score >= 20) return 'poor'
    return 'critical'
}

function getHealthRecommendations(score: number, dataSummary: any, errors: any[]): string[] {
    const recommendations: string[] = []

    if (score < 60) {
        recommendations.push('Consider running a batch sync to catch up on missing data')
    }

    if (errors.length > 5) {
        recommendations.push('Multiple sync errors detected - check your Fitbit connection')
    }

    const daysWithSteps = parseInt(dataSummary?.days_with_steps || '0')
    const totalDays = parseInt(dataSummary?.total_days || '0')

    if (totalDays > 0 && daysWithSteps / totalDays < 0.7) {
        recommendations.push('Steps data is incomplete - ensure your Fitbit device is syncing regularly')
    }

    const daysWithSleep = parseInt(dataSummary?.days_with_sleep || '0')
    if (totalDays > 0 && daysWithSleep / totalDays < 0.5) {
        recommendations.push('Sleep data is missing - make sure you wear your Fitbit while sleeping')
    }

    if (recommendations.length === 0) {
        recommendations.push('Sync is working well - no action needed')
    }

    return recommendations
}