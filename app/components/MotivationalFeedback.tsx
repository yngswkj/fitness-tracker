'use client'

import { useState, useEffect } from 'react'
import { format, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
    Trophy,
    TrendingUp,
    Target,
    Zap,
    Heart,
    Star,
    Award,
    Flame,
    CheckCircle,
    AlertCircle
} from 'lucide-react'

interface Goal {
    id: number
    type: string
    title: string
    target_value: number
    unit: string
    period: string
    start_date: string
    end_date?: string
    status: 'active' | 'completed' | 'paused'
}

interface GoalProgressData {
    goal_id: number
    current_value: number
    progress_percentage: number
    is_achieved: boolean
    last_updated: string
}

interface MotivationalMessage {
    type: 'achievement' | 'encouragement' | 'milestone' | 'streak' | 'reminder'
    title: string
    message: string
    icon: React.ReactNode
    color: string
    bgColor: string
}

interface MotivationalFeedbackProps {
    goals: Goal[]
    progressData: Record<number, GoalProgressData>
}

export default function MotivationalFeedback({ goals, progressData }: MotivationalFeedbackProps) {
    const [messages, setMessages] = useState<MotivationalMessage[]>([])

    useEffect(() => {
        generateMotivationalMessages()
    }, [goals, progressData])

    const generateMotivationalMessages = () => {
        const newMessages: MotivationalMessage[] = []

        // 達成済み目標の祝福メッセージ
        const achievedGoals = goals.filter(goal => {
            const progress = progressData[goal.id]
            return progress?.is_achieved
        })

        if (achievedGoals.length > 0) {
            const recentAchieved = achievedGoals[0] // 最新の達成目標
            newMessages.push({
                type: 'achievement',
                title: '🎉 目標達成おめでとうございます！',
                message: `「${recentAchieved.title}」を達成しました！素晴らしい努力です。`,
                icon: <Trophy className="h-5 w-5" />,
                color: 'text-yellow-700',
                bgColor: 'bg-yellow-50 border-yellow-200'
            })
        }

        // 高進捗率の目標への励ましメッセージ
        const highProgressGoals = goals.filter(goal => {
            const progress = progressData[goal.id]
            return progress && progress.progress_percentage >= 80 && !progress.is_achieved
        })

        if (highProgressGoals.length > 0) {
            const goal = highProgressGoals[0]
            const progress = progressData[goal.id]
            newMessages.push({
                type: 'encouragement',
                title: '🔥 もう少しで達成です！',
                message: `「${goal.title}」まであと${Math.round(100 - progress.progress_percentage)}%です。頑張って！`,
                icon: <Flame className="h-5 w-5" />,
                color: 'text-orange-700',
                bgColor: 'bg-orange-50 border-orange-200'
            })
        }

        // マイルストーン達成メッセージ
        const milestoneGoals = goals.filter(goal => {
            const progress = progressData[goal.id]
            return progress && [25, 50, 75].includes(Math.round(progress.progress_percentage))
        })

        if (milestoneGoals.length > 0) {
            const goal = milestoneGoals[0]
            const progress = progressData[goal.id]
            const milestone = Math.round(progress.progress_percentage)
            newMessages.push({
                type: 'milestone',
                title: `✨ ${milestone}%達成しました！`,
                message: `「${goal.title}」の${milestone}%を達成。順調に進んでいます！`,
                icon: <Star className="h-5 w-5" />,
                color: 'text-blue-700',
                bgColor: 'bg-blue-50 border-blue-200'
            })
        }

        // 継続ストリークメッセージ
        const activeGoals = goals.filter(goal => goal.status === 'active')
        if (activeGoals.length > 0) {
            const streakDays = activeGoals.map(goal => {
                const startDate = new Date(goal.start_date)
                const today = new Date()
                return differenceInDays(today, startDate) + 1
            })
            const maxStreak = Math.max(...streakDays)

            if (maxStreak >= 7 && maxStreak % 7 === 0) {
                newMessages.push({
                    type: 'streak',
                    title: `🔥 ${maxStreak}日間継続中！`,
                    message: `目標に向けて${maxStreak}日間継続しています。この調子で続けましょう！`,
                    icon: <Zap className="h-5 w-5" />,
                    color: 'text-purple-700',
                    bgColor: 'bg-purple-50 border-purple-200'
                })
            }
        }

        // 低進捗率の目標への励ましメッセージ
        const lowProgressGoals = goals.filter(goal => {
            const progress = progressData[goal.id]
            return progress && progress.progress_percentage < 30 && goal.status === 'active'
        })

        if (lowProgressGoals.length > 0 && newMessages.length === 0) {
            const goal = lowProgressGoals[0]
            newMessages.push({
                type: 'reminder',
                title: '💪 一歩ずつ進みましょう',
                message: `「${goal.title}」の進捗を上げるために、今日も小さな一歩を踏み出しましょう。`,
                icon: <Heart className="h-5 w-5" />,
                color: 'text-green-700',
                bgColor: 'bg-green-50 border-green-200'
            })
        }

        // 目標がない場合のメッセージ
        if (goals.length === 0) {
            newMessages.push({
                type: 'reminder',
                title: '🎯 目標を設定しましょう',
                message: '新しい目標を設定して、健康的な生活を始めませんか？',
                icon: <Target className="h-5 w-5" />,
                color: 'text-indigo-700',
                bgColor: 'bg-indigo-50 border-indigo-200'
            })
        }

        setMessages(newMessages.slice(0, 2)) // 最大2つのメッセージを表示
    }

    const getMotivationalQuote = () => {
        const quotes = [
            "小さな進歩も進歩です。",
            "継続は力なり。",
            "今日の努力が明日の結果を作ります。",
            "目標は夢に期限をつけたもの。",
            "成功は準備と機会が出会うところに生まれる。",
            "一歩一歩、着実に前進しましょう。",
            "挑戦することで成長できます。",
            "健康は最大の財産です。"
        ]
        return quotes[Math.floor(Math.random() * quotes.length)]
    }

    if (messages.length === 0) {
        return (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                        <Heart className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-blue-900">今日も頑張りましょう！</h3>
                        <p className="text-blue-700 text-sm mt-1">{getMotivationalQuote()}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`rounded-lg p-4 border ${message.bgColor} ${message.color}`}
                >
                    <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                            {message.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm">{message.title}</h3>
                            <p className="text-sm mt-1 opacity-90">{message.message}</p>
                        </div>
                    </div>
                </div>
            ))}

            {/* 追加の励ましメッセージ */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-gray-600" />
                    <p className="text-gray-700 text-sm font-medium">今日の格言</p>
                </div>
                <p className="text-gray-600 text-sm mt-2 italic">"{getMotivationalQuote()}"</p>
            </div>
        </div>
    )
}