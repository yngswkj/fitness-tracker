'use client'

import { useState } from 'react'
import { Activity, RefreshCw, AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react'

interface SyncResult {
    success: boolean
    message: string
    summary?: {
        totalDays: number
        processedDays: number
        successfulSyncs: number
        failedSyncs: number
        rateLimitHit?: boolean
    }
    rateLimitError?: boolean
    reauthRequired?: boolean
    reauthTitle?: string
    reauthInstructions?: string[]
    actionUrl?: string
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

export default function FitbitSyncModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
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

    // デフォルトの同期期間を設定（過去7日）
    const setDefaultDates = () => {
        const today = new Date()
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000) // 前日まで
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

        setToDate(yesterday.toISOString().split('T')[0])
        setFromDate(sevenDaysAgo.toISOString().split('T')[0])
    }

    const handleOpen = () => {
        setIsOpen(true)
        setDefaultDates()
        setSyncResult(null)
    }

    const handleClose = () => {
        setIsOpen(false)
        setSyncing(false)
        setSyncResult(null)
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
    }

    const handleQuickSync = async (days: number) => {
        const today = new Date()
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000) // 前日まで
        const pastDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)

        await executeSync(
            pastDate.toISOString().split('T')[0],
            yesterday.toISOString().split('T')[0]
        )
    }

    const handleCustomSync = async () => {
        if (!fromDate || !toDate) {
            alert('開始日と終了日を選択してください')
            return
        }

        // 今日より前の日付かチェック
        const today = new Date().toISOString().split('T')[0]
        if (toDate >= today) {
            alert('終了日は前日以前を選択してください')
            return
        }

        await executeSync(fromDate, toDate)
    }

    const executeSync = async (from: string, to: string) => {
        setSyncing(true)
        setSyncResult(null)
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

        try {
            const response = await fetch('/api/fitbit/import-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: from,
                    endDate: to,
                    dataTypes: ['activity', 'heart', 'sleep', 'body'],
                    overwriteExisting: true,
                    batchSize: 3
                })
            })

            if (!response.ok) {
                const error = await response.json()

                // 再認証が必要な場合
                if (error.error === 'FITBIT_REAUTH_REQUIRED') {
                    setSyncResult({
                        success: false,
                        message: error.message || 'Fitbitの再認証が必要です',
                        rateLimitError: false,
                        reauthRequired: true,
                        reauthTitle: error.title,
                        reauthInstructions: error.instructions,
                        actionUrl: error.actionUrl
                    })
                    return
                }

                setSyncResult({
                    success: false,
                    message: `同期エラー: ${error.error}`,
                    rateLimitError: false
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
                                        message: `同期完了: ${data.summary.successfulImports}日成功, ${data.summary.failedImports}日失敗`,
                                        summary: {
                                            totalDays: data.summary.totalDays,
                                            processedDays: data.summary.processedDays,
                                            successfulSyncs: data.summary.successfulImports,
                                            failedSyncs: data.summary.failedImports
                                        },
                                        rateLimitError: false
                                    })
                                } else if (data.type === 'error') {
                                    setSyncResult({
                                        success: false,
                                        message: `同期エラー: ${data.error}`,
                                        rateLimitError: false
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
            console.error('Fitbit sync error:', error)
            setSyncResult({
                success: false,
                message: '同期中にエラーが発生しました',
                rateLimitError: false
            })
        } finally {
            setSyncing(false)
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
            >
                <RefreshCw className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">データ同期・インポート</span>
                <span className="sm:hidden">同期</span>
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md md:max-w-lg lg:max-w-xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Fitbitデータ同期・インポート
                        </h3>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">データ同期について</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>未取得またはデータが不完全な日付を対象に同期</li>
                                    <li>前日までのデータのみ取得可能</li>
                                    <li>長期間（最大1年）のデータ同期に対応</li>
                                    <li>API制限時は処理を中断し、取得済みデータを保存</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {!syncing && !syncResult && (
                        <>
                            {/* クイック同期 */}
                            <div className="mb-6">
                                <p className="text-sm font-medium text-gray-700 mb-3">クイック同期</p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <button
                                        onClick={() => handleQuickSync(7)}
                                        className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        過去7日
                                    </button>
                                    <button
                                        onClick={() => handleQuickSync(30)}
                                        className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        過去30日
                                    </button>
                                    <button
                                        onClick={() => handleQuickSync(90)}
                                        className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        過去90日
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleQuickSync(180)}
                                        className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        過去6ヶ月
                                    </button>
                                    <button
                                        onClick={() => handleQuickSync(365)}
                                        className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                    >
                                        過去1年
                                    </button>
                                </div>
                            </div>

                            {/* カスタム期間 */}
                            <div className="mb-6">
                                <p className="text-sm font-medium text-gray-700 mb-3">カスタム期間</p>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">開始日</label>
                                            <input
                                                type="date"
                                                value={fromDate}
                                                onChange={(e) => setFromDate(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">終了日</label>
                                            <input
                                                type="date"
                                                value={toDate}
                                                onChange={(e) => setToDate(e.target.value)}
                                                max={new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCustomSync}
                                        disabled={!fromDate || !toDate}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        同期実行
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* 同期中表示 */}
                    {syncing && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    Fitbitデータを同期中...
                                </h4>
                                {progress.currentDate && (
                                    <p className="text-gray-600 text-sm mb-2">
                                        現在処理中: {progress.currentDate}
                                    </p>
                                )}
                                {progress.estimatedTimeRemaining && (
                                    <p className="text-sm text-gray-500">
                                        推定残り時間: {progress.estimatedTimeRemaining}
                                    </p>
                                )}
                            </div>

                            {/* プログレスバー */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                                    <span>進捗</span>
                                    <span>{progress.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{progress.processedDays} / {progress.totalDays} 日完了</span>
                                    <span>残り {progress.remainingDays} 日</span>
                                </div>
                            </div>

                            {/* 統計 */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-2 bg-green-50 rounded-lg">
                                    <div className="text-lg font-semibold text-green-600">
                                        {progress.successfulImports}
                                    </div>
                                    <div className="text-xs text-gray-600">成功</div>
                                </div>
                                <div className="text-center p-2 bg-red-50 rounded-lg">
                                    <div className="text-lg font-semibold text-red-600">
                                        {progress.failedImports}
                                    </div>
                                    <div className="text-xs text-gray-600">失敗</div>
                                </div>
                                <div className="text-center p-2 bg-blue-50 rounded-lg">
                                    <div className="text-lg font-semibold text-blue-600">
                                        {progress.remainingDays}
                                    </div>
                                    <div className="text-xs text-gray-600">残り</div>
                                </div>
                            </div>

                            {/* レート制限情報 */}
                            {rateLimitInfo.isWaiting && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-yellow-600" />
                                        <span className="text-sm text-yellow-800">{rateLimitInfo.message}</span>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-gray-500 text-center">
                                <p>レート制限を考慮して処理しています</p>
                            </div>
                        </div>
                    )}

                    {/* 同期結果表示 */}
                    {syncResult && (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-lg ${syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                }`}>
                                <div className="flex items-start gap-3">
                                    {syncResult.success ? (
                                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                    )}
                                    <div>
                                        <h4 className={`font-medium ${syncResult.success ? 'text-green-900' : 'text-red-900'
                                            }`}>
                                            {syncResult.success ? '同期完了' : '同期エラー'}
                                        </h4>
                                        <p className={`text-sm ${syncResult.success ? 'text-green-800' : 'text-red-800'
                                            }`}>
                                            {syncResult.message}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {syncResult.summary && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h5 className="font-medium text-gray-900 mb-2">同期結果</h5>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">処理日数:</span>
                                            <span className="ml-2 font-medium">{syncResult.summary.processedDays}日</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">成功:</span>
                                            <span className="ml-2 font-medium text-green-600">{syncResult.summary.successfulSyncs}日</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">失敗:</span>
                                            <span className="ml-2 font-medium text-red-600">{syncResult.summary.failedSyncs}日</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">総日数:</span>
                                            <span className="ml-2 font-medium">{syncResult.summary.totalDays}日</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {syncResult.reauthRequired && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <h5 className="font-medium text-red-900 mb-2">
                                                Fitbitの再認証が必要です
                                            </h5>
                                            <p className="text-sm text-red-800 mb-3">
                                                Fitbitのアクセストークンが無効になったため、データ同期を継続できません。
                                                以下の手順で再認証を行ってください。
                                            </p>

                                            <div className="mb-4">
                                                <p className="text-sm font-medium text-red-900 mb-2">解決手順:</p>
                                                <ol className="text-sm text-red-800 space-y-1">
                                                    <li className="flex items-start">
                                                        <span className="inline-block w-4 text-red-600 font-medium">1.</span>
                                                        <span className="ml-1">下の「設定ページへ」ボタンをクリック</span>
                                                    </li>
                                                    <li className="flex items-start">
                                                        <span className="inline-block w-4 text-red-600 font-medium">2.</span>
                                                        <span className="ml-1">Fitbit連携セクションを確認</span>
                                                    </li>
                                                    <li className="flex items-start">
                                                        <span className="inline-block w-4 text-red-600 font-medium">3.</span>
                                                        <span className="ml-1">「Fitbitと連携」ボタンをクリック</span>
                                                    </li>
                                                    <li className="flex items-start">
                                                        <span className="inline-block w-4 text-red-600 font-medium">4.</span>
                                                        <span className="ml-1">Fitbitサイトでログインして認証を完了</span>
                                                    </li>
                                                    <li className="flex items-start">
                                                        <span className="inline-block w-4 text-red-600 font-medium">5.</span>
                                                        <span className="ml-1">認証完了後、再度データ同期を実行</span>
                                                    </li>
                                                </ol>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => window.location.href = syncResult.actionUrl || '/settings'}
                                                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 font-medium"
                                                >
                                                    設定ページへ
                                                </button>
                                                <button
                                                    onClick={handleClose}
                                                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                                                >
                                                    後で
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {syncResult.rateLimitError && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                                        <div>
                                            <h5 className="font-medium text-yellow-900 mb-1">レート制限に到達</h5>
                                            <p className="text-sm text-yellow-800 mb-2">
                                                Fitbit APIのレート制限に到達したため、処理を中断しました。
                                                取得済みのデータは保存されています。
                                            </p>
                                            <p className="text-sm text-yellow-800 font-medium">
                                                1時間後に再度同期を実行してください。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    完了
                                </button>
                            </div>
                        </div>
                    )}

                    {!syncing && !syncResult && (
                        <div className="flex items-center justify-end">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                キャンセル
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}