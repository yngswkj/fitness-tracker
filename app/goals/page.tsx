'use client'

import { useState, useEffect } from 'react'
import { Plus, Target, RefreshCw } from 'lucide-react'
import PageLayout from '../components/PageLayout'
import GoalForm from '../components/GoalForm'
import GoalProgress from '../components/GoalProgress'
import MotivationalFeedback from '../components/MotivationalFeedback'

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
    is_achieved: boolean
    last_updated: string
}

export default function GoalsPage() {
    const [goals, setGoals] = useState<Goal[]>([])
    const [progressData, setProgressData] = useState<Record<number, GoalProgressData>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        fetchGoals()
    }, [])

    const fetchGoals = async () => {
        try {
            setLoading(true)
            setError('')
            const response = await fetch('/api/goals')

            if (!response.ok) {
                throw new Error('目標の取得に失敗しました')
            }

            const data = await response.json()
            const goalsList = data.goals || []
            setGoals(goalsList)

            // 進捗データを取得
            if (goalsList.length > 0) {
                const progressPromises = goalsList.map(async (goal: Goal) => {
                    const response = await fetch(`/api/goals/${goal.id}/progress?summary=true`)
                    if (response.ok) {
                        const data = await response.json()
                        return { goalId: goal.id, data }
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
        } catch (error) {
            console.error('目標取得エラー:', error)
            setError(error instanceof Error ? error.message : '目標の取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            // ワークアウト頻度目標の進捗を更新
            await fetch('/api/goals/refresh-progress', {
                method: 'POST'
            })

            // 目標一覧を再取得
            await fetchGoals()
        } catch (error) {
            console.error('Failed to refresh goals:', error)
        } finally {
            setRefreshing(false)
        }
    }

    const handleCreateGoal = async (goalData: any) => {
        try {
            const response = await fetch('/api/goals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(goalData),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || '目標の作成に失敗しました')
            }

            const newGoal = await response.json()
            setGoals(prev => [newGoal.goal, ...prev])
            setShowForm(false)
        } catch (error) {
            throw error // GoalFormで処理される
        }
    }

    const handleUpdateGoal = async (goalData: any) => {
        if (!editingGoal) return

        try {
            const response = await fetch(`/api/goals/${editingGoal.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(goalData),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || '目標の更新に失敗しました')
            }

            const updatedGoal = await response.json()
            setGoals(prev => prev.map(goal =>
                goal.id === editingGoal.id ? updatedGoal.goal : goal
            ))
            setEditingGoal(null)
        } catch (error) {
            throw error // GoalFormで処理される
        }
    }

    const handleDeleteGoal = async (goalId: number) => {
        if (!confirm('この目標を削除しますか？')) {
            return
        }

        try {
            const response = await fetch(`/api/goals/${goalId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error('目標の削除に失敗しました')
            }

            setGoals(prev => prev.filter(goal => goal.id !== goalId))
        } catch (error) {
            console.error('目標削除エラー:', error)
            setError(error instanceof Error ? error.message : '目標の削除に失敗しました')
        }
    }

    const handleEditGoal = (goal: Goal) => {
        setEditingGoal(goal)
    }

    const activeGoals = goals.filter(goal => goal.status === 'active')
    const completedGoals = goals.filter(goal => goal.status === 'completed')

    const actionsComponent = (
        <div className="flex items-center space-x-2 md:space-x-3">
            <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="min-h-[44px] px-3 py-3 text-sm md:text-base font-medium rounded-lg transition-colors bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800 flex items-center disabled:opacity-50 flex-1 sm:flex-initial justify-center whitespace-nowrap"
            >
                <RefreshCw className={`h-4 w-4 mr-2 flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">更新</span>
                <span className="sm:hidden">
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </span>
            </button>
            <button
                onClick={() => setShowForm(true)}
                className="min-h-[44px] px-3 py-3 text-sm md:text-base font-medium rounded-lg transition-colors bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white flex items-center flex-1 sm:flex-initial justify-center whitespace-nowrap"
            >
                <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">新しい目標</span>
                <span className="sm:hidden">追加</span>
            </button>
        </div>
    )

    if (loading) {
        return (
            <PageLayout
                title="目標管理"
                description="健康やフィットネスの目標を設定して、進捗を追跡しましょう"
                icon={Target}
                actions={actionsComponent}
            >
                <div className="animate-pulse">
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-lg shadow p-6">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                                <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </PageLayout>
        )
    }

    return (
        <PageLayout
            title="目標管理"
            description="健康やフィットネスの目標を設定して、進捗を追跡しましょう"
            icon={Target}
            actions={actionsComponent}
        >
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={fetchGoals}
                        className="text-red-600 hover:text-red-800 underline text-sm mt-2"
                    >
                        再試行
                    </button>
                </div>
            )}

            {/* 統計サマリー */}
            {goals.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
                    <div className="bg-white rounded-lg shadow p-3 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center">
                            <div className="flex-shrink-0 mb-2 md:mb-0">
                                <Target className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                            </div>
                            <div className="md:ml-4">
                                <p className="text-xs md:text-sm font-medium text-gray-500">アクティブ</p>
                                <p className="text-lg md:text-2xl font-semibold text-gray-900">{activeGoals.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-3 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center">
                            <div className="flex-shrink-0 mb-2 md:mb-0">
                                <div className="h-6 w-6 md:h-8 md:w-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-green-600 font-semibold text-sm md:text-base">✓</span>
                                </div>
                            </div>
                            <div className="md:ml-4">
                                <p className="text-xs md:text-sm font-medium text-gray-500">達成済み</p>
                                <p className="text-lg md:text-2xl font-semibold text-gray-900">{completedGoals.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-3 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center">
                            <div className="flex-shrink-0 mb-2 md:mb-0">
                                <div className="h-6 w-6 md:h-8 md:w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <span className="text-yellow-600 font-semibold text-sm md:text-base">%</span>
                                </div>
                            </div>
                            <div className="md:ml-4">
                                <p className="text-xs md:text-sm font-medium text-gray-500">達成率</p>
                                <p className="text-lg md:text-2xl font-semibold text-gray-900">
                                    {goals.length > 0 ? Math.round((completedGoals.length / goals.length) * 100) : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 動機付けフィードバック */}
            {goals.length > 0 && (
                <div className="mb-8">
                    <MotivationalFeedback goals={goals} progressData={progressData} />
                </div>
            )}

            {/* アクティブな目標 */}
            {activeGoals.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">アクティブな目標</h2>
                    <GoalProgress
                        goals={activeGoals}
                        onEditGoal={handleEditGoal}
                        onDeleteGoal={handleDeleteGoal}
                        onRefresh={handleRefresh}
                    />
                </div>
            )}

            {/* 達成済みの目標 */}
            {completedGoals.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">達成済みの目標</h2>
                    <GoalProgress
                        goals={completedGoals}
                        onEditGoal={handleEditGoal}
                        onDeleteGoal={handleDeleteGoal}
                        onRefresh={handleRefresh}
                    />
                </div>
            )}

            {/* 目標がない場合 */}
            {goals.length === 0 && !loading && (
                <div className="text-center py-12">
                    <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">目標を設定しましょう</h3>
                    <p className="text-gray-500 mb-6">
                        健康やフィットネスの目標を設定して、進捗を追跡しましょう
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-primary flex items-center mx-auto"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        最初の目標を設定
                    </button>
                </div>
            )}

            {/* 目標作成・編集フォーム */}
            {(showForm || editingGoal) && (
                <GoalForm
                    onSubmit={editingGoal ? handleUpdateGoal : handleCreateGoal}
                    onClose={() => {
                        setShowForm(false)
                        setEditingGoal(null)
                    }}
                    initialData={editingGoal}
                    isEditing={!!editingGoal}
                />
            )}
        </PageLayout>
    )
}