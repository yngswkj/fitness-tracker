'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
    AlertTriangle,
    Calendar,
    Utensils,
    Dumbbell,
    Activity,
    Plus,
    X,
    Clock,
    TrendingDown,
    Target
} from 'lucide-react'
import QuickRecordModal from './QuickRecordModal'

interface MissingDataItem {
    date: string
    meals: boolean
    workouts: boolean
    activity: boolean
    hasAnyMissing: boolean
}

interface Notification {
    type: string
    priority: 'high' | 'medium' | 'low'
    title: string
    message: string
    action: string
    actionUrl: string
}

interface WeeklyStats {
    totalDays: number
    recordedDays: number
    mealDays: number
    workoutDays: number
    activityDays: number
}

interface MissingDataResponse {
    missingData: MissingDataItem[]
    consecutiveMissingDays: number
    weeklyStats: WeeklyStats
    notifications: Notification[]
    summary: {
        totalMissingDays: number
        weeklyRecordRate: number
        needsAttention: boolean
    }
}

export default function MissingDataNotifications() {
    const [data, setData] = useState<MissingDataResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([])
    const [showDetails, setShowDetails] = useState(false)
    const [showQuickRecord, setShowQuickRecord] = useState(false)
    const [quickRecordType, setQuickRecordType] = useState<'meal' | 'workout' | 'general'>('general')

    useEffect(() => {
        fetchMissingData()
        // 1時間ごとに更新
        const interval = setInterval(fetchMissingData, 60 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const fetchMissingData = async () => {
        try {
            const response = await fetch('/api/dashboard/missing-data?days=7')
            if (response.ok) {
                const result = await response.json()
                setData(result)
            }
        } catch (error) {
            console.error('Failed to fetch missing data:', error)
        } finally {
            setLoading(false)
        }
    }

    const dismissNotification = (notificationType: string) => {
        setDismissedNotifications(prev => [...prev, notificationType])
    }

    const openQuickRecord = (type: 'meal' | 'workout' | 'general') => {
        setQuickRecordType(type)
        setShowQuickRecord(true)
    }

    const closeQuickRecord = () => {
        setShowQuickRecord(false)
        // データを再取得
        fetchMissingData()
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'missing_meals': return <Utensils className="h-5 w-5" />
            case 'missing_workout': return <Dumbbell className="h-5 w-5" />
            case 'consecutive_missing': return <AlertTriangle className="h-5 w-5" />
            case 'low_weekly_rate': return <TrendingDown className="h-5 w-5" />
            default: return <Calendar className="h-5 w-5" />
        }
    }

    const getNotificationColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-50 border-red-200 text-red-800'
            case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
            case 'low': return 'bg-blue-50 border-blue-200 text-blue-800'
            default: return 'bg-gray-50 border-gray-200 text-gray-800'
        }
    }

    const getActionText = (action: string) => {
        switch (action) {
            case 'record_meal': return '食事を記録'
            case 'start_workout': return 'ワークアウト開始'
            case 'quick_record': return 'クイック記録'
            case 'view_goals': return '目標を確認'
            default: return '詳細を見る'
        }
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!data || (data.notifications.length === 0 && !data.summary.needsAttention)) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-semibold">✓</span>
                        </div>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">
                            素晴らしい記録状況です！
                        </h3>
                        <p className="text-sm text-green-700 mt-1">
                            継続的にデータを記録できています。この調子で続けましょう。
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const visibleNotifications = data.notifications.filter(
        notification => !dismissedNotifications.includes(notification.type)
    )

    return (
        <div className="space-y-4">
            {/* 主要な通知 */}
            {visibleNotifications.map((notification, index) => (
                <div
                    key={notification.type}
                    className={`rounded-lg border p-4 ${getNotificationColor(notification.priority)}`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-0.5">
                                {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold">
                                    {notification.title}
                                </h3>
                                <p className="text-sm mt-1 opacity-90">
                                    {notification.message}
                                </p>
                                <div className="mt-3 flex items-center space-x-3">
                                    {notification.action === 'record_meal' ? (
                                        <button
                                            onClick={() => openQuickRecord('meal')}
                                            className="inline-flex items-center px-3 py-1 bg-white bg-opacity-20 rounded-md text-sm font-medium hover:bg-opacity-30 transition-colors"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {getActionText(notification.action)}
                                        </button>
                                    ) : notification.action === 'start_workout' ? (
                                        <button
                                            onClick={() => openQuickRecord('workout')}
                                            className="inline-flex items-center px-3 py-1 bg-white bg-opacity-20 rounded-md text-sm font-medium hover:bg-opacity-30 transition-colors"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {getActionText(notification.action)}
                                        </button>
                                    ) : notification.action === 'quick_record' ? (
                                        <button
                                            onClick={() => openQuickRecord('general')}
                                            className="inline-flex items-center px-3 py-1 bg-white bg-opacity-20 rounded-md text-sm font-medium hover:bg-opacity-30 transition-colors"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {getActionText(notification.action)}
                                        </button>
                                    ) : (
                                        <Link
                                            href={notification.actionUrl}
                                            className="inline-flex items-center px-3 py-1 bg-white bg-opacity-20 rounded-md text-sm font-medium hover:bg-opacity-30 transition-colors"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {getActionText(notification.action)}
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => dismissNotification(notification.type)}
                                        className="text-xs opacity-70 hover:opacity-100"
                                    >
                                        後で
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => dismissNotification(notification.type)}
                            className="flex-shrink-0 opacity-70 hover:opacity-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ))}

            {/* 週間統計サマリー */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        今週の記録状況
                    </h3>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        {showDetails ? '簡単表示' : '詳細表示'}
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                            {data.weeklyStats.mealDays}/7
                        </div>
                        <div className="text-xs text-gray-500">食事記録</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">
                            {data.weeklyStats.workoutDays}/7
                        </div>
                        <div className="text-xs text-gray-500">ワークアウト</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">
                            {data.weeklyStats.activityDays}/7
                        </div>
                        <div className="text-xs text-gray-500">活動データ</div>
                    </div>
                </div>

                <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>週間記録率</span>
                        <span>{data.summary.weeklyRecordRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all duration-300 ${data.summary.weeklyRecordRate >= 80
                                ? 'bg-green-500'
                                : data.summary.weeklyRecordRate >= 60
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                            style={{ width: `${data.summary.weeklyRecordRate}%` }}
                        ></div>
                    </div>
                </div>

                {showDetails && data.missingData.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                        <h4 className="text-xs font-medium text-gray-700 mb-2">
                            記録が不足している日:
                        </h4>
                        <div className="space-y-2">
                            {data.missingData.slice(0, 3).map((missing) => (
                                <div key={missing.date} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">
                                        {format(new Date(missing.date), 'M月d日', { locale: ja })}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        {missing.meals && (
                                            <span className="text-red-500 flex items-center">
                                                <Utensils className="h-3 w-3 mr-1" />
                                                食事
                                            </span>
                                        )}
                                        {missing.workouts && (
                                            <span className="text-blue-500 flex items-center">
                                                <Dumbbell className="h-3 w-3 mr-1" />
                                                運動
                                            </span>
                                        )}
                                        {missing.activity && (
                                            <span className="text-purple-500 flex items-center">
                                                <Activity className="h-3 w-3 mr-1" />
                                                活動
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {data.missingData.length > 3 && (
                                <div className="text-xs text-gray-500 text-center">
                                    他 {data.missingData.length - 3} 日
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {data.consecutiveMissingDays > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex items-center text-xs text-orange-600">
                            <Clock className="h-3 w-3 mr-1" />
                            連続 {data.consecutiveMissingDays} 日間記録なし
                        </div>
                    </div>
                )}
            </div>

            {/* クイックアクション */}
            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    クイック記録
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => openQuickRecord('meal')}
                        className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <Utensils className="h-5 w-5 text-green-600 mb-1" />
                        <span className="text-xs text-gray-700">食事記録</span>
                    </button>
                    <button
                        onClick={() => openQuickRecord('workout')}
                        className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <Dumbbell className="h-5 w-5 text-blue-600 mb-1" />
                        <span className="text-xs text-gray-700">ワークアウト</span>
                    </button>
                    <Link
                        href="/goals"
                        className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <Target className="h-5 w-5 text-purple-600 mb-1" />
                        <span className="text-xs text-gray-700">目標確認</span>
                    </Link>
                </div>
            </div>

            {/* クイック記録モーダル */}
            <QuickRecordModal
                isOpen={showQuickRecord}
                onClose={closeQuickRecord}
                type={quickRecordType}
            />
        </div>
    )
}