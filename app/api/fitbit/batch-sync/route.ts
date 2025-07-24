import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        const { days = 7, startDate } = await request.json()

        // 過去N日分の日付を生成、またはstartDateから指定日数分
        const dates = []
        const baseDate = startDate ? new Date(startDate) : new Date()

        for (let i = 0; i < days; i++) {
            const date = new Date(baseDate)
            date.setDate(date.getDate() - i)
            dates.push(date.toISOString().split('T')[0])
        }

        const results = []
        let consecutiveErrors = 0
        const maxConsecutiveErrors = 3

        // 各日付に対して同期を実行
        for (const date of dates) {
            try {
                const syncResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/fitbit/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': request.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({ date }),
                })

                const syncResult = await syncResponse.json()

                if (syncResponse.ok) {
                    consecutiveErrors = 0 // リセット
                    results.push({
                        date,
                        success: true,
                        result: syncResult
                    })
                } else {
                    consecutiveErrors++
                    results.push({
                        date,
                        success: false,
                        error: syncResult.error || 'Sync failed'
                    })

                    // 連続エラーが多い場合は中断
                    if (consecutiveErrors >= maxConsecutiveErrors) {
                        console.error(`Batch sync stopped due to ${maxConsecutiveErrors} consecutive errors`)
                        break
                    }
                }

                // API制限を避けるため少し待機（エラー時は長めに）
                const delay = syncResponse.ok ? 1000 : 2000
                await new Promise(resolve => setTimeout(resolve, delay))

            } catch (error) {
                consecutiveErrors++
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'

                results.push({
                    date,
                    success: false,
                    error: errorMessage
                })

                console.error(`Batch sync error for ${date}:`, errorMessage)

                // 連続エラーが多い場合は中断
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    break
                }

                // エラー時は長めに待機
                await new Promise(resolve => setTimeout(resolve, 3000))
            }
        }

        const successCount = results.filter(r => r.success).length
        const errorCount = results.filter(r => !r.success).length

        return NextResponse.json({
            success: errorCount === 0 || successCount > 0,
            totalDays: days,
            processedDays: results.length,
            successfulSyncs: successCount,
            failedSyncs: errorCount,
            stoppedEarly: consecutiveErrors >= maxConsecutiveErrors,
            results
        })

    } catch (error) {
        console.error('Batch sync error:', error)
        return NextResponse.json(
            { error: 'Batch sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}