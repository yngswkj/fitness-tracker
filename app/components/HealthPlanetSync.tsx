'use client'

import { useState, useEffect } from 'react'
import { Scale, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Calendar } from 'lucide-react'
// import HealthPlanetManualToken from './HealthPlanetManualToken' // OAuth2フローに統一のため削除
import HealthPlanetSyncModal from './HealthPlanetSyncModal'

interface HealthPlanetStatus {
    connected: boolean
    tokenExpired?: boolean
    expiresAt?: string
    lastSync?: string
    summary?: {
        daysWithWeight: number
        daysWithBodyFat: number
        averageWeight: number | null
        averageBodyFat: number | null
    }
}

export default function HealthPlanetSync() {
    const [status, setStatus] = useState<HealthPlanetStatus>({ connected: false })
    const [loading, setLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)
    const [showDevCodeInput, setShowDevCodeInput] = useState(false)
    const [devAuthData, setDevAuthData] = useState<any>(null)
    const [devCode, setDevCode] = useState('')
    const [devCodeSubmitting, setDevCodeSubmitting] = useState(false)
    useEffect(() => {
        checkStatus()
    }, [])

    const checkStatus = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/healthplanet/status')
            if (response.ok) {
                const data = await response.json()
                setStatus(data)
            }
        } catch (error) {
            console.error('Failed to check HealthPlanet status:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleConnect = async () => {
        setConnecting(true)
        try {
            const response = await fetch('/api/healthplanet/auth')
            if (!response.ok) {
                throw new Error('認証リクエストに失敗しました')
            }
            const data = await response.json()

            // 開発環境の場合は手動コード入力UIを表示
            if (data.isDevelopment && data.manualCodeRequired) {
                setDevAuthData(data)
                setShowDevCodeInput(true)
                // 新しいタブで認証URLを開く
                window.open(data.authUrl, '_blank')
            } else {
                // 本番環境では通常のリダイレクト
                window.location.href = data.authUrl || '/api/healthplanet/auth'
            }
        } catch (error) {
            console.error('Connection error:', error)
            alert('接続に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'))
        } finally {
            setConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        if (!confirm('HealthPlanetアカウントの連携を解除しますか？')) return

        try {
            const response = await fetch('/api/healthplanet/disconnect', {
                method: 'POST'
            })

            if (response.ok) {
                setStatus({ connected: false })
                alert('HealthPlanetアカウントの連携を解除しました')
            } else {
                alert('連携解除に失敗しました')
            }
        } catch (error) {
            console.error('Failed to disconnect HealthPlanet:', error)
            alert('エラーが発生しました')
        }
    }

    const handleDevCodeSubmit = async () => {
        if (!devCode.trim() || !devAuthData) return

        setDevCodeSubmitting(true)
        try {
            const response = await fetch('/api/healthplanet/manual-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: devCode.trim(),
                    state: devAuthData.state
                })
            })

            const result = await response.json()

            if (response.ok) {
                alert('HealthPlanet連携が完了しました！')
                setShowDevCodeInput(false)
                setDevCode('')
                setDevAuthData(null)
                // ステータスを更新
                checkStatus()
            } else {
                console.error('Manual code submission failed:', result)
                let errorMessage = result.error || '不明なエラー'

                // デバッグ情報があれば表示
                if (result.debug_info) {
                    console.log('Debug info:', result.debug_info)
                }

                // より詳細なエラーメッセージ
                if (result.error === 'invalid_grant' || result.details?.includes('invalid_grant')) {
                    errorMessage = '認証コードが無効または期限切れです。新しいコードを取得してください。'
                }

                alert('連携に失敗しました: ' + errorMessage)
            }
        } catch (error) {
            console.error('Dev code submit error:', error)
            alert('連携に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'))
        } finally {
            setDevCodeSubmitting(false)
        }
    }



    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600">読み込み中...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
                <Scale className="h-6 w-6 text-green-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">HealthPlanet連携</h2>
            </div>

            {/* トークン期限切れの通知 */}
            {status.connected && status.tokenExpired && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h4 className="font-medium text-red-900 mb-2">HealthPlanetの再認証が必要です</h4>
                            <p className="text-sm text-red-800 mb-3">
                                HealthPlanetのアクセストークンの有効期限が切れたため、データ同期ができません。
                                以下の手順で再認証を行ってください。
                            </p>

                            <div className="mb-4">
                                <p className="text-sm font-medium text-red-900 mb-2">解決手順:</p>
                                <ol className="text-sm text-red-800 space-y-1">
                                    <li className="flex items-start">
                                        <span className="inline-block w-4 text-red-600 font-medium">1.</span>
                                        <span className="ml-1">下の「HealthPlanetと連携」ボタンをクリック</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="inline-block w-4 text-red-600 font-medium">2.</span>
                                        <span className="ml-1">HealthPlanetサイトでログインして認証を許可</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="inline-block w-4 text-red-600 font-medium">3.</span>
                                        <span className="ml-1">認証完了後、データ同期が再開されます</span>
                                    </li>
                                </ol>
                            </div>

                            <div className="bg-red-100 rounded-lg p-3">
                                <p className="text-xs text-red-700">
                                    <strong>注意:</strong> 再認証が完了するまで、HealthPlanetデータの同期は停止されます。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 接続状態 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                <div className="flex items-center">
                    {status.connected && !status.tokenExpired ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    ) : status.connected && status.tokenExpired ? (
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-gray-400 mr-3" />
                    )}
                    <div>
                        <p className="font-medium text-gray-900">
                            {status.connected && !status.tokenExpired ? '接続済み' :
                                status.connected && status.tokenExpired ? '再認証が必要' : '未接続'}
                        </p>
                        {status.lastSync && (
                            <p className="text-sm text-gray-600">
                                最終同期: {new Date(status.lastSync).toLocaleString('ja-JP')}
                            </p>
                        )}
                        {status.expiresAt && !status.tokenExpired && (
                            <p className="text-sm text-gray-600">
                                有効期限: {new Date(status.expiresAt).toLocaleString('ja-JP')}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex space-x-2">
                    {status.connected && !status.tokenExpired ? (
                        <>
                            <HealthPlanetSyncModal />
                            <button
                                onClick={handleDisconnect}
                                className="btn-secondary text-red-600 hover:text-red-700 text-sm whitespace-nowrap"
                            >
                                解除
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="btn-primary flex items-center text-sm whitespace-nowrap"
                            >
                                <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                                {connecting ? '接続中...' : (
                                    <>
                                        <span className="hidden sm:inline">HealthPlanetと連携</span>
                                        <span className="sm:hidden">HP連携</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 開発環境用: 手動コード入力UI */}
            {showDevCodeInput && devAuthData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-blue-900 mb-2">開発環境用: 手動コード入力</h4>
                    <p className="text-sm text-blue-800 mb-3">
                        認証が完了したら、ブラウザのURL末尾に表示されるcode=の値をコピーして入力してください
                    </p>
                    {devAuthData.instructions && (
                        <div className="mb-3">
                            <p className="text-sm font-medium text-blue-900 mb-1">手順:</p>
                            <ol className="text-sm text-blue-800 space-y-1">
                                {devAuthData.instructions.map((instruction: string, index: number) => (
                                    <li key={index} className="flex items-start">
                                        <span className="inline-block w-4 text-blue-600 font-medium">
                                            {index + 1}.
                                        </span>
                                        <span className="ml-1">{instruction}</span>
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="text-xs text-yellow-800">
                                    <strong>重要:</strong> 認証コードは短時間で期限切れになります。認証完了後、すぐにコードを入力してください。
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={devCode}
                            onChange={(e) => setDevCode(e.target.value.trim())}
                            placeholder="認証コードを入力... (例: abcd1234efgh5678)"
                            className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            onPaste={(e) => {
                                // ペースト時も自動でトリム
                                const pastedText = e.clipboardData.getData('text').trim()
                                setDevCode(pastedText)
                                e.preventDefault()
                            }}
                        />
                        <button
                            onClick={handleDevCodeSubmit}
                            disabled={!devCode.trim() || devCodeSubmitting}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {devCodeSubmitting ? '処理中...' : '連携完了'}
                        </button>
                        <button
                            onClick={() => {
                                setShowDevCodeInput(false)
                                setDevCode('')
                                setDevAuthData(null)
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            {/* データサマリー */}
            {status.connected && status.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">{status.summary.daysWithWeight}</div>
                        <div className="text-xs text-blue-800">体重データ</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-600">{status.summary.daysWithBodyFat}</div>
                        <div className="text-xs text-green-800">体脂肪率データ</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">
                            {status.summary.averageWeight ? `${status.summary.averageWeight}kg` : '-'}
                        </div>
                        <div className="text-xs text-purple-800">平均体重</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-lg font-bold text-orange-600">
                            {status.summary.averageBodyFat ? `${status.summary.averageBodyFat}%` : '-'}
                        </div>
                        <div className="text-xs text-orange-800">平均体脂肪率</div>
                    </div>
                </div>
            )}



            {/* 説明 */}
            <div className="text-sm text-gray-600 mt-4">
                <p className="mb-2">
                    HealthPlanetアカウントと連携することで、以下のデータを取得できます：
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>体重データ</li>
                    <li>体脂肪率</li>
                    <li>筋肉量（対応機器のみ）</li>
                    <li>内臓脂肪レベル（対応機器のみ）</li>
                </ul>
            </div>
        </div>
    )
}