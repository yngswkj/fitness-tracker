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
}

export default function HealthPlanetSyncModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

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

        try {
            const response = await fetch('/api/healthplanet/sync-range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromDate: from, toDate: to })
            })

            const result = await response.json()

            if (response.ok) {
                setSyncResult({
                    success: true,
                    message: result.message,
                    summary: result.summary
                })
            } else {
                setSyncResult({
                    success: false,
                    message: result.error || '同期中にエラーが発生しました'
                })
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
                        <div className="text-center py-8">
                            <RefreshCw className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                            <h4 className="text-lg font-medium text-gray-900 mb-2">
                                HealthPlanetデータを同期中...
                            </h4>
                            <p className="text-gray-600 text-sm">
                                体重・体脂肪率データを取得しています
                            </p>
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