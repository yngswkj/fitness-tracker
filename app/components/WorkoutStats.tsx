'use client'

import { format, startOfWeek } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Calendar, Clock, Target, TrendingUp } from 'lucide-react'
import { WorkoutSummary } from '@/types/workout'

interface WorkoutStatsProps {
    summary: WorkoutSummary[]
}

export default function WorkoutStats({ summary }: WorkoutStatsProps) {
    // 今週のデータを取得
    const thisWeek = summary.find(s => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const summaryWeekStart = new Date(s.week_start)
        return summaryWeekStart.getTime() === weekStart.getTime()
    })

    // 全期間の統計を計算
    const totalStats = summary.reduce(
        (acc, week) => ({
            totalWorkouts: acc.totalWorkouts + week.workout_count,
            totalCompleted: acc.totalCompleted + week.completed_workouts,
            totalDuration: acc.totalDuration + (week.avg_duration_minutes || 0) * week.workout_count
        }),
        { totalWorkouts: 0, totalCompleted: 0, totalDuration: 0 }
    )

    const avgDuration = totalStats.totalWorkouts > 0
        ? totalStats.totalDuration / totalStats.totalWorkouts
        : 0

    const completionRate = totalStats.totalWorkouts > 0
        ? (totalStats.totalCompleted / totalStats.totalWorkouts) * 100
        : 0

    // 週次トレンドを計算
    const weeklyTrend = summary.length >= 2
        ? summary[0].workout_count - summary[1].workout_count
        : 0

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60)
        const mins = Math.round(minutes % 60)

        if (hours > 0) {
            return `${hours}時間${mins}分`
        }
        return `${mins}分`
    }

    const stats = [
        {
            name: '今週のワークアウト',
            value: thisWeek?.workout_count || 0,
            unit: '回',
            icon: Calendar,
            color: 'text-blue-600 bg-blue-50',
            change: weeklyTrend,
            changeLabel: weeklyTrend > 0 ? `先週より+${weeklyTrend}回` : weeklyTrend < 0 ? `先週より${weeklyTrend}回` : '先週と同じ'
        },
        {
            name: '平均ワークアウト時間',
            value: formatDuration(avgDuration),
            unit: '',
            icon: Clock,
            color: 'text-green-600 bg-green-50',
            change: null,
            changeLabel: '過去4週間の平均'
        },
        {
            name: '完了率',
            value: Math.round(completionRate),
            unit: '%',
            icon: Target,
            color: 'text-purple-600 bg-purple-50',
            change: null,
            changeLabel: '開始したワークアウトの完了率'
        },
        {
            name: '総ワークアウト数',
            value: totalStats.totalWorkouts,
            unit: '回',
            icon: TrendingUp,
            color: 'text-orange-600 bg-orange-50',
            change: null,
            changeLabel: '過去4週間の合計'
        }
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
                <div key={stat.name} className="card">
                    <div className="flex items-center">
                        <div className={`p-2 rounded-lg ${stat.color}`}>
                            <stat.icon className="h-5 w-5" />
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                            <div className="flex items-baseline">
                                <p className="text-2xl font-semibold text-gray-900">
                                    {stat.value}
                                </p>
                                {stat.unit && (
                                    <span className="ml-1 text-sm text-gray-500">{stat.unit}</span>
                                )}
                            </div>
                            {stat.change !== null && (
                                <div className="flex items-center mt-1">
                                    <span className={`text-xs ${stat.change > 0
                                            ? 'text-green-600'
                                            : stat.change < 0
                                                ? 'text-red-600'
                                                : 'text-gray-500'
                                        }`}>
                                        {stat.changeLabel}
                                    </span>
                                </div>
                            )}
                            {stat.change === null && (
                                <p className="text-xs text-gray-500 mt-1">{stat.changeLabel}</p>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* 週次チャート（簡易版） */}
            {summary.length > 0 && (
                <div className="col-span-full card">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">週次ワークアウト回数</h3>
                    <div className="flex items-end space-x-2 h-20">
                        {summary.slice(0, 8).reverse().map((week, index) => {
                            const maxCount = Math.max(...summary.map(s => s.workout_count))
                            const height = maxCount > 0 ? (week.workout_count / maxCount) * 100 : 0

                            return (
                                <div key={week.week_start} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full bg-primary-500 rounded-t-sm min-h-[4px] transition-all duration-300"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                        title={`${format(new Date(week.week_start), 'M/d', { locale: ja })}週: ${week.workout_count}回`}
                                    />
                                    <div className="text-xs text-gray-500 mt-1 text-center">
                                        {format(new Date(week.week_start), 'M/d', { locale: ja })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}