// 栄養価計算のユーティリティ関数

export interface NutritionInfo {
    calories: number
    protein: number
    carbs: number
    fat: number
}

export interface FoodItem {
    name: string
    nutrition_per_100g: NutritionInfo
    common_units?: Array<{
        unit: string
        grams: number
    }>
}

// 基本的な食材データベース（100gあたりの栄養価）
export const FOOD_DATABASE: Record<string, FoodItem> = {
    // 主食
    '白米': {
        name: '白米',
        nutrition_per_100g: { calories: 168, protein: 2.5, carbs: 37.1, fat: 0.3 },
        common_units: [
            { unit: '茶碗1杯', grams: 150 },
            { unit: '丼1杯', grams: 250 }
        ]
    },
    '玄米': {
        name: '玄米',
        nutrition_per_100g: { calories: 165, protein: 2.8, carbs: 35.6, fat: 1.0 },
        common_units: [
            { unit: '茶碗1杯', grams: 150 },
            { unit: '丼1杯', grams: 250 }
        ]
    },
    '食パン': {
        name: '食パン',
        nutrition_per_100g: { calories: 264, protein: 9.3, carbs: 46.7, fat: 4.4 },
        common_units: [
            { unit: '6枚切り1枚', grams: 60 },
            { unit: '8枚切り1枚', grams: 45 }
        ]
    },
    'うどん': {
        name: 'うどん',
        nutrition_per_100g: { calories: 105, protein: 2.6, carbs: 21.6, fat: 0.4 },
        common_units: [
            { unit: '1玉', grams: 250 }
        ]
    },
    'そば': {
        name: 'そば',
        nutrition_per_100g: { calories: 132, protein: 4.8, carbs: 26.0, fat: 0.7 },
        common_units: [
            { unit: '1玉', grams: 200 }
        ]
    },

    // 肉類
    '鶏胸肉': {
        name: '鶏胸肉',
        nutrition_per_100g: { calories: 108, protein: 22.3, carbs: 0, fat: 1.5 }
    },
    '鶏もも肉': {
        name: '鶏もも肉',
        nutrition_per_100g: { calories: 200, protein: 16.2, carbs: 0, fat: 14.0 }
    },
    '牛肉': {
        name: '牛肉',
        nutrition_per_100g: { calories: 259, protein: 17.1, carbs: 0.3, fat: 20.0 }
    },
    '豚肉': {
        name: '豚肉',
        nutrition_per_100g: { calories: 263, protein: 17.1, carbs: 0.1, fat: 21.1 }
    },

    // 魚類
    '鮭': {
        name: '鮭',
        nutrition_per_100g: { calories: 133, protein: 22.3, carbs: 0.1, fat: 4.1 }
    },
    'まぐろ': {
        name: 'まぐろ',
        nutrition_per_100g: { calories: 125, protein: 26.4, carbs: 0.1, fat: 1.4 }
    },
    'さば': {
        name: 'さば',
        nutrition_per_100g: { calories: 202, protein: 20.7, carbs: 0.3, fat: 12.1 }
    },

    // 卵・乳製品
    '卵': {
        name: '卵',
        nutrition_per_100g: { calories: 151, protein: 12.3, carbs: 0.3, fat: 10.3 },
        common_units: [
            { unit: 'Mサイズ1個', grams: 50 },
            { unit: 'Lサイズ1個', grams: 60 }
        ]
    },
    '牛乳': {
        name: '牛乳',
        nutrition_per_100g: { calories: 67, protein: 3.3, carbs: 4.8, fat: 3.8 },
        common_units: [
            { unit: 'コップ1杯', grams: 200 }
        ]
    },
    'ヨーグルト': {
        name: 'ヨーグルト',
        nutrition_per_100g: { calories: 62, protein: 3.6, carbs: 4.9, fat: 3.0 }
    },

    // 野菜
    'ブロッコリー': {
        name: 'ブロッコリー',
        nutrition_per_100g: { calories: 33, protein: 4.3, carbs: 5.2, fat: 0.5 }
    },
    'にんじん': {
        name: 'にんじん',
        nutrition_per_100g: { calories: 39, protein: 0.6, carbs: 9.3, fat: 0.2 }
    },
    'ほうれん草': {
        name: 'ほうれん草',
        nutrition_per_100g: { calories: 20, protein: 2.2, carbs: 3.1, fat: 0.4 }
    },
    'キャベツ': {
        name: 'キャベツ',
        nutrition_per_100g: { calories: 23, protein: 1.3, carbs: 5.2, fat: 0.2 }
    },

    // 果物
    'バナナ': {
        name: 'バナナ',
        nutrition_per_100g: { calories: 86, protein: 1.1, carbs: 22.5, fat: 0.2 },
        common_units: [
            { unit: '中サイズ1本', grams: 100 }
        ]
    },
    'りんご': {
        name: 'りんご',
        nutrition_per_100g: { calories: 54, protein: 0.2, carbs: 14.6, fat: 0.1 },
        common_units: [
            { unit: '中サイズ1個', grams: 250 }
        ]
    },
    'オレンジ': {
        name: 'オレンジ',
        nutrition_per_100g: { calories: 39, protein: 1.0, carbs: 9.6, fat: 0.1 },
        common_units: [
            { unit: '中サイズ1個', grams: 200 }
        ]
    },
    'いちご': {
        name: 'いちご',
        nutrition_per_100g: { calories: 34, protein: 0.9, carbs: 8.5, fat: 0.1 },
        common_units: [
            { unit: '1粒', grams: 15 }
        ]
    },
    'ぶどう': {
        name: 'ぶどう',
        nutrition_per_100g: { calories: 59, protein: 0.4, carbs: 15.2, fat: 0.1 }
    },

    // 豆類・ナッツ類
    '豆腐': {
        name: '豆腐（木綿）',
        nutrition_per_100g: { calories: 72, protein: 6.6, carbs: 1.6, fat: 4.2 }
    },
    '納豆': {
        name: '納豆',
        nutrition_per_100g: { calories: 200, protein: 16.5, carbs: 12.1, fat: 10.0 },
        common_units: [
            { unit: '1パック', grams: 50 }
        ]
    },
    'アーモンド': {
        name: 'アーモンド',
        nutrition_per_100g: { calories: 598, protein: 18.6, carbs: 19.7, fat: 54.2 },
        common_units: [
            { unit: '1粒', grams: 1 }
        ]
    },

    // 調味料・油脂
    'オリーブオイル': {
        name: 'オリーブオイル',
        nutrition_per_100g: { calories: 921, protein: 0, carbs: 0, fat: 100 },
        common_units: [
            { unit: '大さじ1', grams: 12 },
            { unit: '小さじ1', grams: 4 }
        ]
    },
    'バター': {
        name: 'バター',
        nutrition_per_100g: { calories: 745, protein: 0.6, carbs: 0.2, fat: 81.0 },
        common_units: [
            { unit: '大さじ1', grams: 12 }
        ]
    },

    // その他の野菜
    'トマト': {
        name: 'トマト',
        nutrition_per_100g: { calories: 19, protein: 0.7, carbs: 4.7, fat: 0.1 },
        common_units: [
            { unit: '中サイズ1個', grams: 150 }
        ]
    },
    'きゅうり': {
        name: 'きゅうり',
        nutrition_per_100g: { calories: 14, protein: 1.0, carbs: 3.0, fat: 0.1 },
        common_units: [
            { unit: '1本', grams: 100 }
        ]
    },
    'たまねぎ': {
        name: 'たまねぎ',
        nutrition_per_100g: { calories: 37, protein: 1.0, carbs: 8.8, fat: 0.1 },
        common_units: [
            { unit: '中サイズ1個', grams: 200 }
        ]
    },
    'じゃがいも': {
        name: 'じゃがいも',
        nutrition_per_100g: { calories: 76, protein: 1.6, carbs: 17.6, fat: 0.1 },
        common_units: [
            { unit: '中サイズ1個', grams: 150 }
        ]
    }
}

