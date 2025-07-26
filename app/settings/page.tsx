'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, CheckCircle, AlertCircle, ExternalLink, Scale, Settings } from 'lucide-react'
import PageLayout from '../components/PageLayout'

import FitbitSyncModal from '../components/FitbitSyncModal'
import HealthPlanetSync from '../components/HealthPlanetSync'
import HealthPlanetSyncModal from '../components/HealthPlanetSyncModal'

interface FitbitStatus {
    connected: boolean
    lastSync?: string
    error?: string
}

export default function SettingsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [fitbitStatus, setFitbitStatus] = useState<FitbitStatus>({ connected: false })
    const [loading, setLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)

    const checkFitbitStatus = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/fitbit/status')
            if (response.ok) {
                const data = await response.json()
                setFitbitStatus(data)
            }
        } catch (error) {
            console.error('Failed to check Fitbit status:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (status === 'authenticated') {
            checkFitbitStatus()
        }
    }, [status])

    useEffect(() => {
        // URLパラメータからメッセージを表示
        const success = searchParams.get('success')
        const error = searchParams.get('error')

        if (success === 'fitbit_connected') {
            alert('Fitbitアカウントが正常に連携されました！')
            checkFitbitStatus()
        } else if (success === 'healthplanet_connected') {
            alert('HealthPlanetアカウントが正常に連携されました！')
        } else if (error) {
            const errorMessages: Record<string, string> = {
                // Fitbitエラー
                fitbit_auth_failed: 'Fitbit認証に失敗しました',
                // HealthPlanetエラー
                healthplanet_auth_failed: 'HealthPlanet認証に失敗しました',
                // 共通エラー
                missing_code: '認証コードが見つかりません',
                invalid_state: '無効な認証状態です',
                expired_state: '認証セッションの有効期限が切れました',
                token_exchange_failed: 'トークン交換に失敗しました',
                callback_failed: 'コールバック処理に失敗しました',
                server_config_error: 'サーバー設定エラーです'
            }
            alert(errorMessages[error] || 'エラーが発生しました')
        }
    }, [searchParams])

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">読み込み中...</p>
                </div>
            </div>
        )
    }

    if (status === 'unauthenticated') {
        router.push('/auth/signin')
        return null
    }

    const handleConnectFitbit = async () => {
        try {
            setConnecting(true)
            const response = await fetch('/api/fitbit/auth')
            if (response.ok) {
                const data = await response.json()
                window.location.href = data.authUrl
            } else {
                alert('Fitbit認証URLの取得に失敗しました')
            }
        } catch (error) {
            console.error('Failed to get Fitbit auth URL:', error)
            alert('エラーが発生しました')
        } finally {
            setConnecting(false)
        }
    }

    const handleDisconnectFitbit = async () => {
        if (!confirm('Fitbitアカウントの連携を解除しますか？')) return

        try {
            const response = await fetch('/api/fitbit/disconnect', {
                method: 'POST'
            })

            if (response.ok) {
                setFitbitStatus({ connected: false })
                alert('Fitbitアカウントの連携を解除しました')
            } else {
                alert('連携解除に失敗しました')
            }
        } catch (error) {
            console.error('Failed to disconnect Fitbit:', error)
            alert('エラーが発生しました')
        }
    }

    const handleSyncNow = async () => {
        try {
            const response = await fetch('/api/fitbit/sync', {
                method: 'POST'
            })

            if (response.ok) {
                alert('データ同期を開始しました')
                checkFitbitStatus()
            } else {
                alert('同期の開始に失敗しました')
            }
        } catch (error) {
            console.error('Failed to sync Fitbit data:', error)
            alert('エラーが発生しました')
        }
    }

    return (
        <PageLayout
            title="設定"
            description="アカウントとデバイス連携の設定"
            icon={Settings}
        >
            {/* Fitbit連携設定 */}
            <div className="card mb-8">
                <div className="flex items-center mb-6">
                    <Activity className="h-6 w-6 text-primary-600 mr-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Fitbit連携</h2>
                </div>

                {loading ? (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">状態を確認中...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 再認証が必要な場合の通知 */}
                        {fitbitStatus.error && fitbitStatus.error.includes('認証') && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-red-900 mb-2">Fitbitの再認証が必要です</h4>
                                        <p className="text-sm text-red-800 mb-3">
                                            Fitbitのアクセストークンが無効になったため、データ同期ができません。
                                            以下の手順で再認証を行ってください。
                                        </p>

                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-red-900 mb-2">解決手順:</p>
                                            <ol className="text-sm text-red-800 space-y-1">
                                                <li className="flex items-start">
                                                    <span className="inline-block w-4 text-red-600 font-medium">1.</span>
                                                    <span className="ml-1">下の「Fitbitと連携」ボタンをクリック</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className="inline-block w-4 text-red-600 font-medium">2.</span>
                                                    <span className="ml-1">Fitbitサイトでログインして認証を許可</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className="inline-block w-4 text-red-600 font-medium">3.</span>
                                                    <span className="ml-1">認証完了後、データ同期が再開されます</span>
                                                </li>
                                            </ol>
                                        </div>

                                        <div className="bg-red-100 rounded-lg p-3">
                                            <p className="text-xs text-red-700">
                                                <strong>注意:</strong> 再認証が完了するまで、Fitbitデータの同期は停止されます。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 接続状態 */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                                {fitbitStatus.connected ? (
                                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-gray-400 mr-3" />
                                )}
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {fitbitStatus.connected ? '接続済み' : '未接続'}
                                    </p>
                                    {fitbitStatus.lastSync && (
                                        <p className="text-sm text-gray-600">
                                            最終同期: {new Date(fitbitStatus.lastSync).toLocaleString('ja-JP')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex space-x-2">
                                {fitbitStatus.connected ? (
                                    <>
                                        <FitbitSyncModal />
                                        <button
                                            onClick={handleDisconnectFitbit}
                                            className="btn-secondary text-red-600 hover:text-red-700 text-sm whitespace-nowrap"
                                        >
                                            解除
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleConnectFitbit}
                                        disabled={connecting}
                                        className="btn-primary flex items-center text-sm whitespace-nowrap"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                                        {connecting ? '接続中...' : (
                                            <>
                                                <span className="hidden sm:inline">Fitbitと連携</span>
                                                <span className="sm:hidden">FB連携</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>



                        {/* 説明 */}
                        <div className="text-sm text-gray-600">
                            <p className="mb-2">
                                Fitbitアカウントと連携することで、以下のデータを自動で取得できます：
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li>歩数・移動距離・消費カロリー</li>
                                <li>心拍数・安静時心拍数</li>
                                <li>睡眠時間・睡眠効率</li>
                                <li>体重・体脂肪率（対応デバイスのみ）</li>
                            </ul>
                        </div>

                        {fitbitStatus.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{fitbitStatus.error}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* HealthPlanet連携設定 */}
            <div className="mb-8">
                <HealthPlanetSync />
            </div>

            {/* その他の設定 */}
            <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">アカウント設定</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">ユーザー名</p>
                            <p className="text-sm text-gray-600">{session?.user?.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-900">メールアドレス</p>
                            <p className="text-sm text-gray-600">{session?.user?.email}</p>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    )
}