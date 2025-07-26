'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Calendar, Weight, RotateCcw, Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ExerciseStats } from '@/types/workout'

interface ExerciseProgressListProps {
    exerciseStats: ExerciseStats
}

export default function ExerciseProgressList({ exerciseStats }: ExerciseProgressListProps) {
    const history = exerciseStats.history

    const getProgressIndicator = (current: any, previous: any) => {
        if (!previous) return null

        const currentWeight = current.weight || 0
        const previousWeight = previous.weight || 0
        const currentReps = current.reps
        const previousReps = previous.reps

        // 重量の比較
        if (currentWeight > 0 && previousWeight > 0) {
            if (currentWeight > previousWeight) {
                return { type: 'up', text: `+${(currentWeight - previousWeight).toFixed(1)}kg` }
            } else if (currentWeight < previousWeight) {
                return { type: 'down', text: `-${(previousWeight - currentWeight).toFixed(1)}kg` }
            }
        }

        // レップ数の比較
        if (currentReps > previousReps) {
            return { type: 'up', text: `+${currentReps - previousReps}reps` }
        } else if (currentReps < previousReps) {
            return { type: 'down', text: `-${previousReps - currentReps}reps` }
        }

        return { type: 'same', text: '同じ' }
    }

    const formatVolume = (record: any) => {
        if (record.weight && record.weight > 0) {
            return `${(record.sets * record.reps * record.weight).toLocaleString()}kg`
        }
        return `${record.sets * record.reps}reps`
    }

    if (history.length === 0) {
        return (
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    ワークアウト履歴
                </h3>
                <div className="text-center py-8">
                    <Calendar className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">履歴データがありません</p>
                </div>
            </div>
        )
    }

    return (
        <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ワークアウト履歴 ({history.length}回)
            </h3>

            <div className="space-y-3">
                {history.map((record, index) => {
                    const previousRecord = index < history.length - 1 ? history[index + 1] : null
                    const progress = getProgressIndicator(record, previousRecord)

                    return (
                        <div
                            key={record.id}
                            className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    {/* 日付とワークアウト名 */}
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Calendar className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-900">
                                            {format(new Date(record.workout_date), 'M月d日(E)', { locale: ja })}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {record.workout_name}
                                        </span>
                                    </div>

                                    {/* エクササイズ詳細 */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                        <div className="flex items-center space-x-2">
                                            <RotateCcw className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-600">セット:</span>
                                            <span className="font-semibold">{record.sets}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RotateCcw className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-600">レップ:</span>
                                            <span className="font-semibold">{record.reps}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Weight className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-600">重量:</span>
                                            <span className="font-semibold">
                                                {record.weight ? `${record.weight}kg` : '自重'}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Timer className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-600">休憩:</span>
                                            <span className="font-semibold">
                                                {record.rest_seconds
                                                    ? `${Math.floor(record.rest_seconds / 60)}:${(record.rest_seconds % 60).toString().padStart(2, '0')}`
                                                    : '-'
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* ボリューム */}
                                    <div className="mt-2 text-sm text-gray-600">
                                        総ボリューム: <span className="font-semibold">{formatVolume(record)}</span>
                                    </div>
                                </div>

                                {/* 進捗インジケーター */}
                                {progress && (
                                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${progress.type === 'up'
                                            ? 'bg-green-100 text-green-700'
                                            : progress.type === 'down'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {progress.type === 'up' && <TrendingUp className="h-3 w-3" />}
                                        {progress.type === 'down' && <TrendingDown className="h-3 w-3" />}
                                        {progress.type === 'same' && <Minus className="h-3 w-3" />}
                                        <span>{progress.text}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* 統計サマリー */}
            <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-lg font-semibold text-gray-900">
                            {exerciseStats.stats.total_workouts}
                        </div>
                        <div className="text-sm text-gray-600">総ワークアウト</div>
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-gray-900">
                            {exerciseStats.stats.total_sets}
                        </div>
                        <div className="text-sm text-gray-600">総セット</div>
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-gray-900">
                            {exerciseStats.stats.total_reps.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">総レップ</div>
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-gray-900">
                            {exerciseStats.stats.avg_reps}
                        </div>
                        <div className="text-sm text-gray-600">平均レップ</div>
                    </div>
                </div>
            </div>
        </div>
    )
}