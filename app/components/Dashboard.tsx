'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Activity, Utensils, Dumbbell, Target, Home } from 'lucide-react'
import PageLayout from './PageLayout'
import GoalsSummary from './GoalsSummary'
import MissingDataNotifications from './MissingDataNotifications'

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 mb-6 md:mb-8">
                <div className="card">
                    <div className="flex flex-col sm:flex-row sm:items-center md:flex-col md:items-start lg:flex-row lg:items-center">
                        <div className="p-2 md:p-3 bg-green-100 rounded-lg mb-2 sm:mb-0 md:mb-2 lg:mb-0 self-start">
                            <Utensils className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                        </div>
                        <div className="sm:ml-3 md:ml-0 lg:ml-4">
                            <p className="text-xs md:text-sm font-medium text-gray-600">食事記録</p>
                            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{data.meals}回</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex flex-col sm:flex-row sm:items-center md:flex-col md:items-start lg:flex-row lg:items-center">
                        <div className="p-2 md:p-3 bg-blue-100 rounded-lg mb-2 sm:mb-0 md:mb-2 lg:mb-0 self-start">
                            <Dumbbell className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                        </div>
                        <div className="sm:ml-3 md:ml-0 lg:ml-4">
                            <p className="text-xs md:text-sm font-medium text-gray-600">ワークアウト</p>
                            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{data.workouts}回</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex flex-col sm:flex-row sm:items-center md:flex-col md:items-start lg:flex-row lg:items-center">
                        <div className="p-2 md:p-3 bg-red-100 rounded-lg mb-2 sm:mb-0 md:mb-2 lg:mb-0 self-start">
                            <Target className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
                        </div>
                        <div className="sm:ml-3 md:ml-0 lg:ml-4">
                            <p className="text-xs md:text-sm font-medium text-gray-600">カロリー</p>
                            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{data.calories}</p>
                        </div>
                    </div>
                </div>

                <div className="card md:col-span-3 lg:col-span-1">
                    <div className="flex flex-col sm:flex-row sm:items-center md:flex-col md:items-start lg:flex-row lg:items-center">
                        <div className="p-2 md:p-3 bg-purple-100 rounded-lg mb-2 sm:mb-0 md:mb-2 lg:mb-0 self-start">
                            <Activity className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                        </div>
                        <div className="sm:ml-3 md:ml-0 lg:ml-4">
                            <p className="text-xs md:text-sm font-medium text-gray-600">歩数</p>
                            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{data.steps.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* データ不足通知 */}
            <div className="mb-8">
                <MissingDataNotifications />
            </div>

            {/* クイックアクション */}
            <div className="card mb-6 md:mb-8">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">クイックアクション</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    <button
                        onClick={() => window.location.href = '/meals'}
                        className="min-h-[48px] md:min-h-[52px] px-3 py-3 text-sm md:text-base font-medium rounded-lg transition-colors bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white flex items-center justify-center whitespace-nowrap"
                    >
                        <Utensils className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                        食事記録
                    </button>
                    <button
                        onClick={() => window.location.href = '/workouts'}
                        className="min-h-[48px] md:min-h-[52px] px-3 py-3 text-sm md:text-base font-medium rounded-lg transition-colors bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white flex items-center justify-center whitespace-nowrap"
                    >
                        <Dumbbell className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">ワークアウト開始</span>
                        <span className="sm:hidden">ワークアウト</span>
                    </button>
                    <button
                        onClick={() => window.location.href = '/activity'}
                        className="min-h-[48px] md:min-h-[52px] px-3 py-3 text-sm md:text-base font-medium rounded-lg transition-colors bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800 flex items-center justify-center md:col-span-2 lg:col-span-1 whitespace-nowrap"
                    >
                        <Activity className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">活動データ確認</span>
                        <span className="sm:hidden">活動データ</span>
                    </button>
                </div>
            </div>

            {/* 目標の進捗 */}
            <div className="mb-8">
                <GoalsSummary />
            </div>

            {/* トレンド分析 */}
            <div className="card mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                    <h2 className="text-base md:text-lg font-semibold text-gray-900">トレンド分析</h2>
                    <button
                        onClick={() => window.location.href = '/dashboard/trends'}
                        className="text-sm text-primary-600 hover:text-primary-700 self-start sm:self-auto"
                    >
                        詳細を見る →
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <button
                        onClick={() => window.location.href = '/dashboard/trends?period=week'}
                        className="p-4 md:p-5 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-left transition-colors min-h-[80px] md:min-h-[88px]"
                    >
                        <div className="text-sm md:text-base font-medium text-gray-900">週次トレンド</div>
                        <div className="text-xs md:text-sm text-gray-500 mt-1">過去12週間のデータ分析</div>
                    </button>
                    <button
                        onClick={() => window.location.href = '/dashboard/trends?period=month'}
                        className="p-4 md:p-5 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-left transition-colors min-h-[80px] md:min-h-[88px]"
                    >
                        <div className="text-sm md:text-base font-medium text-gray-900">月次トレンド</div>
                        <div className="text-xs md:text-sm text-gray-500 mt-1">過去6ヶ月のデータ分析</div>
                    </button>
                </div>
            </div>

            {/* 今週の進捗 */}
            <div className="card">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">今週の進捗</h2>
                <div className="space-y-4 md:space-y-6">
                    <div>
                        <div className="flex justify-between text-sm md:text-base text-gray-600 mb-2">
                            <span>食事記録</span>
                            <span className="font-medium">5/7日</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 md:h-3">
                            <div className="bg-green-600 h-2 md:h-3 rounded-full transition-all duration-300" style={{ width: '71%' }}></div>
                        </div>
                        <div className="text-xs md:text-sm text-gray-500 mt-1">71% 完了</div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm md:text-base text-gray-600 mb-2">
                            <span>ワークアウト</span>
                            <span className="font-medium">3/4回</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 md:h-3">
                            <div className="bg-blue-600 h-2 md:h-3 rounded-full transition-all duration-300" style={{ width: '75%' }}></div>
                        </div>
                        <div className="text-xs md:text-sm text-gray-500 mt-1">75% 完了</div>
                    </div>
                </div>
            </div>
        </PageLayout>
    )
}