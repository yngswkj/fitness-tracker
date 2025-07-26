'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { X, Target, Calendar, TrendingUp } from 'lucide-react'

interface GoalFormProps {
    onSubmit: (goalData: {
        type: string
        title: string
        description?: string
        target_value: number
        unit: string
        period: string
        start_date: string
        end_date?: string
    }) => Promise<void>
    onClose: () => void
    initialData?: any
    isEditing?: boolean
}

const GOAL_TYPES = [
    {
        value: 'workout_frequency',
        label: 'ワークアウト頻度',
        description: '週あたりのワークアウト回数',
        defaultUnit: '回/週',
        defaultPeriod: 'weekly',
        icon: '🏋️'
    },
    {
        value: 'calories_daily',
        label: '1日のカロリー摂取',
        description: '1日の目標カロリー摂取量',
        defaultUnit: 'kcal',
        defaultPeriod: 'daily',
        icon: '🍽️'
    },
    {
        value: 'protein_daily',
        label: '1日のタンパク質摂取',
        description: '1日の目標タンパク質摂取量',
        defaultUnit: 'g',
        defaultPeriod: 'daily',
        icon: '🥩'
    },
    {
        value: 'weight_target',
        label: '体重目標',
        description: '目標体重の達成',
        defaultUnit: 'kg',
        defaultPeriod: 'ongoing',
        icon: '⚖️'
    },
    {
        value: 'exercise_pr',
        label: 'エクササイズ記録',
        description: '特定エクササイズの個人記録',
        defaultUnit: 'kg',
        defaultPeriod: 'ongoing',
        icon: '💪'
    }
]

const PERIODS = [
    { value: 'daily', label: '毎日' },
    { value: 'weekly', label: '週次' },
    { value: 'monthly', label: '月次' },
    { value: 'ongoing', label: '継続的' }
]

export default function GoalForm({ onSubmit, onClose, initialData, isEditing = false }: GoalFormProps) {
    const [formData, setFormData] = useState({
        type: initialData?.type || 'workout_frequency',
        title: initialData?.title || '',
        description: initialData?.description || '',
        target_value: initialData?.target_value || 0,
        unit: initialData?.unit || 'kcal',
        period: initialData?.period || 'weekly',
        start_date: initialData?.start_date || format(new Date(), 'yyyy-MM-dd'),
        end_date: initialData?.end_date || ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const selectedGoalType = GOAL_TYPES.find(type => type.value === formData.type)

    const handleTypeChange = (type: string) => {
        const goalType = GOAL_TYPES.find(t => t.value === type)
        if (goalType) {
            setFormData(prev => ({
                ...prev,
                type,
                unit: goalType.defaultUnit,
                period: goalType.defaultPeriod,
                title: prev.title || goalType.label
            }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title.trim()) {
            setError('目標タイトルを入力してください')
            return
        }

        if (formData.target_value <= 0) {
            setError('目標値は0より大きい値を入力してください')
            return
        }

        setLoading(true)
        setError('')

        try {
            await onSubmit({
                type: formData.type,
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                target_value: formData.target_value,
                unit: formData.unit,
                period: formData.period,
                start_date: formData.start_date,
                end_date: formData.end_date || undefined
            })
        } catch (error) {
            setError(error instanceof Error ? error.message : '目標の保存に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Target className="h-5 w-5 mr-2" />
                        {isEditing ? '目標を編集' : '新しい目標を設定'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 目標タイプ */}
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                目標タイプ
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                                {GOAL_TYPES.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => handleTypeChange(type.value)}
                                        className={`text-left p-3 rounded-lg border transition-colors ${formData.type === type.value
                                                ? 'bg-primary-50 border-primary-200 text-primary-900'
                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <span className="text-lg">{type.icon}</span>
                                            <div>
                                                <div className="font-medium">{type.label}</div>
                                                <div className="text-xs text-gray-500">{type.description}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 目標タイトル */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            目標タイトル *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder={selectedGoalType?.label}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        />
                    </div>

                    {/* 説明 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            説明（任意）
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="目標の詳細や動機を記入..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {/* 目標値と単位 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                目標値 *
                            </label>
                            <input
                                type="number"
                                value={formData.target_value || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, target_value: parseFloat(e.target.value) || 0 }))}
                                min="0"
                                step="0.1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                単位
                            </label>
                            <input
                                type="text"
                                value={formData.unit}
                                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                required
                            />
                        </div>
                    </div>

                    {/* 期間 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            期間
                        </label>
                        <select
                            value={formData.period}
                            onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {PERIODS.map(period => (
                                <option key={period.value} value={period.value}>
                                    {period.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 開始日・終了日 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                開始日 *
                            </label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                終了日（任意）
                            </label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                min={formData.start_date}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
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
                            <TrendingUp className="h-4 w-4 mr-2" />
                            {loading ? '保存中...' : (isEditing ? '更新' : '目標を設定')}
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