'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
    ArrowLeft,
    Play,
    Square,
    Plus,
    Clock,
    Edit,
    Save,
    Timer,
    Target
} from 'lucide-react'
import PageLayout from '@/app/components/PageLayout'
import PageHeader from '@/app/components/PageHeader'
import ExerciseList from '@/app/components/ExerciseList'
import AddExerciseModal from '@/app/components/AddExerciseModal'
import WorkoutTimer from '@/app/components/WorkoutTimer'
import { Workout, Exercise } from '@/types/workout'

export default function WorkoutDetailPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const workoutId = parseInt(params.id as string)

    const [workout, setWorkout] = useState<Workout | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showAddExercise, setShowAddExercise] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState({ name: '', notes: '' })
    const [saving, setSaving] = useState(false)

    // 認証チェック
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin')
        }
    }, [status, router])

    // ワークアウトデータの取得
    useEffect(() => {
        if (session && workoutId) {
            fetchWorkout()
        }
    }, [session, workoutId])

    const fetchWorkout = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/workouts/${workoutId}`)

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('ワークアウトが見つかりません')
                }
                throw new Error('ワークアウトデータの取得に失敗しました')
            }

            const data = await response.json()
            setWorkout(data.workout)
            setEditData({
                name: data.workout.name,
                notes: data.workout.notes || ''
            })

        } catch (error) {
            console.error('Fetch workout error:', error)
            setError(error instanceof Error ? error.message : 'データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const handleCompleteWorkout = async () => {
        if (!workout) return

        try {
            const response = await fetch(`/api/workouts/${workout.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'complete',
                    notes: editData.notes
                })
            })

            if (!response.ok) {
                throw new Error('ワークアウトの完了に失敗しました')
            }

            router.push('/workouts')

        } catch (error) {
            console.error('Complete workout error:', error)
            setError(error instanceof Error ? error.message : 'ワークアウトの完了に失敗しました')
        }
    }

    const handleSaveEdit = async () => {
        if (!workout) return

        setSaving(true)
        try {
            const response = await fetch(`/api/workouts/${workout.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editData.name,
                    notes: editData.notes
                })
            })

            if (!response.ok) {
                throw new Error('ワークアウトの更新に失敗しました')
            }

            const data = await response.json()
            setWorkout(data.workout)
            setIsEditing(false)

        } catch (error) {
            console.error('Update workout error:', error)
            setError(error instanceof Error ? error.message : 'ワークアウトの更新に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleAddExercise = async (exerciseData: any) => {
        try {
            const response = await fetch('/api/exercises', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...exerciseData,
                    workout_id: workoutId
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'エクササイズの追加に失敗しました')
            }

            setShowAddExercise(false)
            fetchWorkout() // データを再取得

        } catch (error) {
            console.error('Add exercise error:', error)
            setError(error instanceof Error ? error.message : 'エクササイズの追加に失敗しました')
        }
    }

    const handleUpdateExercises = () => {
        fetchWorkout() // データを再取得
    }

    const formatDuration = (startTime: string, endTime?: string) => {
        const start = new Date(startTime)
        const end = endTime ? new Date(endTime) : new Date()
        const diffMs = end.getTime() - start.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))

        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60

        if (hours > 0) {
            return `${hours}時間${mins}分`
        }
        return `${mins}分`
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

    if (!session || !workout) {
        return (
            <PageLayout title="エラー" description="ワークアウトが見つかりません">
                <div className="text-center py-12">
                    <p className="text-gray-500">{error || 'ワークアウトが見つかりません'}</p>
                    <button
                        onClick={() => router.push('/workouts')}
                        className="mt-4 btn-primary"
                    >
                        ワークアウト一覧に戻る
                    </button>
                </div>
            </PageLayout>
        )
    }

    const isActive = !workout.ended_at

    return (
        <PageLayout title={workout?.name || 'ワークアウト'} description="ワークアウトの詳細">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/workouts')}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-primary-500 focus:outline-none"
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-gray-900">{workout.name}</h1>
                        )}
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {format(new Date(workout.started_at), 'M月d日(E) HH:mm', { locale: ja })}開始
                            </span>
                            <span className="flex items-center">
                                <Timer className="h-4 w-4 mr-1" />
                                {formatDuration(workout.started_at, workout.ended_at)}
                            </span>
                            <span className="flex items-center">
                                <Target className="h-4 w-4 mr-1" />
                                {workout.exercises?.length || 0}種目
                            </span>
                        </div>
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center space-x-2">
                    {isActive && <WorkoutTimer startTime={workout.started_at} />}

                    {isEditing ? (
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="btn-primary text-sm flex items-center disabled:opacity-50"
                            >
                                <Save className="h-4 w-4 mr-1" />
                                {saving ? '保存中...' : '保存'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false)
                                    setEditData({
                                        name: workout.name,
                                        notes: workout.notes || ''
                                    })
                                }}
                                className="btn-secondary text-sm"
                            >
                                キャンセル
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <Edit className="h-5 w-5" />
                            </button>
                            {isActive && (
                                <button
                                    onClick={handleCompleteWorkout}
                                    className="btn-primary text-sm flex items-center"
                                >
                                    <Square className="h-4 w-4 mr-1" />
                                    完了
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* メモ */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    メモ
                </label>
                {isEditing ? (
                    <textarea
                        value={editData.notes}
                        onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="ワークアウトのメモを入力..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                ) : (
                    <div className="p-3 bg-gray-50 rounded-md min-h-[80px]">
                        {workout.notes || (
                            <span className="text-gray-500 italic">メモはありません</span>
                        )}
                    </div>
                )}
            </div>

            {/* エクササイズ一覧 */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        エクササイズ ({workout.exercises?.length || 0})
                    </h2>
                    {isActive && (
                        <button
                            onClick={() => setShowAddExercise(true)}
                            className="btn-primary text-sm flex items-center"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            エクササイズ追加
                        </button>
                    )}
                </div>

                <ExerciseList
                    exercises={workout.exercises || []}
                    workoutId={workout.id}
                    isActive={isActive}
                    onUpdate={handleUpdateExercises}
                />
            </div>

            {/* エクササイズ追加モーダル */}
            {showAddExercise && (
                <AddExerciseModal
                    onSubmit={handleAddExercise}
                    onClose={() => setShowAddExercise(false)}
                />
            )}
        </PageLayout>
    )
}