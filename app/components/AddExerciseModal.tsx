'use client'

import { useState } from 'react'
import { X, Plus, Search } from 'lucide-react'

interface AddExerciseModalProps {
    onSubmit: (exerciseData: {
        exercise_name: string
        sets: number
        reps: number
        weight?: number | null
        rest_seconds?: number | null
    }) => Promise<void>
    onClose: () => void
}

const COMMON_EXERCISES = [
    // 胸
    { name: 'ベンチプレス', category: '胸', defaultWeight: 60, defaultSets: 3, defaultReps: 10, defaultRest: 120 },
    { name: 'インクラインベンチプレス', category: '胸', defaultWeight: 50, defaultSets: 3, defaultReps: 10, defaultRest: 120 },
    { name: 'ダンベルフライ', category: '胸', defaultWeight: 20, defaultSets: 3, defaultReps: 12, defaultRest: 90 },
    { name: 'プッシュアップ', category: '胸', defaultWeight: null, defaultSets: 3, defaultReps: 15, defaultRest: 60 },

    // 背中
    { name: 'デッドリフト', category: '背中', defaultWeight: 80, defaultSets: 3, defaultReps: 8, defaultRest: 180 },
    { name: 'ラットプルダウン', category: '背中', defaultWeight: 50, defaultSets: 3, defaultReps: 10, defaultRest: 90 },
    { name: 'ベントオーバーロウ', category: '背中', defaultWeight: 50, defaultSets: 3, defaultReps: 10, defaultRest: 120 },
    { name: 'プルアップ', category: '背中', defaultWeight: null, defaultSets: 3, defaultReps: 8, defaultRest: 120 },

    // 脚
    { name: 'スクワット', category: '脚', defaultWeight: 60, defaultSets: 3, defaultReps: 12, defaultRest: 120 },
    { name: 'レッグプレス', category: '脚', defaultWeight: 100, defaultSets: 3, defaultReps: 15, defaultRest: 90 },
    { name: 'ルーマニアンデッドリフト', category: '脚', defaultWeight: 50, defaultSets: 3, defaultReps: 10, defaultRest: 120 },
    { name: 'レッグカール', category: '脚', defaultWeight: 30, defaultSets: 3, defaultReps: 12, defaultRest: 60 },

    // 肩
    { name: 'ショルダープレス', category: '肩', defaultWeight: 30, defaultSets: 3, defaultReps: 10, defaultRest: 90 },
    { name: 'ラテラルレイズ', category: '肩', defaultWeight: 10, defaultSets: 3, defaultReps: 15, defaultRest: 60 },
    { name: 'リアデルトフライ', category: '肩', defaultWeight: 8, defaultSets: 3, defaultReps: 15, defaultRest: 60 },

    // 腕
    { name: 'バーベルカール', category: '腕', defaultWeight: 25, defaultSets: 3, defaultReps: 12, defaultRest: 60 },
    { name: 'トライセップスエクステンション', category: '腕', defaultWeight: 20, defaultSets: 3, defaultReps: 12, defaultRest: 60 },
    { name: 'ハンマーカール', category: '腕', defaultWeight: 15, defaultSets: 3, defaultReps: 12, defaultRest: 60 },
]

const REST_TIME_PRESETS = [
    { label: '30秒', value: 30 },
    { label: '60秒', value: 60 },
    { label: '90秒', value: 90 },
    { label: '2分', value: 120 },
    { label: '3分', value: 180 },
]

export default function AddExerciseModal({ onSubmit, onClose }: AddExerciseModalProps) {
    const [formData, setFormData] = useState({
        exercise_name: '',
        sets: 3,
        reps: 10,
        weight: null as number | null,
        rest_seconds: 90
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [filteredExercises, setFilteredExercises] = useState(COMMON_EXERCISES)

    const handleExerciseNameChange = (value: string) => {
        setFormData(prev => ({ ...prev, exercise_name: value }))

        if (value.length > 0) {
            const filtered = COMMON_EXERCISES.filter(exercise =>
                exercise.name.toLowerCase().includes(value.toLowerCase())
            )
            setFilteredExercises(filtered)
            setShowSuggestions(true)
        } else {
            setFilteredExercises(COMMON_EXERCISES)
            setShowSuggestions(false)
        }
    }

    const handleExerciseSelect = (exercise: typeof COMMON_EXERCISES[0]) => {
        setFormData({
            exercise_name: exercise.name,
            sets: exercise.defaultSets,
            reps: exercise.defaultReps,
            weight: exercise.defaultWeight,
            rest_seconds: exercise.defaultRest
        })
        setShowSuggestions(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.exercise_name.trim()) {
            setError('エクササイズ名を入力してください')
            return
        }

        if (formData.sets <= 0 || formData.reps <= 0) {
            setError('セット数とレップ数は1以上の値を入力してください')
            return
        }

        setLoading(true)
        setError('')

        try {
            await onSubmit({
                exercise_name: formData.exercise_name.trim(),
                sets: formData.sets,
                reps: formData.reps,
                weight: formData.weight,
                rest_seconds: formData.rest_seconds
            })
        } catch (error) {
            setError(error instanceof Error ? error.message : 'エクササイズの追加に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const categories = Array.from(new Set(COMMON_EXERCISES.map(e => e.category)))

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        エクササイズ追加
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* エクササイズ名 */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            エクササイズ名 *
                        </label>
                        <input
                            type="text"
                            value={formData.exercise_name}
                            onChange={(e) => handleExerciseNameChange(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="例: ベンチプレス、スクワット"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        />

                        {/* エクササイズ候補 */}
                        {showSuggestions && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {categories.map(category => {
                                    const categoryExercises = filteredExercises.filter(e => e.category === category)
                                    if (categoryExercises.length === 0) return null

                                    return (
                                        <div key={category}>
                                            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                                                {category}
                                            </div>
                                            {categoryExercises.map((exercise, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => handleExerciseSelect(exercise)}
                                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>{exercise.name}</span>
                                                        <span className="text-xs text-gray-500">
                                                            {exercise.defaultSets}×{exercise.defaultReps}
                                                            {exercise.defaultWeight && ` ${exercise.defaultWeight}kg`}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* セット数・レップ数 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                セット数 *
                            </label>
                            <input
                                type="number"
                                value={formData.sets}
                                onChange={(e) => setFormData(prev => ({ ...prev, sets: parseInt(e.target.value) || 0 }))}
                                min="1"
                                max="20"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                レップ数 *
                            </label>
                            <input
                                type="number"
                                value={formData.reps}
                                onChange={(e) => setFormData(prev => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                                min="1"
                                max="100"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                required
                            />
                        </div>
                    </div>

                    {/* 重量 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            重量 (kg) - 自重の場合は空欄
                        </label>
                        <input
                            type="number"
                            value={formData.weight || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) || null }))}
                            min="0"
                            step="0.5"
                            placeholder="例: 60"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {/* 休憩時間 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            休憩時間
                        </label>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {REST_TIME_PRESETS.map(preset => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, rest_seconds: preset.value }))}
                                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${formData.rest_seconds === preset.value
                                        ? 'bg-primary-500 text-white border-primary-500'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            value={formData.rest_seconds || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, rest_seconds: parseInt(e.target.value) || null }))}
                            min="0"
                            step="15"
                            placeholder="カスタム (秒)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm">{error}</div>
                    )}

                    {/* ボタン */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 btn-primary flex items-center justify-center disabled:opacity-50"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {loading ? '追加中...' : 'エクササイズ追加'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}