'use client'

import { useState } from 'react'
import { X, Utensils, Dumbbell, Plus, Clock } from 'lucide-react'

interface QuickRecordModalProps {
    isOpen: boolean
    onClose: () => void
    type: 'meal' | 'workout' | 'general'
}

export default function QuickRecordModal({ isOpen, onClose, type }: QuickRecordModalProps) {
    const [selectedType, setSelectedType] = useState<'meal' | 'workout'>(type === 'general' ? 'meal' : type)
    const [mealData, setMealData] = useState({
        food_name: '',
        quantity: '',
        meal_type: 'breakfast'
    })
    const [workoutData, setWorkoutData] = useState({
        name: '',
        duration: '',
        notes: ''
    })
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    if (!isOpen) return null

    const handleMealSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...mealData,
                    quantity: parseFloat(mealData.quantity) || 100,
                    calories: 200, // デフォルト値
                    protein: 10,
                    carbs: 20,
                    fat: 5
                }),
            })

            if (response.ok) {
                setSuccess(true)
                setTimeout(() => {
                    onClose()
                    setSuccess(false)
                    setMealData({ food_name: '', quantity: '', meal_type: 'breakfast' })
                }, 1500)
            }
        } catch (error) {
            console.error('Failed to record meal:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleWorkoutSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // ワークアウトセッションを作成
            const workoutResponse = await fetch('/api/workouts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: workoutData.name,
                    notes: workoutData.notes
                }),
            })

            if (workoutResponse.ok) {
                const workout = await workoutResponse.json()

                // セッションを即座に終了
                await fetch(`/api/workouts/${workout.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        status: 'completed',
                        duration: parseInt(workoutData.duration) || 30
                    }),
                })

                setSuccess(true)
                setTimeout(() => {
                    onClose()
                    setSuccess(false)
                    setWorkoutData({ name: '', duration: '', notes: '' })
                }, 1500)
            }
        } catch (error) {
            console.error('Failed to record workout:', error)
        } finally {
            setLoading(false)
        }
    }

    const quickMealOptions = [
        { name: '朝食', value: 'breakfast', icon: '🌅' },
        { name: '昼食', value: 'lunch', icon: '☀️' },
        { name: '夕食', value: 'dinner', icon: '🌙' },
        { name: 'スナック', value: 'snack', icon: '🍎' }
    ]

    const quickWorkoutOptions = [
        { name: 'ウォーキング', duration: '30' },
        { name: 'ランニング', duration: '20' },
        { name: '筋トレ', duration: '45' },
        { name: 'ヨガ', duration: '30' },
        { name: 'ストレッチ', duration: '15' }
    ]

    if (success) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-green-600 text-xl">✓</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">記録完了！</h3>
                    <p className="text-gray-600 text-sm">
                        {selectedType === 'meal' ? '食事' : 'ワークアウト'}を記録しました
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        クイック記録
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6">
                    {/* タイプ選択 */}
                    {type === 'general' && (
                        <div className="mb-6">
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setSelectedType('meal')}
                                    className={`flex-1 flex items-center justify-center p-3 rounded-lg border transition-colors ${selectedType === 'meal'
                                            ? 'bg-green-50 border-green-200 text-green-700'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Utensils className="h-5 w-5 mr-2" />
                                    食事記録
                                </button>
                                <button
                                    onClick={() => setSelectedType('workout')}
                                    className={`flex-1 flex items-center justify-center p-3 rounded-lg border transition-colors ${selectedType === 'workout'
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Dumbbell className="h-5 w-5 mr-2" />
                                    ワークアウト
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 食事記録フォーム */}
                    {selectedType === 'meal' && (
                        <form onSubmit={handleMealSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    食事タイプ
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {quickMealOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setMealData(prev => ({ ...prev, meal_type: option.value }))}
                                            className={`p-3 rounded-lg border text-left transition-colors ${mealData.meal_type === option.value
                                                    ? 'bg-green-50 border-green-200 text-green-700'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <span className="text-lg">{option.icon}</span>
                                                <span className="text-sm font-medium">{option.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    食材名 *
                                </label>
                                <input
                                    type="text"
                                    value={mealData.food_name}
                                    onChange={(e) => setMealData(prev => ({ ...prev, food_name: e.target.value }))}
                                    placeholder="例: 白米、鶏胸肉、サラダ"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    分量 (g)
                                </label>
                                <input
                                    type="number"
                                    value={mealData.quantity}
                                    onChange={(e) => setMealData(prev => ({ ...prev, quantity: e.target.value }))}
                                    placeholder="100"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !mealData.food_name}
                                className="w-full btn-primary flex items-center justify-center disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {loading ? '記録中...' : '食事を記録'}
                            </button>
                        </form>
                    )}

                    {/* ワークアウト記録フォーム */}
                    {selectedType === 'workout' && (
                        <form onSubmit={handleWorkoutSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    クイック選択
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {quickWorkoutOptions.map((option) => (
                                        <button
                                            key={option.name}
                                            type="button"
                                            onClick={() => setWorkoutData(prev => ({
                                                ...prev,
                                                name: option.name,
                                                duration: option.duration
                                            }))}
                                            className="p-3 rounded-lg border text-left hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{option.name}</span>
                                                <span className="text-sm text-gray-500 flex items-center">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {option.duration}分
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ワークアウト名 *
                                </label>
                                <input
                                    type="text"
                                    value={workoutData.name}
                                    onChange={(e) => setWorkoutData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="例: ウォーキング、筋トレ"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    時間 (分)
                                </label>
                                <input
                                    type="number"
                                    value={workoutData.duration}
                                    onChange={(e) => setWorkoutData(prev => ({ ...prev, duration: e.target.value }))}
                                    placeholder="30"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    メモ（任意）
                                </label>
                                <textarea
                                    value={workoutData.notes}
                                    onChange={(e) => setWorkoutData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="感想や詳細を記録..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !workoutData.name}
                                className="w-full btn-primary flex items-center justify-center disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {loading ? '記録中...' : 'ワークアウトを記録'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}