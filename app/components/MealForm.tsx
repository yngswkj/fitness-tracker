'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Calculator, Search } from 'lucide-react'
import { calculateNutrition, searchFoods, getCommonUnits } from '@/lib/nutrition'

interface MealFormProps {
    onSubmit: (mealData: MealData) => Promise<void>
    onCancel?: () => void
    initialData?: Partial<MealData>
    isEditing?: boolean
    isLoading?: boolean
}

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

const MEAL_TYPES = [
    { value: 'breakfast', label: '朝食' },
    { value: 'lunch', label: '昼食' },
    { value: 'dinner', label: '夕食' },
    { value: 'snack', label: '間食' }
]

const COMMON_UNITS = ['g', 'ml', '個', '杯', '切れ', '本', '枚']

// 基本的な食材の栄養価データ（100gあたり）
const NUTRITION_DATA: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {
    '白米': { calories: 168, protein: 2.5, carbs: 37.1, fat: 0.3 },
    '玄米': { calories: 165, protein: 2.8, carbs: 35.6, fat: 1.0 },
    '食パン': { calories: 264, protein: 9.3, carbs: 46.7, fat: 4.4 },
    '鶏胸肉': { calories: 108, protein: 22.3, carbs: 0, fat: 1.5 },
    '鶏もも肉': { calories: 200, protein: 16.2, carbs: 0, fat: 14.0 },
    '牛肉': { calories: 259, protein: 17.1, carbs: 0.3, fat: 20.0 },
    '豚肉': { calories: 263, protein: 17.1, carbs: 0.1, fat: 21.1 },
    '鮭': { calories: 133, protein: 22.3, carbs: 0.1, fat: 4.1 },
    'まぐろ': { calories: 125, protein: 26.4, carbs: 0.1, fat: 1.4 },
    '卵': { calories: 151, protein: 12.3, carbs: 0.3, fat: 10.3 },
    '牛乳': { calories: 67, protein: 3.3, carbs: 4.8, fat: 3.8 },
    'バナナ': { calories: 86, protein: 1.1, carbs: 22.5, fat: 0.2 },
    'りんご': { calories: 54, protein: 0.2, carbs: 14.6, fat: 0.1 },
    'ブロッコリー': { calories: 33, protein: 4.3, carbs: 5.2, fat: 0.5 },
    'にんじん': { calories: 39, protein: 0.6, carbs: 9.3, fat: 0.2 }
}

