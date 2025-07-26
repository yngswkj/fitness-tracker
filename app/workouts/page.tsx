'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Play, Square, Clock, Dumbbell, TrendingUp } from 'lucide-react'
import PageLayout from '@/app/components/PageLayout'
import PageHeader from '@/app/components/PageHeader'
import WorkoutList from '@/app/components/WorkoutList'
import WorkoutStats from '@/app/components/WorkoutStats'
import StartWorkoutModal from '@/app/components/StartWorkoutModal'
import { Workout, WorkoutSummary } from '@/types/workout'

export default function WorkoutsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [summary, setSummary] = useState<WorkoutSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showStartModal, setShowStartModal] = useState(false)
    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null)

    // 認証チェック
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin')
        }
    }, [status, router])

    // ワークアウトデータの取得
    useEffect(() => {
        if (session) {
            fetchWorkouts()
        }
    }, [session])

    const fetchWorkouts = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/workouts')

            if (!response.ok) {
                throw new Error('ワークアウトデータの取得に失敗しました')
            }

            const data = await response.json()
            setWorkouts(data.workouts || [])
            setSummary(data.summary || [])

            // 進行中のワークアウトをチェック
            const active = data.workouts?.find((w: Workout) => !w.ended_at)
            setActiveWorkout(active || null)

        } catch (error) {
            console.error('Fetch workouts error:', error)
            setError(error instanceof Error ? error.message : 'データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const handleStartWorkout = async (workoutData: { name: string; notes?: string }) => {
        try {
            const response = await fetch('/api/workouts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(workoutData)
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'ワークアウトの開始に失敗しました')
            }

            const data = await response.json()
            setActiveWorkout(data.workout)
            setShowStartModal(false)

            // ワークアウト詳細ページに移動
            router.push(`/workouts/${data.workout.id}`)

        } catch (error) {
            console.error('Start workout error:', error)
            setError(error instanceof Error ? error.message : 'ワークアウトの開始に失敗しました')
        }
    }

    const handleCompleteWorkout = async (workoutId: number) => {
        try {
            const response = await fetch(`/api/workouts/${workoutId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'complete'
                })
            })

            if (!response.ok) {
                throw new Error('ワークアウトの完了に失敗しました')
            }

            setActiveWorkout(null)
            fetchWorkouts() // データを再取得

        } catch (error) {
            console.error('Complete workout error:', error)
            setError(error instanceof Error ? error.message : 'ワークアウトの完了に失敗しました')
        }
    }

    const handleDeleteWorkout = async (workoutId: number) => {
        if (!confirm('このワークアウトを削除しますか？')) {
            return
        }

        try {
            const response = await fetch(`/api/workouts/${workoutId}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('ワークアウトの削除に失敗しました')
            }

            fetchWorkouts() // データを再取得

        } catch (error) {
            console.error('Delete workout error:', error)
            setError(error instanceof Error ? error.message : 'ワークアウトの削除に失敗しました')
        }
    }

    if (status === 'loading' || loading) {
        return (
            <PageLayout title="ワークアウト" description="読み込み中...">
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
            title="ワークアウト"
            description="筋力トレーニングを記録して進捗を追跡しましょう"
            icon={Dumbbell}
        >

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* アクションボタン */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
                {activeWorkout ? (
                    <div className="flex items-center space-x-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center text-green-600">
                            <Play className="h-5 w-5 mr-2" />
                            <span className="font-medium">進行中: {activeWorkout.name}</span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => router.push(`/workouts/${activeWorkout.id}`)}
                                className="btn-primary text-sm"
                            >
                                続行
                            </button>
                            <button
                                onClick={() => handleCompleteWorkout(activeWorkout.id)}
                                className="btn-secondary text-sm flex items-center"
                            >
                                <Square className="h-4 w-4 mr-1" />
                                完了
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowStartModal(true)}
                        className="btn-primary flex items-center"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        ワークアウト開始
                    </button>
                )}
            </div>

            {/* 統計情報 */}
            <div className="mb-8">
                <WorkoutStats summary={summary} />
            </div>

            {/* ワークアウト履歴 */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Clock className="h-5 w-5 mr-2" />
                        ワークアウト履歴
                    </h2>
                    <button
                        onClick={() => router.push('/workouts/stats')}
                        className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                    >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        詳細統計
                    </button>
                </div>

                <WorkoutList
                    workouts={workouts}
                    onDelete={handleDeleteWorkout}
                    onComplete={handleCompleteWorkout}
                />
            </div>

            {/* ワークアウト開始モーダル */}
            {showStartModal && (
                <StartWorkoutModal
                    onSubmit={handleStartWorkout}
                    onClose={() => setShowStartModal(false)}
                />
            )}
        </PageLayout>
    )
}