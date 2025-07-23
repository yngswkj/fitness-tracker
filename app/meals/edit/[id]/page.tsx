'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MealForm from '@/app/components/MealForm'
import { ArrowLeft } from 'lucide-react'

interface MealData {
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    food_name: string
    quantity: number
    unit: string
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
    recorded_at: string
}

interface Meal extends MealData {
    id: number
    created_at: string
}

export default function EditMealPage() {
    const router = useRouter()
    const params = useParams()
    const { data: session, status } = useSession()
    const [meal, setMeal] = useState<Meal | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const mealId = params.id as string

    useEffect(() => {
        if (status === 'authenticated' && mealId) {
            fetchMeal()
        }
    }, [status, mealId])

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

    const fetchMeal = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/meals?limit=1000`)

            if (response.ok) {
                const data = await response.json()
                const targetMeal = data.meals.find((m: Meal) => m.id === parseInt(mealId))

                if (targetMeal) {
                    setMeal(targetMeal)
                } else {
                    setError('食事記録が見つかりません')
                }
            } else {
                setError('食事記録の取得に失敗しました')
            }
        } catch (error) {
            console.error('食事記録取得エラー:', error)
            setError('食事記録の取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (mealData: MealData) => {
        setIsSubmitting(true)

        try {
            const response = await fetch(`/api/meals/${mealId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mealData),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || '食事記録の更新に失敗しました')
            }

            const result = await response.json()
            console.log('食事記録を更新しました:', result)

            // 成功時は食事記録一覧に戻る
            router.push('/meals')
        } catch (error) {
            console.error('食事記録更新エラー:', error)
            throw error // MealFormでエラーハンドリング
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push('/meals')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">読み込み中...</p>
                </div>
            </div>
        )
    }

    if (error || !meal) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || '食事記録が見つかりません'}</p>
                    <button
                        onClick={() => router.push('/meals')}
                        className="btn-primary"
                    >
                        食事記録一覧に戻る
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center py-4">
                        <button
                            onClick={() => router.push('/meals')}
                            className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <h1 className="text-xl font-semibold text-gray-900">
                            食事記録を編集
                        </h1>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <MealForm
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    initialData={meal}
                    isEditing={true}
                    isLoading={isSubmitting}
                />
            </main>
        </div>
    )
}