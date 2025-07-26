'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
    Clock,
    Dumbbell,
    Play,
    Square,
    Trash2,
    Edit,
    Calendar,
    Timer,
    Target
} from 'lucide-react'
import { Workout } from '@/types/workout'

interface WorkoutListProps {
    workouts: Workout[]
    onDelete: (workoutId: number) => Promise<void>
    onComplete: (workoutId: number) => Promise<void>
}

export default function WorkoutList({ workouts, onDelete, onComplete }: WorkoutListProps) {
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [completingId, setCompletingId] = useState<number | null>(null)

    const handleDelete = async (workoutId: number) => {
        setDeletingId(workoutId)
        try {
            await onDelete(workoutId)
        } finally {
            setDeletingId(null)
        }
    }

    const handleComplete = async (workoutId: number) => {
        setCompletingId(workoutId)
        try {
            await onComplete(workoutId)
        } finally {
            setCompletingId(null)
        }
    }

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return '未完了'

        const hours = Math.floor(minutes / 60)
        const mins = Math.round(minutes % 60)

        if (hours > 0) {
            return `${hours}時間${mins}分`
        }
        return `${mins}分`
    }

    const getWorkoutStatus = (workout: Workout) => {
        if (!workout.ended_at) {
            return {
                status: 'active',
                label: '進行中',
                color: 'text-green-600 bg-green-50 border-green-200'
            }
        }

        return {
            status: 'completed',
            label: '完了',
            color: 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    if (workouts.length === 0) {
        return (
            <div className="text-center py-12">
                <Dumbbell className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">ワークアウトがありません</h3>
                <p className="mt-1 text-sm text-gray-500">
                    最初のワークアウトを開始してみましょう
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {workouts.map((workout) => {
                const status = getWorkoutStatus(workout)
                const isActive = status.status === 'active'

                return (
                    <div
                        key={workout.id}
                        className={`card hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-green-200' : ''
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                {/* ワークアウト名とステータス */}
                                <div className="flex items-center space-x-3 mb-2">
                                    <Link
                                        href={`/workouts/${workout.id}`}
                                        className="text-lg font-medium text-gray-900 hover:text-primary-600 truncate"
                                    >
                                        {workout.name}
                                    </Link>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                                        {isActive && <Play className="h-3 w-3 mr-1" />}
                                        {status.label}
                                    </span>
                                </div>

                                {/* 詳細情報 */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600">
                                    <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        {format(new Date(workout.started_at), 'M/d (E)', { locale: ja })}
                                    </div>
                                    <div className="flex items-center">
                                        <Timer className="h-4 w-4 mr-1" />
                                        {formatDuration(workout.duration_minutes)}
                                    </div>
                                    <div className="flex items-center">
                                        <Target className="h-4 w-4 mr-1" />
                                        {workout.exercise_count || 0}種目
                                    </div>
                                    <div className="flex items-center">
                                        <Clock className="h-4 w-4 mr-1" />
                                        {format(new Date(workout.started_at), 'HH:mm')}開始
                                    </div>
                                </div>

                                {/* メモ */}
                                {workout.notes && (
                                    <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-md p-2">
                                        {workout.notes}
                                    </div>
                                )}
                            </div>

                            {/* アクションボタン */}
                            <div className="flex items-center space-x-2 ml-4">
                                {isActive ? (
                                    <>
                                        <Link
                                            href={`/workouts/${workout.id}`}
                                            className="btn-primary text-sm"
                                        >
                                            続行
                                        </Link>
                                        <button
                                            onClick={() => handleComplete(workout.id)}
                                            disabled={completingId === workout.id}
                                            className="btn-secondary text-sm flex items-center disabled:opacity-50"
                                        >
                                            <Square className="h-4 w-4 mr-1" />
                                            {completingId === workout.id ? '完了中...' : '完了'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href={`/workouts/${workout.id}`}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(workout.id)}
                                            disabled={deletingId === workout.id}
                                            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                        >
                                            {deletingId === workout.id ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}