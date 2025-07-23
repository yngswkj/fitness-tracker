'use client'

import { useState } from 'react'
import { Calendar, Download, AlertCircle, CheckCircle, Clock, RefreshCw, Settings } from 'lucide-react'

interface ImportPlan {
    totalDays: number
    newDays: number
    duplicateDays: number
    startDate: string
    endDate: string
    dataTypes: string[]
    newDates: string[]
    duplicateDates: string[]
}

interface ImportResult {
    success: boolean
    summary: {
        totalDays: number
        processedDays: number
        successfulImports: number
        failedImports: number
        startDate: string
        endDate: string
        dataTypes: string[]
        overwriteExisting: boolean
    }
    results: Array<{
        date: string
        success: boolean
        error?: string
        data?: any
    }>
}

export default function FitbitHistoryImport() {
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState<'setup' | 'preview' | 'importing' | 'complete'>('setup')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [dataTypes, setDataTypes] = useState(['activity', 'heart', 'sleep', 'body'])
    const [overwriteExisting, setOverwriteExisting] = useState(false)
    const [importPlan, setImportPlan] = useState<ImportPlan | null>(null)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(0)

    const dataTypeLabels = {
        activity: '活動データ（歩数、カロリー、距離）',
        heart: '心拍数データ',
        sleep: '睡眠データ',
        body: '体重・体組成データ'
    }

    const presetPeriods = [
        { label: '過去30日', days: 30 },
        { label: '過去90日', days: 90 },
        { label: '過去1年', days: 365 }
    ]

    const handlePresetPeriod = (days: number) => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - days)

        setEndDate(end.toISOString().split('T')[0])
        setStartDate(start.toISOString().split('T')[0])
    }

    const handlePrepareImport = async () => {
        if (!startDate || !endDate) {
            alert('開始日と終了日を選択してください')
            return
        }

        if (dataTypes.length === 0) {
            alert('少なくとも1つのデータタイプを選択してください')
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/fitbit/import-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    dataTypes
                })
            })

            if (response.ok) {
                const result = await response.json()
                setImportPlan(result.importPlan)
                setStep('preview')
            } else {
                const error = await response.json()
                alert(`エラー: ${error.error}`)
            }
        } catch (error) {
            console.error('Import preparation error:', error)
            alert('インポート準備中にエラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    const handleExecuteImport = async () => {
        if (!importPlan) return

        setLoading(true)
        setStep('importing')
        setProgress(0)

        try {
            const response = await fetch('/api/fitbit/import-history', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: importPlan.startDate,
                    endDate: importPlan.endDate,
                    dataTypes: importPlan.dataTypes,
                    overwriteExisting,
                    batchSize: 10
                })
            })

            if (response.ok) {
                const result = await response.json()
                setImportResult(result)
                setStep('complete')
            } else {
                const error = await response.json()
                alert(`インポートエラー: ${error.error}`)
                setStep('preview')
            }
        } catch (error) {
            console.error('Import execution error:', error)
            alert('インポート実行中にエラーが発生しました')
            setStep('preview')
        } finally {
            setLoading(false)
            setProgress(0)
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setStep('setup')
        setImportPlan(null)
        setImportResult(null)
        setProgress(0)
    }

    const handleDataTypeChange = (type: string, checked: boolean) => {
        if (checked) {
            setDataTypes([...dataTypes, type])
        } else {
            setDataTypes(dataTypes.filter(t => t !== type))
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                <Download className="w-4 h-4" />
                履歴データインポート
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <Download className="w-5 h-5" />
                            Fitbit履歴データインポート
                        </h2>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>

                    {/* ステップインジケーター */}
                    <div className="flex items-center mb-8">
                        {['setup', 'preview', 'importing', 'complete'].map((s, index) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-blue-600 text-white' :
                                        ['preview', 'importing', 'complete'].includes(step) && index < ['setup', 'preview', 'importing', 'complete'].indexOf(step) ? 'bg-green-600 text-white' :
                                            'bg-gray-200 text-gray-600'
                                    }`}>
                                    {index + 1}
                                </div>
                                {index < 3 && (
                                    <div className={`w-12 h-0.5 mx-2 ${['preview', 'importing', 'complete'].includes(step) && index < ['setup', 'preview', 'importing', 'complete'].indexOf(step) ? 'bg-green-600' : 'bg-gray-200'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* セットアップステップ */}
                    {step === 'setup' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    インポート期間
                                </label>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {presetPeriods.map(preset => (
                                        <button
                                            key={preset.days}
                                            onClick={() => handlePresetPeriod(preset.days)}
                                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">開始日</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">終了日</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    インポートするデータタイプ
                                </label>
                                <div className="space-y-2">
                                    {Object.entries(dataTypeLabels).map(([type, label]) => (
                                        <label key={type} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={dataTypes.includes(type)}
                                                onChange={(e) => handleDataTypeChange(type, e.target.checked)}
                                                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <span className="text-sm text-gray-700">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handlePrepareImport}
                                    disabled={loading || !startDate || !endDate || dataTypes.length === 0}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    次へ
                                </button>
                            </div>
                        </div>
                    )}

                    {/* プレビューステップ */}
                    {step === 'preview' && importPlan && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="font-medium text-blue-900 mb-2">インポート概要</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-blue-700">期間:</span>
                                        <span className="ml-2 text-blue-900">
                                            {importPlan.startDate} 〜 {importPlan.endDate}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">総日数:</span>
                                        <span className="ml-2 text-blue-900">{importPlan.totalDays}日</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">新規データ:</span>
                                        <span className="ml-2 text-blue-900">{importPlan.newDays}日</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">既存データ:</span>
                                        <span className="ml-2 text-blue-900">{importPlan.duplicateDays}日</span>
                                    </div>
                                </div>
                            </div>

                            {importPlan.duplicateDays > 0 && (
                                <div className="bg-yellow-50 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-yellow-900 mb-2">既存データの処理</h4>
                                            <p className="text-sm text-yellow-800 mb-3">
                                                {importPlan.duplicateDays}日分のデータが既に存在します。
                                            </p>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={overwriteExisting}
                                                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                                                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <span className="text-sm text-yellow-900">既存データを上書きする</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">インポートするデータタイプ</h4>
                                <div className="space-y-1">
                                    {importPlan.dataTypes.map(type => (
                                        <div key={type} className="flex items-center text-sm text-gray-600">
                                            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                                            {dataTypeLabels[type as keyof typeof dataTypeLabels]}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={() => setStep('setup')}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                >
                                    戻る
                                </button>
                                <button
                                    onClick={handleExecuteImport}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    インポート開始
                                </button>
                            </div>
                        </div>
                    )}

                    {/* インポート中ステップ */}
                    {step === 'importing' && (
                        <div className="space-y-6 text-center">
                            <div className="flex flex-col items-center">
                                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    データをインポート中...
                                </h3>
                                <p className="text-gray-600">
                                    しばらくお待ちください。この処理には数分かかる場合があります。
                                </p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                                    <span>進捗</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="text-sm text-gray-500">
                                <p>• Fitbit APIからデータを取得しています</p>
                                <p>• データベースに保存しています</p>
                                <p>• API制限を考慮して適切な間隔で処理しています</p>
                            </div>
                        </div>
                    )}

                    {/* 完了ステップ */}
                    {step === 'complete' && importResult && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    インポート完了
                                </h3>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4">
                                <h4 className="font-medium text-green-900 mb-3">インポート結果</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-green-700">処理日数:</span>
                                        <span className="ml-2 text-green-900">{importResult.summary.processedDays}日</span>
                                    </div>
                                    <div>
                                        <span className="text-green-700">成功:</span>
                                        <span className="ml-2 text-green-900">{importResult.summary.successfulImports}日</span>
                                    </div>
                                    <div>
                                        <span className="text-green-700">失敗:</span>
                                        <span className="ml-2 text-green-900">{importResult.summary.failedImports}日</span>
                                    </div>
                                    <div>
                                        <span className="text-green-700">期間:</span>
                                        <span className="ml-2 text-green-900">
                                            {importResult.summary.startDate} 〜 {importResult.summary.endDate}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {importResult.summary.failedImports > 0 && (
                                <div className="bg-red-50 rounded-lg p-4">
                                    <h4 className="font-medium text-red-900 mb-2">エラーが発生した日付</h4>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {importResult.results
                                            .filter(r => !r.success)
                                            .map(result => (
                                                <div key={result.date} className="text-sm text-red-800">
                                                    {result.date}: {result.error}
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-center pt-4">
                                <button
                                    onClick={handleClose}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    完了
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}