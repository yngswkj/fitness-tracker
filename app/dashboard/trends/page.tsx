'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, TrendingUp } from 'lucide-react'
import PageLayout from '@/app/components/PageLayout'
import TrendsAnalysis from '@/app/components/TrendsAnalysis'

interface TrendsData {
    period: 'week' | 'month'
    weeks?: number
    months?: number
    workouts: Array<{
        week_start?: string
        month_start?: string
        workout_count: number
        completed_workouts: number
        avg_duration_minutes: number | null
        total_completed: number
    }>
    meals: Array<{
        week_start?: string
        month_start?: string
        meal_count: number
        avg_calories: number | null
        avg_protein: number | null
        avg_carbs: number | null
        avg_fat: number | null
        total_calories: number | null
    }>
    exercises: Array<{
        week_start?: string
        month_start?: string
        total_exercises: number
        unique_exercises: number
        total_reps: number
        avg_weight: number | null
        max_weight: number | null
    }>
}

export default function TrendsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [trendsData, setTrendsData] = useState<TrendsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [period, setPeriod] = useState<'week' | 'month'>('week')
    const [weeks, setWeeks] = useState(12)
    const [months, setMonths] = useState(6)

    // 認証チェック
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin')
        }
    }, [status, router])

    // トレンドデータの取得
    useEffect(() => {
        if (session) {
            fetchTrendsData()
        }
    }, [session, period, weeks, months])

    const fetchTrendsData = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                period,
                ...(period === 'week' ? { weeks: weeks.toString() } : { months: months.toString() })
            })

            const response = await fetch(`/api/dashboard/trends?${params}`)

            if (!response.ok) {
                throw new Error('トレンドデータの取得に失敗しました')
            }

            const data = await response.json()
            setTrendsData(data)

        } catch (error) {
            console.error('Fetch trends error:', error)
            setError(error instanceof Error ? error.message : 'データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const periodOptions = [
        { value: 'week' as const, label: '週次' },
        { value: 'month' as const, label: '月次' }
    ]

    const weekOptions = [
        { value: 4, label: '4週間' },
        { value: 8, label: '8週間' },
        { value: 12, label: '12週間' },
        { value: 24, label: '24週間' }
    ]

    const monthOptions = [
        { value: 3, label: '3ヶ月' },
        { value: 6, label: '6ヶ月' },
        { value: 12, label: '12ヶ月' }
    ]

    if (status === 'loading' || loading) {
        return (
            <PageLayout title="トレンド分析" description="読み込み中...">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            </PageLayout>
        )
    }

    if (!session) {
        return null
    }

    return (
        <PageLayout
            title="トレンド分析"
            description="週次・月次のデータトレンドとパターンを分析"
            icon={TrendingUp}
        >
            {/* ヘッダーとコントロール */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/')}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                </div>

                {/* 期間選択コントロール */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as 'week' | 'month')}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {periodOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {period === 'week' ? (
                        <select
                            value={weeks}
                            onChange={(e) => setWeeks(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {weekOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <select
                            value={months}
                            onChange={(e) => setMonths(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {monthOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* トレンド分析コンテンツ */}
            {trendsData ? (
                <TrendsAnalysis data={trendsData} />
            ) : (
                <div className="card">
                    <div className="text-center py-12">
                        <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                            データがありません
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            ワークアウトや食事を記録してトレンドを確認しましょう
                        </p>
                    </div>
                </div>
            )}
        </PageLayout>
    )
}