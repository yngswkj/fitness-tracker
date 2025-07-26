'use client'

import { useState } from 'react'
import { Scale, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react'

interface SyncResult {
    success: boolean
    message: string
    summary?: {
        totalDays: number
        processedDays: number
        successfulSyncs: number
        failedSyncs: number
        dataFound: number
        dateRangeAdjusted?: boolean
    }
    authError?: boolean
    authMessage?: string
    lastProcessedDate?: string
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

export default function HealthPlanetSyncModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
    const [authErrorReceived, setAuthErrorReceived] = useState(false)
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

    // デフォルトの同期期間を設定（過去30日）
    const setDefaultDates = () => {
        const today = new Date()
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

        setToDate(today.toISOString().split('T')[0])
        setFromDate(thirtyDaysAgo.toISOString().split('T')[0])
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
        setAuthErrorReceived(false)
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
    }

    const handleQuickSync = async (days: number) => {
        const today = new Date()
        const pastDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)

        await executeSync(
            pastDate.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        )
    }

    const handleCustomSync = async () => {
        if (!fromDate || !toDate) {
            alert('開始日と終了日を選択してください')
            return
        }

        await executeSync(fromDate, toDate)
    }

    const executeSync = async (from: string, to: string) => {
        setSyncing(true)
        setSyncResult(null)
        setAuthErrorReceived(false)
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

        try {
            const response = await fetch('/api/healthplanet/import-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: from,
                    endDate: to,
                    batchSize: 3
                })
            })

            if (!response.ok) {
                const error = await response.json()

                // 再認証が必要な場合
                if (error.error === 'HEALTHPLANET_REAUTH_REQUIRED') {
                    setSyncResult({
                        success: false,
                        message: error.message || 'HealthPlanetの再認証が必要です',
                        authError: true,
                        authMessage: error.message,
                        reauthTitle: error.title,
                        reauthInstructions: error.instructions,
                        actionUrl: error.actionUrl
                    })
                    return
                }

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
                                console.log('Received SSE event:', data.type, data)

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
                                } else if (data.type === 'auth_error') {
                                    // 認証エラーで処理中断
                                    console.log('Received auth_error event:', data)
                                    setAuthErrorReceived(true)
                                    setSyncResult({
                                        success: false,
                                        message: data.message,
                                        summary: {
                                            totalDays: data.totalDays,
                                            processedDays: data.processedDays,
                                            successfulSyncs: data.successfulImports,
                                            failedSyncs: data.failedImports,
                                            dataFound: data.successfulImports
                                        },
                                        authError: true,
                                        authMessage: data.message,
                                        reauthTitle: data.title,
                                        reauthInstructions: data.instructions,
                                        actionUrl: data.actionUrl,
                                        lastProcessedDate: data.lastProcessedDate
                                    })
                                    // auth_errorイベント受信後は処理を停止
                                    break
                                } else if (data.type === 'complete' && !authErrorReceived) {
                                    setSyncResult({
                                        success: true,
                                        message: `同期完了: ${data.summary.successfulImports}日成功, ${data.summary.failedImports}日失敗`,
                                        summary: {
                                            totalDays: data.summary.totalDays,
                                            processedDays: data.summary.processedDays,
                                            successfulSyncs: data.summary.successfulImports,
                                            failedSyncs: data.summary.failedImports,
                                            dataFound: data.summary.successfulImports,
                                            dateRangeAdjusted: data.dateRangeAdjusted
                                        }
                                    })
                                } else if (data.type === 'error' && !authErrorReceived) {
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
            console.error('HealthPlanet sync error:', error)
            setSyncResult({
                success: false,
                message: '同期中にエラーが発生しました'
            })
        } finally {
            setSyncing(false)
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
                <RefreshCw className="w-4 h-4" />
                HealthPlanetデータ同期
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Scale className="w-5 h-5 text-green-600" />
                            HealthPlanetデータ同期
                        </h3>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <RefreshCw className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-green-800">
                                <p className="font-medium mb-1">同期について</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>未取得またはweightがNULLの日付を対象に同期</li>
                                    <li>体重と体脂肪率データを取得します</li>
                                    <li>期間は最大3ヶ月まで（自動調整）</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {!syncing && !syncResult && (
                        <>
                            {/* クイック同期 */}
                            <div className="mb-6">
                                <p className="text-sm font-medium text-gray-700 mb-3">クイック同期</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => handleQuickSync(7)}
                                        className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                    >
                                        過去7日
                                    </button>
                                    <button
                                        onClick={() => handleQuickSync(30)}
                                        className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                    >
                                        過去30日
                                    </button>
                                    <button
                                        onClick={() => handleQuickSync(90)}
                                        className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                    >
                                        過去90日
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
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">終了日</label>
                                            <input
                                                type="date"
                                                value={toDate}
                                                onChange={(e) => setToDate(e.target.value)}
                                                max={new Date().toISOString().split('T')[0]}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCustomSync}
                                        disabled={!fromDate || !toDate}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <RefreshCw className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    HealthPlanetデータを同期中...
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
                                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
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

                            <div className="text-xs text-gray-500 text-center">
                                <p>体重・体脂肪率データを取得しています</p>
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
                                            <span className="text-gray-600">データ取得:</span>
                                            <span className="ml-2 font-medium">{syncResult.summary.dataFound}件</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {syncResult.authError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <h5 className="font-medium text-red-900 mb-2">
                                                {syncResult.reauthTitle || 'HealthPlanetの再認証が必要です'}
                                            </h5>
                                            <p className="text-sm text-red-800 mb-3">
                                                {syncResult.authMessage || 'HealthPlanetのアクセストークンが無効になったため、データ同期を継続できません。以下の手順で再認証を行ってください。'}
                                            </p>

                                            {syncResult.reauthInstructions && (
                                                <div className="mb-4">
                                                    <p className="text-sm font-medium text-red-900 mb-2">解決手順:</p>
                                                    <ol className="text-sm text-red-800 space-y-1">
                                                        {syncResult.reauthInstructions.map((instruction, index) => (
                                                            <li key={index} className="flex items-start">
                                                                <span className="inline-block w-4 text-red-600 font-medium">
                                                                    {index + 1}.
                                                                </span>
                                                                <span className="ml-1">{instruction.replace(/^\d+\.\s*/, '')}</span>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}

                                            {syncResult.summary && (
                                                <div className="grid grid-cols-2 gap-4 text-sm mb-4 p-3 bg-red-100 rounded-lg">
                                                    <div>
                                                        <span className="text-red-700">処理済み:</span>
                                                        <span className="ml-2 font-medium text-red-900">{syncResult.summary.processedDays}日</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-red-700">最後の処理日:</span>
                                                        <span className="ml-2 font-medium text-red-900">{syncResult.lastProcessedDate}</span>
                                                    </div>
                                                </div>
                                            )}

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

                            {syncResult.summary?.dateRangeAdjusted && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                                        <div>
                                            <h5 className="font-medium text-yellow-900 mb-1">期間調整</h5>
                                            <p className="text-sm text-yellow-800">
                                                指定期間が3ヶ月を超えるため、自動的に3ヶ月以内に調整されました。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
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