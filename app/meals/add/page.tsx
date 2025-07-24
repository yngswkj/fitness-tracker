'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MealForm from '@/app/components/MealForm'
import { ArrowLeft, Plus, Utensils } from 'lucide-react'
import PageLayout from '@/app/components/PageLayout'

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

export default function AddMealPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [isSubmitting, setIsSubmitting] = useState(false)

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

    const handleSubmit = async (mealData: MealData) => {
        setIsSubmitting(true)

        try {
            const response = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mealData),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || '食事記録の保存に失敗しました')
            }

            const result = await response.json()
            console.log('食事記録を保存しました:', result)

            // 成功時はメイン画面に戻る
            router.push('/meals')
        } catch (error) {
            console.error('食事記録保存エラー:', error)
            throw error // MealFormでエラーハンドリング
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.back()
    }

    const headerActions = (
        <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
            <ArrowLeft className="h-5 w-5" />
            戻る
        </button>
    )

    return (
        <PageLayout
            title="食事を記録"
            description="新しい食事記録を追加します"
            icon={Plus}
            actions={headerActions}
        >
            <div className="max-w-2xl mx-auto">
                <MealForm
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    isLoading={isSubmitting}
                />
            </div>
        </PageLayout>
    )
}