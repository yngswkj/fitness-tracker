'use client'

import { useState } from 'react'
import { Key, CheckCircle, AlertCircle } from 'lucide-react'

export default function HealthPlanetManualToken() {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        access_token: '',
        refresh_token: '',
        expires_in: '2592000' // 30日 = 30 * 24 * 60 * 60
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.access_token || !formData.refresh_token) {
            alert('アクセストークンとリフレッシュトークンを入力してください')
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/healthplanet/manual-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_token: formData.access_token,
                    refresh_token: formData.refresh_token,
                    expires_in: parseInt(formData.expires_in)
                })
            })

            if (response.ok) {
                const result = await response.json()
                alert(`トークン登録成功！\n有効期限: ${new Date(result.data.expiresAt).toLocaleString('ja-JP')}\n有効期間: ${result.data.expiresInDays}日`)
                setFormData({
                    access_token: '',
                    refresh_token: '',
                    expires_in: '2592000'
                })
                setIsOpen(false)
                // ページをリロードして状態を更新
                window.location.reload()
            } else {
                const error = await response.json()
                alert(`エラー: ${error.error}`)
            }
        } catch (error) {
            console.error('Token registration error:', error)
            alert('トークン登録中にエラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
            >
                <Key className="w-4 h-4" />
                手動トークン登録
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Key className="w-5 h-5 text-yellow-600" />
                            HealthPlanet手動トークン登録
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-yellow-800">
                                <p className="font-medium mb-1">注意事項</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>手動で取得したHealthPlanetのトークンを登録します</li>
                                    <li>トークンは安全に保存され、暗号化されます</li>
                                    <li>有効期限が切れた場合は再登録が必要です</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                アクセストークン
                            </label>
                            <textarea
                                value={formData.access_token}
                                onChange={(e) => handleInputChange('access_token', e.target.value)}
                                placeholder="1753104087505/8QhweSPJJKUbzu0T4oYRkbRACDFD1GTcFdM7EWec"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                rows={3}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                リフレッシュトークン
                            </label>
                            <textarea
                                value={formData.refresh_token}
                                onChange={(e) => handleInputChange('refresh_token', e.target.value)}
                                placeholder="1753104087505/V2hF9JDpoK7eBAOT6mh2eS6lYDYdlrzYdut8FXgg"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                rows={3}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                有効期限（秒）
                            </label>
                            <input
                                type="number"
                                value={formData.expires_in}
                                onChange={(e) => handleInputChange('expires_in', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                デフォルト: 2592000秒（30日）
                            </p>
                        </div>

                        <div className="flex items-center justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        登録中...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        トークン登録
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}