/**
 * 食材名から栄養価を計算する
 */
export function calculateNutrition(
    foodName: string,
    quantity: number,
    unit: string
): NutritionInfo | null {
    const food = FOOD_DATABASE[foodName]
    if (!food) {
        return null
    }

    let gramsAmount = quantity

    // 単位がgでない場合、グラムに変換
    if (unit !== 'g') {
        const commonUnit = food.common_units?.find(u => u.unit === unit)
        if (commonUnit) {
            gramsAmount = quantity * commonUnit.grams
        } else {
            // 一般的な単位変換
            switch (unit) {
                case 'ml':
                    gramsAmount = quantity // 液体は1ml≈1gと仮定
                    break
                case '個':
                    gramsAmount = quantity * 100 // デフォルト100g/個
                    break
                case '杯':
                    gramsAmount = quantity * 150 // デフォルト150g/杯
                    break
                case '切れ':
                    gramsAmount = quantity * 50 // デフォルト50g/切れ
                    break
                case '本':
                    gramsAmount = quantity * 100 // デフォルト100g/本
                    break
                case '枚':
                    gramsAmount = quantity * 20 // デフォルト20g/枚
                    break
                default:
                    gramsAmount = quantity
            }
        }
    }

    const ratio = gramsAmount / 100
    const nutrition = food.nutrition_per_100g

    return {
        calories: Math.round(nutrition.calories * ratio),
        protein: Math.round(nutrition.protein * ratio * 10) / 10,
        carbs: Math.round(nutrition.carbs * ratio * 10) / 10,
        fat: Math.round(nutrition.fat * ratio * 10) / 10
    }
}

/**
 * 食材名の候補を検索する
 */
export function searchFoods(query: string): string[] {
    if (!query) return []

    const lowerQuery = query.toLowerCase()
    return Object.keys(FOOD_DATABASE)
        .filter(name => name.toLowerCase().includes(lowerQuery))
        .slice(0, 10)
}

/**
 * 食材の一般的な単位を取得する
 */
export function getCommonUnits(foodName: string): string[] {
    const food = FOOD_DATABASE[foodName]
    if (!food) return ['g']

    const units = ['g']
    if (food.common_units) {
        units.push(...food.common_units.map(u => u.unit))
    }

    return units
}