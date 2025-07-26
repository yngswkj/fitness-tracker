'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Target, Award, Calendar } from 'lucide-react'
import PageLayout from '@/app/components/PageLayout'
import PageHeader from '@/app/components/PageHeader'
import ProgressCharts from '@/app/components/ProgressCharts'
import ExerciseProgressList from '@/app/components/ExerciseProgressList'
import PersonalRecords from '@/app/components/PersonalRecords'
import { ExerciseStats, PopularExercise } from '@/types/workout'

export default function WorkoutStatsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [selectedExercise, setSelectedExercise] = useState<string>('')
    const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null)
    const [popularExercises, setPopularExercises] = useState<PopularExercise[]>([])
    const [period, setPeriod] = useState(30)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // 認証チェック
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin')
        }
    }, [status, router])

    // 人気エクササイズの取得
    useEffect(() => {
        if (session) {
            fetchPopularExercises()
        }
    }, [session, period])

    // 選択されたエクササイズの統計取得
    useEffect(() => {
        if (session && selectedExercise) {
            fetchExerciseStats()
        }
    }, [session, selectedExercise, period])

    const fetchPopularExercises = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/exercises/stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    period,
                    limit: 20
                })
            })

            if (!response.ok) {
                throw new Error('人気エクササイズの取得に失敗しました')
            }

            const data = await response.json()
            setPopularExercises(data.popular_exercises || [])

            // 最初のエクササイズを自動選択
            if (data.popular_exercises?.length > 0 && !selectedExercise) {
                setSelectedExercise(data.popular_exercises[0].exercise_name)
            }

        } catch (error) {
            console.error('Fetch popular exercises error:', error)
            setError(error instanceof Error ? error.message : 'データの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const fetchExerciseStats = async () => {
        try {
            const response = await fetch(`/api/exercises/stats?exercise_name=${encodeURIComponent(selectedExercise)}&period=${period}`)

            if (!response.ok) {
                throw new Error('エクササイズ統計の取得に失敗しました')
            }

            const data = await response.json()
            setExerciseStats(data)

        } catch (error) {
            console.error('Fetch exercise stats error:', error)
            setError(error instanceof Error ? error.message : 'エクササイズ統計の取得に失敗しました')
        }
    }

    const periodOptions = [
        { label: '過去30日', value: 30 },
        { label: '過去90日', value: 90 },
        { label: '過去180日', value: 180 },
        { label: '過去1年', value: 365 }
    ]

    if (status === 'loading' || loading) {
        return (
            <PageLayout title="ワークアウト進捗" description="読み込み中...">
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
            title="ワークアウト進捗"
            description="エクササイズの進捗と個人記録を確認しましょう"
            icon={TrendingUp}
        >
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/workouts')}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                </div>

                {/* 期間選択 */}
                <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <select
                        value={period}
                        onChange={(e) => setPeriod(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                        {periodOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 人気エクササイズ一覧 */}
                <div className="lg:col-span-1">
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <Target className="h-5 w-5 mr-2" />
                            人気エクササイズ
                        </h2>

                        {popularExercises.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500">データがありません</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    ワークアウトを記録して進捗を確認しましょう
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {popularExercises.map((exercise, index) => (
                                    <button
                                        key={exercise.exercise_name}
                                        onClick={() => setSelectedExercise(exercise.exercise_name)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors ${selectedExercise === exercise.exercise_name
                                            ? 'bg-primary-50 border-2 border-primary-200'
                                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index < 3
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {exercise.exercise_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {exercise.workout_count}回のワークアウト
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {exercise.max_weight ? `${exercise.max_weight}kg` : '自重'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    最大重量
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 進捗チャートと詳細 */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedExercise && exerciseStats ? (
                        <>
                            {/* 個人記録 */}
                            <PersonalRecords
                                exerciseName={selectedExercise}
                                personalRecords={exerciseStats.personal_records}
                                stats={exerciseStats.stats}
                            />

                            {/* 進捗チャート */}
                            <ProgressCharts
                                exerciseStats={exerciseStats}
                            />

                            {/* エクササイズ履歴 */}
                            <ExerciseProgressList
                                exerciseStats={exerciseStats}
                            />
                        </>
                    ) : (
                        <div className="card">
                            <div className="text-center py-12">
                                <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">
                                    エクササイズを選択してください
                                </h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    左側のリストからエクササイズを選択すると進捗が表示されます
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageLayout>
    )
}