export default function MealForm({ onSubmit, onCancel, initialData, isEditing = false, isLoading }: MealFormProps) {
    const [formData, setFormData] = useState<MealData>({
        meal_type: initialData?.meal_type || 'breakfast',
        food_name: initialData?.food_name || '',
        quantity: initialData?.quantity || 0,
        unit: initialData?.unit || 'g',
        calories: initialData?.calories || undefined,
        protein: initialData?.protein || undefined,
        carbs: initialData?.carbs || undefined,
        fat: initialData?.fat || undefined,
        recorded_at: initialData?.recorded_at || format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showNutritionCalculator, setShowNutritionCalculator] = useState(false)
    const [foodSuggestions, setFoodSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [availableUnits, setAvailableUnits] = useState<string[]>(['g'])

    // 栄養価の自動計算
    useEffect(() => {
        if (formData.food_name && formData.quantity > 0) {
            const nutrition = calculateNutrition(formData.food_name, formData.quantity, formData.unit)
            if (nutrition) {
                setFormData(prev => ({
                    ...prev,
                    calories: nutrition.calories,
                    protein: nutrition.protein,
                    carbs: nutrition.carbs,
                    fat: nutrition.fat
                }))
            }
        }
    }, [formData.food_name, formData.quantity, formData.unit])

    const handleChange = (field: keyof MealData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    // 食材名変更時の処理
    const handleFoodNameChange = (value: string) => {
        setFormData(prev => ({ ...prev, food_name: value }))

        // 食材候補の表示
        if (value.length > 0) {
            const suggestions = searchFoods(value)
            setFoodSuggestions(suggestions)
            setShowSuggestions(true)
        } else {
            setShowSuggestions(false)
        }

        // 利用可能な単位の更新
        const units = getCommonUnits(value)
        setAvailableUnits(units)

        // 現在の単位が利用可能でない場合、最初の単位に変更
        if (!units.includes(formData.unit)) {
            setFormData(prev => ({ ...prev, unit: units[0] }))
        }
    }

    // 食材候補選択
    const handleSuggestionClick = (suggestion: string) => {
        handleFoodNameChange(suggestion)
        setShowSuggestions(false)
    }

    const handleCalculateNutrition = () => {
        if (formData.food_name && formData.quantity > 0) {
            const nutrition = calculateNutrition(formData.food_name, formData.quantity, formData.unit)
            if (nutrition) {
                setFormData(prev => ({
                    ...prev,
                    calories: nutrition.calories,
                    protein: nutrition.protein,
                    carbs: nutrition.carbs,
                    fat: nutrition.fat
                }))
                setError('')
            } else {
                setError('この食材の栄養価データが見つかりません')
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (!formData.food_name.trim()) {
                throw new Error('食材名を入力してください')
            }

            if (formData.quantity <= 0) {
                throw new Error('分量は0より大きい値を入力してください')
            }

            await onSubmit(formData)

            // フォームをリセット（編集モードでない場合）
            if (!isEditing) {
                setFormData({
                    meal_type: 'breakfast',
                    food_name: '',
                    quantity: 0,
                    unit: 'g',
                    calories: undefined,
                    protein: undefined,
                    carbs: undefined,
                    fat: undefined,
                    recorded_at: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')
                })
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : '食事記録の保存に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">
                {isEditing ? '食事記録を編集' : '食事を記録'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                {/* 食事タイプ */}
                <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                        食事タイプ
                    </label>
                    <select
                        value={formData.meal_type}
                        onChange={(e) => handleChange('meal_type', e.target.value)}
                        className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                    >
                        {MEAL_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 食材名 */}
                <div className="relative">
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                        食材名
                    </label>
                    <input
                        type="text"
                        value={formData.food_name}
                        onChange={(e) => handleFoodNameChange(e.target.value)}
                        onFocus={() => formData.food_name && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="例: 鶏胸肉、白米、バナナ"
                        className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                        required
                    />

                    {/* 食材候補 */}
                    {showSuggestions && foodSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 md:max-h-60 overflow-y-auto">
                            {foodSuggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="w-full px-3 md:px-4 py-3 md:py-4 text-sm md:text-base text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none first:rounded-t-lg last:rounded-b-lg transition-colors min-h-[44px]"
                                >
                                    <div className="flex items-center">
                                        <Search className="h-4 w-4 md:h-5 md:w-5 text-gray-400 mr-2 md:mr-3 flex-shrink-0" />
                                        <span>{suggestion}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 分量と単位 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                        <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                            分量
                        </label>
                        <input
                            type="number"
                            value={formData.quantity || ''}
                            onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.1"
                            className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                            単位
                        </label>
                        <select
                            value={formData.unit}
                            onChange={(e) => handleChange('unit', e.target.value)}
                            className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                        >
                            {availableUnits.map(unit => (
                                <option key={unit} value={unit}>
                                    {unit}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 栄養価計算ボタン */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={handleCalculateNutrition}
                        className="btn-secondary flex items-center min-h-[44px] px-3 py-2 md:py-3 text-sm whitespace-nowrap"
                    >
                        <Calculator className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">栄養価を計算</span>
                        <span className="sm:hidden">計算</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowNutritionCalculator(!showNutritionCalculator)}
                        className="text-sm md:text-base text-primary-600 hover:text-primary-700 min-h-[44px] flex items-center"
                    >
                        手動入力
                    </button>
                </div>

                {/* 栄養価入力（手動または計算結果） */}
                {(showNutritionCalculator || formData.calories !== undefined) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 p-4 md:p-6 bg-gray-50 rounded-lg">
                        <div>
                            <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                                カロリー (kcal)
                            </label>
                            <input
                                type="number"
                                value={formData.calories || ''}
                                onChange={(e) => handleChange('calories', parseFloat(e.target.value) || undefined)}
                                min="0"
                                step="0.1"
                                className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                                タンパク質 (g)
                            </label>
                            <input
                                type="number"
                                value={formData.protein || ''}
                                onChange={(e) => handleChange('protein', parseFloat(e.target.value) || undefined)}
                                min="0"
                                step="0.1"
                                className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                                炭水化物 (g)
                            </label>
                            <input
                                type="number"
                                value={formData.carbs || ''}
                                onChange={(e) => handleChange('carbs', parseFloat(e.target.value) || undefined)}
                                min="0"
                                step="0.1"
                                className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                                脂質 (g)
                            </label>
                            <input
                                type="number"
                                value={formData.fat || ''}
                                onChange={(e) => handleChange('fat', parseFloat(e.target.value) || undefined)}
                                min="0"
                                step="0.1"
                                className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                            />
                        </div>
                    </div>
                )}

                {/* 記録日時 */}
                <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                        記録日時
                    </label>
                    <input
                        type="datetime-local"
                        value={formData.recorded_at}
                        onChange={(e) => handleChange('recorded_at', e.target.value)}
                        className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                        required
                    />
                </div>

                {error && (
                    <div className="text-red-600 text-sm md:text-base p-3 bg-red-50 rounded-lg border border-red-200">{error}</div>
                )}

                {/* ボタン */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                    <button
                        type="submit"
                        disabled={loading || isLoading}
                        className="btn-primary flex items-center justify-center disabled:opacity-50 min-h-[48px] md:min-h-[52px] px-6 py-3 text-sm md:text-base"
                    >
                        <Plus className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                        {(loading || isLoading) ? '保存中...' : (isEditing ? '更新' : '記録')}
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn-secondary min-h-[48px] md:min-h-[52px] px-6 py-3 text-sm md:text-base"
                        >
                            キャンセル
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}