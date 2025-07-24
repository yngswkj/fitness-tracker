'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Plus, Edit, Trash2, Calendar, Filter, Utensils } from 'lucide-react'
import PageLayout from '../components/PageLayout'

interface Meal {
    id: number
    meal_type: string
    food_name: string
    quantity: number
    unit: string
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
    recorded_at: string
    created_at: string
}

interface MealSummary {
    date: string
    meal_count: number
    total_calories: number
    total_protein: number
    total_carbs: number
    total_fat: number
}

const MEAL_TYPE_LABELS = {
    breakfast: '朝食',
    lunch: '昼食',
    dinner: '夕食',
    snack: '間食'
}

export default function MealsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [meals, setMeals] = useState<Meal[]>([])
    const [summary, setSummary] = useState<MealSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [selectedMealType, setSelectedMealType] = useState<string>('')

    useEffect(() => {
        if (status === 'authenticated') {
            fetchMeals()
        }
    }, [status, selectedDate, selectedMealType])

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">読み込み中...</p>
                </div>
            </div>
        )
    }

    if (status === 'unauthenticated') {
        router.push('/auth/signin')
        return null
    }

    const fetchMeals = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (selectedDate) params.append('date', selectedDate)
            if (selectedMealType) params.append('meal_type', selectedMealType)

            const response = await fetch(`/api/meals?${params.toString()}`)
            if (response.ok) {
                const data = await response.json()
                setMeals(data.meals || [])
                setSummary(data.summary || [])
            }
        } catch (error) {
            console.error('食事記録の取得に失敗しました:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteMeal = async (mealId: number) => {
        if (!confirm('この食事記録を削除しますか？')) return

        try {
            const response = await fetch(`/api/meals/${mealId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                setMeals(prev => prev.filter(meal => meal.id !== mealId))
                fetchMeals() // サマリーを更新
            } else {
                alert('削除に失敗しました')
            }
        } catch (error) {
            console.error('削除エラー:', error)
            alert('削除に失敗しました')
        }
    }

    const todaySummary = summary.find(s => s.date === selectedDate)

    const headerActions = (
        <button
            onClick={() => router.push('/meals/add')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
            <Plus className="h-5 w-5" />
            食事を記録
        </button>
    )

    return (
        <PageLayout
            title="食事記録"
            description={format(parseISO(selectedDate + 'T00:00:00'), 'yyyy年M月d日（E）', { locale: ja })}
            icon={Utensils}
            actions={headerActions}
        >
            {/* フィルター */}
            <div className="card mb-6">
                <div className="flex flex-wrap gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            日付
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            食事タイプ
                        </label>
                        <select
                            value={selectedMealType}
                            onChange={(e) => setSelectedMealType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">すべて</option>
                            <option value="breakfast">朝食</option>
                            <option value="lunch">昼食</option>
                            <option value="dinner">夕食</option>
                            <option value="snack">間食</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 今日のサマリー */}
            {todaySummary && (
                <div className="card mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">今日の栄養サマリー</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{Math.round(todaySummary.total_calories)}</div>
                            <div className="text-sm text-gray-600">カロリー (kcal)</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{Math.round(todaySummary.total_protein * 10) / 10}g</div>
                            <div className="text-sm text-gray-600">タンパク質</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{Math.round(todaySummary.total_carbs * 10) / 10}g</div>
                            <div className="text-sm text-gray-600">炭水化物</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">{Math.round(todaySummary.total_fat * 10) / 10}g</div>
                            <div className="text-sm text-gray-600">脂質</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 食事記録一覧 */}
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        食事記録一覧 ({meals.length}件)
                    </h2>
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">読み込み中...</p>
                    </div>
                ) : meals.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">食事記録がありません</p>
                        <button
                            onClick={() => router.push('/meals/add')}
                            className="mt-4 btn-primary"
                        >
                            最初の食事を記録する
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {meals.map((meal) => (
                            <div key={meal.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                                {MEAL_TYPE_LABELS[meal.meal_type as keyof typeof MEAL_TYPE_LABELS]}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {format(parseISO(meal.recorded_at), 'HH:mm')}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                                            {meal.food_name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-2">
                                            {meal.quantity}{meal.unit}
                                        </p>
                                        {(meal.calories || meal.protein || meal.carbs || meal.fat) && (
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                {meal.calories && (
                                                    <span className="text-red-600">
                                                        {Math.round(meal.calories)} kcal
                                                    </span>
                                                )}
                                                {meal.protein && (
                                                    <span className="text-blue-600">
                                                        P: {Math.round(meal.protein * 10) / 10}g
                                                    </span>
                                                )}
                                                {meal.carbs && (
                                                    <span className="text-green-600">
                                                        C: {Math.round(meal.carbs * 10) / 10}g
                                                    </span>
                                                )}
                                                {meal.fat && (
                                                    <span className="text-yellow-600">
                                                        F: {Math.round(meal.fat * 10) / 10}g
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex space-x-2 ml-4">
                                        <button
                                            onClick={() => router.push(`/meals/edit/${meal.id}`)}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMeal(meal.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PageLayout>
    )
}