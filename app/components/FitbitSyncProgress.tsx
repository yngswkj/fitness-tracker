'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface SyncProgressProps {
    onSyncComplete?: () => void
}

interface SyncProgress {
    totalDays: number
    processedDays: number
    successfulImports: number
    failedImports: number
    remainingDays: number
    currentDate: string | null
    progress: number
    estimatedTimeRemaining: string | null
}

export default function FitbitSyncProgress({ onSyncComplete }: SyncProgressProps) {
    const [syncing, setSyncing] = useState(false)
    const [progress, setProgress] = useState<SyncProgress>({
        totalDays: 0,
        processedDays: 0,
        successfulImports: 0,
        failedImports: 0,
        remainingDays: 0,
        currentDate: null,
        progress: 0,
        estimatedTimeRemaining: null
    })
    const [rateLimitInfo, setRateLimitInfo] = useState({
        isWaiting: false,
        message: ''
    })
    const [syncResult, setSyncResult] = useState<{
        success: boolean
        message: string
    } | null>(null)

    const handleSync = async (days: number = 7) => {
        setSyncing(true)
        setProgress({
            totalDays: 0,
            processedDays: 0,
            successfulImports: 0,
            failedImports: 0,
            remainingDays: 0,
            currentDate: null,
            progress: 0,
            estimatedTimeRemaining: null
        })
        setRateLimitInfo({
            isWaiting: false,
            message: ''
        })
        setSyncResult(null)

        try {
            // 期間を計算
            const endDate = new Date()
            endDate.setDate(endDate.getDate() - 1) // 昨日まで
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - days)

            const response = await fetch('/api/fitbit/import-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    dataTypes: ['activity', 'heart', 'sleep', 'body'],
                    overwriteExisting: true,
                    batchSize: 3
                })
            })

            if (!response.ok) {
                const error = await response.json()
                setSyncResult({
                    success: false,
                    message: `同期エラー: ${error.error}`
                })
                return
            }

            // Server-Sent Events を処理
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let startTime = Date.now()

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n')

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))

                                if (data.type === 'start' || data.type === 'progress') {
                                    // 推定残り時間を計算
                                    let estimatedTimeRemaining = null
                                    if (data.processedDays > 0 && data.remainingDays > 0) {
                                        const elapsedTime = Date.now() - startTime
                                        const avgTimePerDay = elapsedTime / data.processedDays
                                        const remainingTime = avgTimePerDay * data.remainingDays

                                        const minutes = Math.floor(remainingTime / 60000)
                                        const seconds = Math.floor((remainingTime % 60000) / 1000)

                                        if (minutes > 0) {
                                            estimatedTimeRemaining = `約${minutes}分${seconds}秒`
                                        } else {
                                            estimatedTimeRemaining = `約${seconds}秒`
                                        }
                                    }

                                    setProgress({
                                        totalDays: data.totalDays,
                                        processedDays: data.processedDays,
                                        successfulImports: data.successfulImports,
                                        failedImports: data.failedImports,
                                        remainingDays: data.remainingDays,
                                        currentDate: data.currentDate,
                                        progress: data.progress || 0,
                                        estimatedTimeRemaining
                                    })
                                } else if (data.type === 'rate_limit') {
                                    setRateLimitInfo({
                                        isWaiting: true,
                                        message: data.message
                                    })

                                    // カウントダウンタイマー
                                    let remainingTime = data.waitTime
                                    const countdown = setInterval(() => {
                                        remainingTime--
                                        setRateLimitInfo({
                                            isWaiting: true,
                                            message: `API制限に達しました。あと${remainingTime}秒待機中...`
                                        })

                                        if (remainingTime <= 0) {
                                            clearInterval(countdown)
                                            setRateLimitInfo({
                                                isWaiting: false,
                                                message: ''
                                            })
                                        }
                                    }, 1000)
                                } else if (data.type === 'complete') {
                                    setSyncResult({
                                        success: true,
                                        message: `同期完了: ${data.summary.successfulImports}日成功, ${data.summary.failedImports}日失敗`
                                    })
                                    if (onSyncComplete) {
                                        onSyncComplete()
                                    }
                                } else if (data.type === 'error') {
                                    setSyncResult({
                                        success: false,
                                        message: `同期エラー: ${data.error}`
                                    })
                                }
                            } catch (parseError) {
                                console.error('Failed to parse SSE data:', parseError)
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Sync error:', error)
            setSyncResult({
                success: false,
                message: '同期中にエラーが発生しました'
            })
        } finally {
            setSyncing(false)
        }
    }

    if (!syncing && !syncResult) {
        return (
            <div className="flex gap-2">
                <button
                    onClick={() => handleSync(1)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    今日
                </button>
                <button
                    onClick={() => handleSync(7)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    過去7日
                </button>
                <button
                    onClick={() => handleSync(30)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    過去30日
                </button>
            </div>
        )
    }

    if (syncResult) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                    {syncResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${syncResult.success ? 'text-green-900' : 'text-red-900'}`}>
                        {syncResult.message}
                    </span>
                </div>
                <button
                    onClick={() => setSyncResult(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                    閉じる
                </button>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-4">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <h3 className="font-medium text-gray-900">データ同期中...</h3>
            </div>

            {progress.currentDate && (
                <p className="text-sm text-gray-600 mb-3">
                    現在処理中: {progress.currentDate}
                </p>
            )}

            {/* プログレスバー */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>進捗</span>
                    <span>{progress.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{progress.processedDays} / {progress.totalDays} 日完了</span>
                    <span>残り {progress.remainingDays} 日</span>
                </div>
            </div>

            {/* 推定残り時間 */}
            {progress.estimatedTimeRemaining && (
                <p className="text-sm text-gray-600 mb-3">
                    推定残り時間: {progress.estimatedTimeRemaining}
                </p>
            )}

            {/* 統計 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">
                        {progress.successfulImports}
                    </div>
                    <div className="text-xs text-gray-600">成功</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-red-600">
                        {progress.failedImports}
                    </div>
                    <div className="text-xs text-gray-600">失敗</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">
                        {progress.remainingDays}
                    </div>
                    <div className="text-xs text-gray-600">残り</div>
                </div>
            </div>

            {/* レート制限情報 */}
            {rateLimitInfo.isWaiting && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">{rateLimitInfo.message}</span>
                    </div>
                </div>
            )}

            <div className="text-xs text-gray-500">
                <p>• API制限を考慮して適切な間隔で処理しています</p>
                <p>• このページを閉じないでください</p>
            </div>
        </div>
    )
}