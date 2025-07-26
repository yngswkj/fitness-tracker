'use client'

import { useState, useEffect } from 'react'
import { format, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Target, TrendingUp, TrendingDown, Award, Calendar, Edit, Trash2 } from 'lucide-react'

interface Goal {
    id: number
    type: string
    title: string
    description?: string
    target_value: number
    unit: string
    period: string
    start_date: string
    end_date?: string
    status: 'active' | 'completed' | 'paused'
    created_at: string
}

interface GoalProgressData {
    goal_id: number
    current_value: number
    progress_percentage: number
    last_updated: string
    period_start: string
    period_end: string
    is_achieved: boolean
}

interface GoalProgressProps {
    goals: Goal[]
    onEditGoal: (goal: Goal) => void
    onDeleteGoal: (goalId: number) => void
    onRefresh: () => void
}

export default function GoalProgress({ goals, onEditGoal, onDeleteGoal, onRefresh }: GoalProgressProps) {
    const [progressData, setProgressData] = useState<Record<number, GoalProgressData>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        fetchProgressData()
    }, [goals])

    const fetchProgressData = async () => {
        if (goals.length === 0) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const progressPromises = goals.map(async (goal) => {
                try {
                    const response = await fetch(`/api/goals/${goal.id}/progress?summary=true`)
                    if (response.ok) {
                        const data = await response.json()
                        // データの安全性を確保
                        const safeData = {
                            ...data,
                            current_value: parseFloat(data.current_value) || 0,
                            progress_percentage: parseFloat(data.progress_percentage) || 0,
                            is_achieved: Boolean(data.is_achieved)
                        }
                        return { goalId: goal.id, data: safeData }
                    }
                } catch (error) {
                    console.error(`目標 ${goal.id} の進捗取得エラー:`, error)
                }
                return { goalId: goal.id, data: null }
            })

            const results = await Promise.all(progressPromises)
            const progressMap: Record<number, GoalProgressData> = {}

            results.forEach(({ goalId, data }) => {
                if (data) {
                    progressMap[goalId] = data
                }
            })

            setProgressData(progressMap)
        } catch (error) {
            console.error('進捗データの取得に失敗:', error)
            setError('進捗データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const getProgressColor = (percentage: number, isAchieved: boolean) => {
        if (isAchieved) return 'text-green-600'
        if (percentage >= 80) return 'text-yellow-600'
        if (percentage >= 50) return 'text-blue-600'
        return 'text-gray-600'
    }

    const getProgressBgColor = (percentage: number, isAchieved: boolean) => {
        if (isAchieved) return 'bg-green-100'
        if (percentage >= 80) return 'bg-yellow-100'
        if (percentage >= 50) return 'bg-blue-100'
        return 'bg-gray-100'
    }

    const getProgressBarColor = (percentage: number, isAchieved: boolean) => {
        if (isAchieved) return 'bg-green-500'
        if (percentage >= 80) return 'bg-yellow-500'
        if (percentage >= 50) return 'bg-blue-500'
        return 'bg-gray-400'
    }

    const formatPeriodText = (goal: Goal, progress?: GoalProgressData) => {
        if (!progress || !progress.period_start) return ''

        // 日付の有効性をチェック
        const startDate = new Date(progress.period_start)
        const endDate = progress.period_end ? new Date(progress.period_end) : startDate

        // 無効な日付の場合はデフォルト表示
        if (isNaN(startDate.getTime()) || (progress.period_end && isNaN(endDate.getTime()))) {
            return goal.period === 'ongoing' ? '継続中' : '期間不明'
        }

        try {
            switch (goal.period) {
                case 'daily':
                    return format(startDate, 'M月d日', { locale: ja })
                case 'weekly':
                    return `${format(startDate, 'M/d', { locale: ja })} - ${format(endDate, 'M/d', { locale: ja })}`
                case 'monthly':
                    return format(startDate, 'yyyy年M月', { locale: ja })
                case 'ongoing':
                    return '継続中'
                default:
                    return ''
            }
        } catch (error) {
            console.error('Date formatting error:', error)
            return goal.period === 'ongoing' ? '継続中' : '期間不明'
        }
    }

    const getRemainingDays = (goal: Goal) => {
        if (!goal.end_date) return null

        try {
            const today = new Date()
            const endDate = new Date(goal.end_date)

            // 無効な日付の場合はnullを返す
            if (isNaN(endDate.getTime())) return null

            const remaining = differenceInDays(endDate, today)
            return remaining > 0 ? remaining : 0
        } catch (error) {
            console.error('Date calculation error:', error)
            return null
        }
    }

    const getGoalTypeIcon = (type: string) => {
        switch (type) {
            case 'workout_frequency': return '🏋️'
            case 'calories_daily': return '🍽️'
            case 'protein_daily': return '🥩'
            case 'weight_target': return '⚖️'
            case 'exercise_pr': return '💪'
            default: return '🎯'
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                ))}
            </div>
        )
    }

    if (goals.length === 0) {
        return (
            <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">目標が設定されていません</h3>
                <p className="text-gray-500">新しい目標を設定して進捗を追跡しましょう</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                    <button
                        onClick={fetchProgressData}
                        className="text-red-600 hover:text-red-800 text-sm underline mt-2"
                    >
                        再試行
                    </button>
                </div>
            )}

            {goals.map((goal) => {
                const progress = progressData[goal.id]
                const remainingDays = getRemainingDays(goal)
                const progressPercentage = progress?.progress_percentage || 0
                const isAchieved = progress?.is_achieved || false
                const currentValue = progress?.current_value || 0

                return (
                    <div
                        key={goal.id}
                        className={`bg-white rounded-lg shadow-sm border-l-4 ${isAchieved ? 'border-green-500' : 'border-blue-500'
                            } p-6 hover:shadow-md transition-shadow`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start space-x-3">
                                <span className="text-2xl">{getGoalTypeIcon(goal.type)}</span>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        {goal.title}
                                        {isAchieved && (
                                            <Award className="h-5 w-5 text-yellow-500 ml-2" />
                                        )}
                                    </h3>
                                    {goal.description && (
                                        <p className="text-gray-600 text-sm mt-1">{goal.description}</p>
                                    )}
                                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                        <span className="flex items-center">
                                            <Calendar className="h-4 w-4 mr-1" />
                                            {formatPeriodText(goal, progress)}
                                        </span>
                                        {remainingDays !== null && (
                                            <span className={`${remainingDays <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                                                残り{remainingDays}日
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => onEditGoal(goal)}
                                    className="text-gray-400 hover:text-blue-600 p-1"
                                    title="編集"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteGoal(goal.id)}
                                    className="text-gray-400 hover:text-red-600 p-1"
                                    title="削除"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {progress ? (
                            <div className="space-y-3">
                                {/* 進捗バー */}
                                <div className="relative">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            進捗: {currentValue.toLocaleString()} / {(goal.target_value || 0).toLocaleString()} {goal.unit}
                                        </span>
                                        <span className={`text-sm font-semibold ${getProgressColor(progressPercentage, isAchieved)}`}>
                                            {Math.round(progressPercentage)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                            className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(progressPercentage, isAchieved)}`}
                                            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* 達成状況 */}
                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getProgressBgColor(progressPercentage, isAchieved)} ${getProgressColor(progressPercentage, isAchieved)}`}>
                                    {isAchieved ? (
                                        <>
                                            <Award className="h-3 w-3 mr-1" />
                                            達成済み
                                        </>
                                    ) : progressPercentage >= 80 ? (
                                        <>
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            もう少し
                                        </>
                                    ) : progressPercentage >= 50 ? (
                                        <>
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            順調
                                        </>
                                    ) : (
                                        <>
                                            <TrendingDown className="h-3 w-3 mr-1" />
                                            要努力
                                        </>
                                    )}
                                </div>

                                {progress.last_updated && (
                                    <p className="text-xs text-gray-500">
                                        最終更新: {format(new Date(progress.last_updated), 'M月d日 HH:mm', { locale: ja })}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-gray-500 text-sm">進捗データを読み込み中...</p>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}