'use client'

import { Award, Trophy, Target, TrendingUp } from 'lucide-react'

interface PersonalRecordsProps {
    exerciseName: string
    personalRecords: {
        max_weight_pr: number | null
        max_reps_pr: number | null
        max_volume_pr: number | null
    }
    stats: {
        max_weight: number | null
        avg_weight: number | null
        max_reps: number
        avg_reps: number
    }
}

export default function PersonalRecords({ exerciseName, personalRecords, stats }: PersonalRecordsProps) {
    const records = [
        {
            title: '最大重量',
            value: personalRecords.max_weight_pr,
            unit: 'kg',
            icon: Trophy,
            color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
            description: '1回で持ち上げた最大重量'
        },
        {
            title: '最大レップ数',
            value: personalRecords.max_reps_pr,
            unit: 'reps',
            icon: Target,
            color: 'text-blue-600 bg-blue-50 border-blue-200',
            description: '1セットでの最大レップ数'
        },
        {
            title: '最大ボリューム',
            value: personalRecords.max_volume_pr,
            unit: stats.max_weight ? 'kg' : 'reps',
            icon: Award,
            color: 'text-purple-600 bg-purple-50 border-purple-200',
            description: stats.max_weight ? '1セットでの最大ボリューム' : '1セットでの最大レップ数'
        }
    ]

    const averageStats = [
        {
            title: '平均重量',
            value: stats.avg_weight,
            unit: 'kg',
            icon: TrendingUp,
            color: 'text-green-600'
        },
        {
            title: '平均レップ数',
            value: stats.avg_reps,
            unit: 'reps',
            icon: Target,
            color: 'text-blue-600'
        }
    ]

    return (
        <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2" />
                {exerciseName} の記録
            </h3>

            {/* 個人記録 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {records.map((record) => (
                    <div
                        key={record.title}
                        className={`p-4 rounded-lg border-2 ${record.color}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <record.icon className="h-6 w-6" />
                            <div className="text-right">
                                <div className="text-2xl font-bold">
                                    {record.value !== null && record.value !== undefined
                                        ? record.value.toLocaleString()
                                        : '-'
                                    }
                                </div>
                                {record.value !== null && record.value !== undefined && (
                                    <div className="text-sm opacity-75">{record.unit}</div>
                                )}
                            </div>
                        </div>
                        <div className="text-sm font-medium mb-1">{record.title}</div>
                        <div className="text-xs opacity-75">{record.description}</div>
                    </div>
                ))}
            </div>

            {/* 平均値 */}
            <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">平均値</h4>
                <div className="grid grid-cols-2 gap-4">
                    {averageStats.map((stat) => (
                        <div key={stat.title} className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
                                <stat.icon className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {stat.value !== null && stat.value !== undefined
                                        ? typeof stat.value === 'number'
                                            ? stat.value.toFixed(1)
                                            : stat.value
                                        : '-'
                                    }
                                    {stat.value !== null && stat.value !== undefined && (
                                        <span className="text-sm text-gray-500 ml-1">{stat.unit}</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600">{stat.title}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 記録達成のヒント */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                    <strong>💡 記録更新のヒント:</strong>
                    <ul className="mt-1 space-y-1 text-xs">
                        <li>• 重量を少しずつ増やして筋力向上を目指しましょう</li>
                        <li>• フォームを正しく保ちながらレップ数を増やしてみましょう</li>
                        <li>• 十分な休息と栄養で筋肉の回復を促進しましょう</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}