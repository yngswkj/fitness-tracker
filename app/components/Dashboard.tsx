'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Activity, Utensils, Dumbbell, Target, Home } from 'lucide-react'
import PageLayout from './PageLayout'

interface DashboardData {
    meals: number
    workouts: number
    calories: number
    steps: number
}

export default function Dashboard() {
    const { data: session } = useSession()
    const [data, setData] = useState<DashboardData>({
        meals: 0,
        workouts: 0,
        calories: 0,
        steps: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd')
            const response = await fetch(`/api/dashboard/summary?date=${today}`)
            if (response.ok) {
                const result = await response.json()
                setData(result)
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">読み込み中...</p>
                </div>
            </div>
        )
    }

    return (
        <PageLayout
            title={`おはようございます、${session?.user?.name}さん`}
            description={format(new Date(), 'yyyy年M月d日（E）', { locale: ja })}
            icon={Home}
        >
            {/* 今日のサマリー */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Utensils className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">食事記録</p>
                            <p className="text-2xl font-bold text-gray-900">{data.meals}回</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Dumbbell className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">ワークアウト</p>
                            <p className="text-2xl font-bold text-gray-900">{data.workouts}回</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Target className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">カロリー</p>
                            <p className="text-2xl font-bold text-gray-900">{data.calories}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Activity className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">歩数</p>
                            <p className="text-2xl font-bold text-gray-900">{data.steps.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* クイックアクション */}
            <div className="card mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={() => window.location.href = '/meals'}
                        className="btn-primary flex items-center justify-center"
                    >
                        <Utensils className="h-5 w-5 mr-2" />
                        食事記録
                    </button>
                    <button
                        onClick={() => window.location.href = '/workouts/add'}
                        className="btn-primary flex items-center justify-center"
                    >
                        <Dumbbell className="h-5 w-5 mr-2" />
                        ワークアウト開始
                    </button>
                    <button
                        onClick={() => window.location.href = '/activity'}
                        className="btn-secondary flex items-center justify-center"
                    >
                        <Activity className="h-5 w-5 mr-2" />
                        活動データ確認
                    </button>
                </div>
            </div>

            {/* 今週の進捗 */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">今週の進捗</h2>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>食事記録</span>
                            <span>5/7日</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: '71%' }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>ワークアウト</span>
                            <span>3/4回</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    )
}