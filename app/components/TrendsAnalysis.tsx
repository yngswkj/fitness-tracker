'use client'

import { useMemo, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Activity, Utensils, Dumbbell, Target } from 'lucide-react'

interface TrendsData {
    period: 'week' | 'month'
    weeks?: number
    months?: number
    workouts: Array<{
        week_start?: string
        month_start?: string
        workout_count: number
        completed_workouts: number
        avg_duration_minutes: number | null
        total_completed: number
    }>
    meals: Array<{
        week_start?: string
        month_start?: string
        meal_count: number
        avg_calories: number | null
        avg_protein: number | null
        avg_carbs: number | null
        avg_fat: number | null
        total_calories: number | null
    }>
    exercises: Array<{
        week_start?: string
        month_start?: string
        total_exercises: number
        unique_exercises: number
        total_reps: number
        avg_weight: number | null
        max_weight: number | null
    }>
}

interface TrendsAnalysisProps {
    data: TrendsData
}

export default function TrendsAnalysis({ data }: TrendsAnalysisProps) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // データの統合とフォーマット
    const chartData = useMemo(() => {
        const periodKey = data.period === 'week' ? 'week_start' : 'month_start'
        const formatPattern = data.period === 'week' ? 'M/d' : 'yyyy/M'

        // 全期間のデータを統合
        const allPeriods = new Set([
            ...data.workouts.map(w => w[periodKey]),
            ...data.meals.map(m => m[periodKey]),
            ...data.exercises.map(e => e[periodKey])
        ].filter(Boolean))

        return Array.from(allPeriods)
            .sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())
            .map(period => {
                const workout = data.workouts.find(w => w[periodKey] === period)
                const meal = data.meals.find(m => m[periodKey] === period)
                const exercise = data.exercises.find(e => e[periodKey] === period)

                return {
                    period: format(new Date(period!), formatPattern, { locale: ja }),
                    fullDate: period,
                    // ワークアウトデータ
                    workoutCount: workout?.workout_count || 0,
                    completedWorkouts: workout?.completed_workouts || 0,
                    avgDuration: workout?.avg_duration_minutes || 0,
                    // 食事データ
                    mealCount: meal?.meal_count || 0,
                    avgCalories: meal?.avg_calories || 0,
                    totalCalories: meal?.total_calories || 0,
                    avgProtein: meal?.avg_protein || 0,
                    // エクササイズデータ
                    totalExercises: exercise?.total_exercises || 0,
                    uniqueExercises: exercise?.unique_exercises || 0,
                    totalReps: exercise?.total_reps || 0,
                    avgWeight: exercise?.avg_weight || 0,
                    maxWeight: exercise?.max_weight || 0
                }
            })
    }, [data])

    // トレンド計算
    const trends = useMemo(() => {
        if (chartData.length < 2) return null

        const recent = chartData.slice(-3) // 最新3期間
        const previous = chartData.slice(-6, -3) // その前の3期間

        if (recent.length === 0 || previous.length === 0) return null

        const recentAvg = {
            workouts: recent.reduce((sum, d) => sum + d.workoutCount, 0) / recent.length,
            calories: recent.reduce((sum, d) => sum + d.avgCalories, 0) / recent.length,
            exercises: recent.reduce((sum, d) => sum + d.totalExercises, 0) / recent.length
        }

        const previousAvg = {
            workouts: previous.reduce((sum, d) => sum + d.workoutCount, 0) / previous.length,
            calories: previous.reduce((sum, d) => sum + d.avgCalories, 0) / previous.length,
            exercises: previous.reduce((sum, d) => sum + d.totalExercises, 0) / previous.length
        }

        return {
            workouts: {
                change: ((recentAvg.workouts - previousAvg.workouts) / previousAvg.workouts) * 100,
                trend: recentAvg.workouts > previousAvg.workouts ? 'up' : recentAvg.workouts < previousAvg.workouts ? 'down' : 'stable'
            },
            calories: {
                change: previousAvg.calories > 0 ? ((recentAvg.calories - previousAvg.calories) / previousAvg.calories) * 100 : 0,
                trend: recentAvg.calories > previousAvg.calories ? 'up' : recentAvg.calories < previousAvg.calories ? 'down' : 'stable'
            },
            exercises: {
                change: previousAvg.exercises > 0 ? ((recentAvg.exercises - previousAvg.exercises) / previousAvg.exercises) * 100 : 0,
                trend: recentAvg.exercises > previousAvg.exercises ? 'up' : recentAvg.exercises < previousAvg.exercises ? 'down' : 'stable'
            }
        }
    }, [chartData])

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-medium text-gray-900">{label}</p>
                    <div className="mt-2 space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                                {entry.dataKey.includes('Calories') && 'kcal'}
                                {entry.dataKey.includes('Duration') && '分'}
                                {entry.dataKey.includes('Weight') && 'kg'}
                            </p>
                        ))}
                    </div>
                </div>
            )
        }
        return null
    }

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />
            case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />
            default: return <div className="h-4 w-4" />
        }
    }

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'up': return 'text-green-600'
            case 'down': return 'text-red-600'
            default: return 'text-gray-600'
        }
    }

    return (
        <div className="space-y-6">
            {/* 期間選択とサマリー */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">
                        {data.period === 'week' ? '週次' : '月次'}トレンド分析
                    </h2>
                    <span className="text-sm text-gray-500">
                        (過去{data.period === 'week' ? data.weeks : data.months}{data.period === 'week' ? '週間' : 'ヶ月'})
                    </span>
                </div>
            </div>

            {/* トレンドサマリー */}
            {trends && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Dumbbell className="h-5 w-5 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">ワークアウト</span>
                            </div>
                            <div className={`flex items-center space-x-1 ${getTrendColor(trends.workouts.trend)}`}>
                                {getTrendIcon(trends.workouts.trend)}
                                <span className="text-sm font-medium">
                                    {trends.workouts.change > 0 ? '+' : ''}{trends.workouts.change.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Utensils className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-medium text-gray-700">カロリー</span>
                            </div>
                            <div className={`flex items-center space-x-1 ${getTrendColor(trends.calories.trend)}`}>
                                {getTrendIcon(trends.calories.trend)}
                                <span className="text-sm font-medium">
                                    {trends.calories.change > 0 ? '+' : ''}{trends.calories.change.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Target className="h-5 w-5 text-purple-600" />
                                <span className="text-sm font-medium text-gray-700">エクササイズ</span>
                            </div>
                            <div className={`flex items-center space-x-1 ${getTrendColor(trends.exercises.trend)}`}>
                                {getTrendIcon(trends.exercises.trend)}
                                <span className="text-sm font-medium">
                                    {trends.exercises.change > 0 ? '+' : ''}{trends.exercises.change.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ワークアウトトレンドチャート */}
            <div className="card">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6 flex items-center">
                    <Activity className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                    ワークアウトトレンド
                </h3>
                <div className="h-64 md:h-80 lg:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="period"
                                stroke="#666"
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fontSize: isMobile ? 10 : 12 }}
                            />
                            <YAxis
                                yAxisId="count"
                                stroke="#666"
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fontSize: isMobile ? 10 : 12 }}
                                label={{
                                    value: '回数',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle', fontSize: isMobile ? 10 : 12 }
                                }}
                            />
                            <YAxis
                                yAxisId="duration"
                                orientation="right"
                                stroke="#666"
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fontSize: isMobile ? 10 : 12 }}
                                label={{
                                    value: '時間(分)',
                                    angle: 90,
                                    position: 'insideRight',
                                    style: { textAnchor: 'middle', fontSize: isMobile ? 10 : 12 }
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                yAxisId="count"
                                dataKey="workoutCount"
                                fill="#3b82f6"
                                name="ワークアウト回数"
                                radius={[2, 2, 0, 0]}
                            />
                            <Line
                                yAxisId="duration"
                                type="monotone"
                                dataKey="avgDuration"
                                stroke="#10b981"
                                strokeWidth={isMobile ? 2 : 3}
                                dot={{ fill: '#10b981', strokeWidth: 2, r: isMobile ? 3 : 4 }}
                                name="平均時間"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 栄養トレンドチャート */}
            <div className="card">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6 flex items-center">
                    <Utensils className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                    栄養トレンド
                </h3>
                <div className="h-64 md:h-80 lg:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="period"
                                stroke="#666"
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fontSize: isMobile ? 10 : 12 }}
                            />
                            <YAxis
                                stroke="#666"
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fontSize: isMobile ? 10 : 12 }}
                                label={{
                                    value: 'kcal/g',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle', fontSize: isMobile ? 10 : 12 }
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="avgCalories"
                                stroke="#f59e0b"
                                strokeWidth={isMobile ? 2 : 3}
                                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                                name="平均カロリー"
                            />
                            <Line
                                type="monotone"
                                dataKey="avgProtein"
                                stroke="#ef4444"
                                strokeWidth={3}
                                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                                name="平均タンパク質"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* エクササイズトレンドチャート */}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    エクササイズトレンド
                </h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="period"
                                stroke="#666"
                                fontSize={12}
                            />
                            <YAxis
                                yAxisId="count"
                                stroke="#666"
                                fontSize={12}
                                label={{ value: '回数', angle: -90, position: 'insideLeft' }}
                            />
                            <YAxis
                                yAxisId="weight"
                                orientation="right"
                                stroke="#666"
                                fontSize={12}
                                label={{ value: '重量(kg)', angle: 90, position: 'insideRight' }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                yAxisId="count"
                                dataKey="totalExercises"
                                fill="#8b5cf6"
                                name="総エクササイズ数"
                                radius={[2, 2, 0, 0]}
                            />
                            <Line
                                yAxisId="weight"
                                type="monotone"
                                dataKey="avgWeight"
                                stroke="#f97316"
                                strokeWidth={3}
                                dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                                name="平均重量"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}