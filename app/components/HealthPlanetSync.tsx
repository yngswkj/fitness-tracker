'use client'

import { useState, useEffect } from 'react'
import { Scale, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Calendar } from 'lucide-react'
import HealthPlanetManualToken from './HealthPlanetManualToken'
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
        try {
            setConnecting(true)
            const response = await fetch('/api/healthplanet/auth')
            if (response.ok) {
                const data = await response.json()
                window.location.href = data.authUrl
            } else {
                alert('HealthPlanet認証URLの取得に失敗しました')
            }
        } catch (error) {
            console.error('Failed to get HealthPlanet auth URL:', error)
            alert('エラーが発生しました')
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

            {/* 接続状態 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                <div className="flex items-center">
                    {status.connected ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-gray-400 mr-3" />
                    )}
                    <div>
                        <p className="font-medium text-gray-900">
                            {status.connected ? '接続済み' : '未接続'}
                        </p>
                        {status.lastSync && (
                            <p className="text-sm text-gray-600">
                                最終同期: {new Date(status.lastSync).toLocaleString('ja-JP')}
                            </p>
                        )}
                        {status.tokenExpired && (
                            <p className="text-sm text-red-600">
                                トークンの有効期限が切れています
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex space-x-2">
                    {status.connected ? (
                        <>
                            <HealthPlanetSyncModal />
                            <button
                                onClick={handleDisconnect}
                                className="btn-secondary text-red-600 hover:text-red-700"
                            >
                                連携解除
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="btn-primary flex items-center"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                {connecting ? '接続中...' : 'HealthPlanetと連携'}
                            </button>
                            <HealthPlanetManualToken />
                        </>
                    )}
                </div>
            </div>

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