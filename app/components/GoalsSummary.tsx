'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Target, TrendingUp, Award, Plus, ArrowRight } from 'lucide-react'

interface Goal {
    id: number
    type: string
    title: string
    target_value: number
    unit: string
    period: string
    status: 'active' | 'completed' | 'paused'
}

interface GoalProgressData {
    goal_id: number
    current_value: number
    progress_percentage: number
    is_achieved: boolean
}

export default function GoalsSummary() {
    const [goals, setGoals] = useState<Goal[]>([])
    const [progressData, setProgressData] = useState<Record<number, GoalProgressData>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchGoalsData()
    }, [])

    const fetchGoalsData = async () => {
        try {
            // 目標一覧を取得
            const goalsResponse = await fetch('/api/goals')
            if (goalsResponse.ok) {
                const goalsData = await goalsResponse.json()
                const activeGoals = (goalsData.goals || []).filter((goal: Goal) => goal.status === 'active')
                setGoals(activeGoals)

                // 各目標の進捗データを取得
                if (activeGoals.length > 0) {
                    const progressPromises = activeGoals.slice(0, 3).map(async (goal: Goal) => {
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
                }
            }
        } catch (error) {
            console.error('目標データの取得に失敗:', error)
        } finally {
            setLoading(false)
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

    const getProgressColor = (percentage: number, isAchieved: boolean) => {
        if (isAchieved) return 'text-green-600'
        if (percentage >= 80) return 'text-yellow-600'
        if (percentage >= 50) return 'text-blue-600'
        return 'text-gray-600'
    }

    const getProgressBgColor = (percentage: number, isAchieved: boolean) => {
        if (isAchieved) return 'bg-green-500'
        if (percentage >= 80) return 'bg-yellow-500'
        if (percentage >= 50) return 'bg-blue-500'
        return 'bg-gray-400'
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center space-x-3">
                                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                                <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                                <div className="h-4 w-12 bg-gray-200 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const activeGoals = goals.filter(goal => goal.status === 'active')
    const completedGoals = goals.filter(goal => goal.status === 'completed')
    const displayGoals = activeGoals.slice(0, 3)

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-primary-600" />
                    目標の進捗
                </h2>
                <Link
                    href="/goals"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
                >
                    すべて見る
                    <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
            </div>

            {displayGoals.length > 0 ? (
                <div className="space-y-4">
                    {/* 統計サマリー */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{activeGoals.length}</div>
                            <div className="text-xs text-gray-500">アクティブ</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{completedGoals.length}</div>
                            <div className="text-xs text-gray-500">達成済み</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                                {activeGoals.length > 0 ? Math.round((completedGoals.length / (activeGoals.length + completedGoals.length)) * 100) : 0}%
                            </div>
                            <div className="text-xs text-gray-500">達成率</div>
                        </div>
                    </div>

                    {/* 目標リスト */}
                    <div className="space-y-3">
                        {displayGoals.map((goal) => {
                            const progress = progressData[goal.id]
                            const progressPercentage = progress?.progress_percentage || 0
                            const isAchieved = progress?.is_achieved || false
                            const currentValue = progress?.current_value || 0

                            return (
                                <div key={goal.id} className="flex items-center space-x-3">
                                    <span className="text-lg">{getGoalTypeIcon(goal.type)}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {goal.title}
                                            </p>
                                            <div className="flex items-center space-x-2">
                                                {isAchieved && (
                                                    <Award className="h-4 w-4 text-yellow-500" />
                                                )}
                                                <span className={`text-xs font-semibold ${getProgressColor(progressPercentage, isAchieved)}`}>
                                                    {Math.round(progressPercentage)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-300 ${getProgressBgColor(progressPercentage, isAchieved)}`}
                                                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                            ></div>
                                        </div>
                                        {progress && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {currentValue.toLocaleString()} / {(goal.target_value || 0).toLocaleString()} {goal.unit}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {activeGoals.length > 3 && (
                        <div className="text-center pt-2">
                            <Link
                                href="/goals"
                                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                            >
                                他 {activeGoals.length - 3} 個の目標を見る
                            </Link>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Target className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-4">設定された目標がありません</p>
                    <Link
                        href="/goals"
                        className="inline-flex items-center px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">目標を設定</span>
                        <span className="sm:hidden">設定</span>
                    </Link>
                </div>
            )}
        </div>
    )
}