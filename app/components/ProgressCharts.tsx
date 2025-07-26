'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { TrendingUp, Weight, RotateCcw, Target } from 'lucide-react'
import { ExerciseStats } from '@/types/workout'

interface ProgressChartsProps {
    exerciseStats: ExerciseStats
}

export default function ProgressCharts({ exerciseStats }: ProgressChartsProps) {
    // チャート用データの準備
    const chartData = useMemo(() => {
        return exerciseStats.history
            .slice()
            .reverse() // 古い順にソート
            .map((record, index) => ({
                date: format(new Date(record.workout_date), 'M/d', { locale: ja }),
                fullDate: record.workout_date,
                weight: record.weight || 0,
                reps: record.reps,
                volume: record.weight ? record.sets * record.reps * record.weight : record.sets * record.reps,
                sets: record.sets,
                workoutName: record.workout_name,
                index: index + 1
            }))
    }, [exerciseStats.history])

    // 重量の推移データ（重量がある場合のみ）
    const weightData = chartData.filter(d => d.weight > 0)

    // ボリュームの推移データ
    const volumeData = chartData.map(d => ({
        ...d,
        volume: d.weight > 0 ? d.volume : d.sets * d.reps // 自重の場合は総レップ数
    }))

    // カスタムツールチップ
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-medium text-gray-900">{data.workoutName}</p>
                    <p className="text-sm text-gray-600">{format(new Date(data.fullDate), 'yyyy年M月d日', { locale: ja })}</p>
                    <div className="mt-2 space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {entry.value}
                                {entry.dataKey === 'weight' && 'kg'}
                                {entry.dataKey === 'volume' && (data.weight > 0 ? 'kg' : 'reps')}
                            </p>
                        ))}
                    </div>
                </div>
            )
        }
        return null
    }

    const progressTrend = exerciseStats.stats.progress_trend

    return (
        <div className="space-y-6">
            {/* 進捗サマリー */}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    進捗サマリー
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                            {exerciseStats.stats.total_workouts}
                        </div>
                        <div className="text-sm text-blue-600 font-medium">総ワークアウト</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                            {exerciseStats.stats.total_sets}
                        </div>
                        <div className="text-sm text-green-600 font-medium">総セット数</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                            {exerciseStats.stats.total_reps.toLocaleString()}
                        </div>
                        <div className="text-sm text-purple-600 font-medium">総レップ数</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                            {exerciseStats.stats.avg_reps}
                        </div>
                        <div className="text-sm text-orange-600 font-medium">平均レップ</div>
                    </div>
                </div>

                {/* 進捗トレンド */}
                {progressTrend && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">進捗トレンド</span>
                            <div className={`flex items-center space-x-2 ${progressTrend.trend === 'improving'
                                    ? 'text-green-600'
                                    : progressTrend.trend === 'declining'
                                        ? 'text-red-600'
                                        : 'text-gray-600'
                                }`}>
                                <TrendingUp className={`h-4 w-4 ${progressTrend.trend === 'declining' ? 'rotate-180' : ''
                                    }`} />
                                <span className="font-medium">
                                    {progressTrend.weight_change_percent > 0 ? '+' : ''}
                                    {progressTrend.weight_change_percent}%
                                </span>
                                <span className="text-sm">
                                    ({progressTrend.trend === 'improving' ? '向上' :
                                        progressTrend.trend === 'declining' ? '低下' : '安定'})
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 重量の推移チャート */}
            {weightData.length > 0 && (
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Weight className="h-5 w-5 mr-2" />
                        重量の推移
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weightData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#666"
                                    fontSize={12}
                                />
                                <YAxis
                                    stroke="#666"
                                    fontSize={12}
                                    label={{ value: '重量 (kg)', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="weight"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                                    name="重量"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ボリュームの推移チャート */}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    {weightData.length > 0 ? 'ボリュームの推移' : 'レップ数の推移'}
                </h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volumeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="date"
                                stroke="#666"
                                fontSize={12}
                            />
                            <YAxis
                                stroke="#666"
                                fontSize={12}
                                label={{
                                    value: weightData.length > 0 ? 'ボリューム (kg)' : '総レップ数',
                                    angle: -90,
                                    position: 'insideLeft'
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                dataKey="volume"
                                fill="#10b981"
                                name={weightData.length > 0 ? 'ボリューム' : '総レップ数'}
                                radius={[2, 2, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* レップ数の推移チャート */}
            {chartData.length > 0 && (
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <RotateCcw className="h-5 w-5 mr-2" />
                        レップ数の推移
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#666"
                                    fontSize={12}
                                />
                                <YAxis
                                    stroke="#666"
                                    fontSize={12}
                                    label={{ value: 'レップ数', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="reps"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                                    name="レップ数"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    )
}