'use client'

import { useState } from 'react'
import {
    GripVertical,
    Edit,
    Trash2,
    Save,
    X,
    Weight,
    RotateCcw,
    Timer
} from 'lucide-react'
import { Exercise } from '@/types/workout'

interface ExerciseListProps {
    exercises: Exercise[]
    workoutId: number
    isActive: boolean
    onUpdate: () => void
}

export default function ExerciseList({ exercises, workoutId, isActive, onUpdate }: ExerciseListProps) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editData, setEditData] = useState<Partial<Exercise>>({})
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<number | null>(null)

    const handleEdit = (exercise: Exercise) => {
        setEditingId(exercise.id)
        setEditData({
            exercise_name: exercise.exercise_name,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            rest_seconds: exercise.rest_seconds
        })
    }

    const handleSave = async (exerciseId: number) => {
        setSaving(true)
        try {
            const response = await fetch(`/api/exercises/${exerciseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editData)
            })

            if (!response.ok) {
                throw new Error('エクササイズの更新に失敗しました')
            }

            setEditingId(null)
            setEditData({})
            onUpdate()

        } catch (error) {
            console.error('Update exercise error:', error)
            alert(error instanceof Error ? error.message : 'エクササイズの更新に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (exerciseId: number) => {
        if (!confirm('このエクササイズを削除しますか？')) {
            return
        }

        setDeleting(exerciseId)
        try {
            const response = await fetch(`/api/exercises/${exerciseId}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('エクササイズの削除に失敗しました')
            }

            onUpdate()

        } catch (error) {
            console.error('Delete exercise error:', error)
            alert(error instanceof Error ? error.message : 'エクササイズの削除に失敗しました')
        } finally {
            setDeleting(null)
        }
    }

    const handleCancel = () => {
        setEditingId(null)
        setEditData({})
    }

    const formatRestTime = (seconds: number | null) => {
        if (!seconds) return '-'

        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60

        if (mins > 0) {
            return `${mins}分${secs > 0 ? secs + '秒' : ''}`
        }
        return `${secs}秒`
    }

    if (exercises.length === 0) {
        return (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Weight className="mx-auto h-8 w-8 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">エクササイズがありません</h3>
                <p className="mt-1 text-sm text-gray-500">
                    {isActive ? 'エクササイズを追加してワークアウトを開始しましょう' : 'このワークアウトにはエクササイズが記録されていません'}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {exercises.map((exercise, index) => {
                const isEditing = editingId === exercise.id

                return (
                    <div
                        key={exercise.id}
                        className="card hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start space-x-4">
                            {/* ドラッグハンドル（将来の順序変更用） */}
                            <div className="flex items-center text-gray-400 mt-2">
                                <GripVertical className="h-4 w-4" />
                                <span className="text-sm font-medium ml-1">{index + 1}</span>
                            </div>

                            {/* エクササイズ内容 */}
                            <div className="flex-1 min-w-0">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        {/* エクササイズ名 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                エクササイズ名
                                            </label>
                                            <input
                                                type="text"
                                                value={editData.exercise_name || ''}
                                                onChange={(e) => setEditData(prev => ({ ...prev, exercise_name: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        </div>

                                        {/* セット・レップ・重量 */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    セット数
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editData.sets || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, sets: parseInt(e.target.value) || 0 }))}
                                                    min="1"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    レップ数
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editData.reps || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                                                    min="1"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    重量 (kg)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editData.weight || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, weight: parseFloat(e.target.value) || null }))}
                                                    min="0"
                                                    step="0.5"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    休憩 (秒)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editData.rest_seconds || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, rest_seconds: parseInt(e.target.value) || null }))}
                                                    min="0"
                                                    step="15"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                        </div>

                                        {/* 編集ボタン */}
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleSave(exercise.id)}
                                                disabled={saving}
                                                className="btn-primary text-sm flex items-center disabled:opacity-50"
                                            >
                                                <Save className="h-4 w-4 mr-1" />
                                                {saving ? '保存中...' : '保存'}
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="btn-secondary text-sm flex items-center"
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {/* エクササイズ名 */}
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            {exercise.exercise_name}
                                        </h3>

                                        {/* 詳細情報 */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                            <div className="flex items-center text-gray-600">
                                                <span className="font-medium">セット:</span>
                                                <span className="ml-1 text-lg font-semibold text-gray-900">
                                                    {exercise.sets}
                                                </span>
                                            </div>
                                            <div className="flex items-center text-gray-600">
                                                <span className="font-medium">レップ:</span>
                                                <span className="ml-1 text-lg font-semibold text-gray-900">
                                                    {exercise.reps}
                                                </span>
                                            </div>
                                            <div className="flex items-center text-gray-600">
                                                <Weight className="h-4 w-4 mr-1" />
                                                <span className="text-lg font-semibold text-gray-900">
                                                    {exercise.weight ? `${exercise.weight}kg` : '自重'}
                                                </span>
                                            </div>
                                            <div className="flex items-center text-gray-600">
                                                <Timer className="h-4 w-4 mr-1" />
                                                <span>{formatRestTime(exercise.rest_seconds)}</span>
                                            </div>
                                        </div>

                                        {/* 総ボリューム表示 */}
                                        {exercise.weight && (
                                            <div className="mt-2 text-sm text-gray-500">
                                                総ボリューム: {(exercise.sets * exercise.reps * exercise.weight).toFixed(1)}kg
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* アクションボタン */}
                            {!isEditing && isActive && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleEdit(exercise)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(exercise.id)}
                                        disabled={deleting === exercise.id}
                                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                    >
                                        {deleting === exercise.id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}