'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navigation from '../components/Navigation'
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts'
import {
    Activity,
    Heart,
    Moon,
    Footprints,
    Zap,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Clock,
    TrendingUp,
    Calendar,
    Scale
} from 'lucide-react'

interface FitbitData {
    id: number
    date: string
    steps: number | null
    calories_burned: number | null
    distance_km: number | null
    active_minutes: number | null
    sleep_hours: number | null
    resting_heart_rate: number | null
    weight: number | null
    body_fat: number | null
    synced_at: string
}

interface SyncStatus {
    summary: {
        totalDays: number
        daysWithSteps: number
        daysWithSleep: number
        daysWithHeartRate: number
        averageSteps: number
        averageSleepHours: number
        lastSync: string
    }
    errors: {
        total: number
        byType: { [key: string]: number }
        recent: Array<{
            error_type: string
            error_message: string
            sync_date: string
            created_at: string
        }>
    }
    healthScore: {
        overall: number
        status: string
        recommendations: string[]
    }
}

export default function ActivityPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [fitbitData, setFitbitData] = useState<FitbitData[]>([])
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [selectedPeriod, setSelectedPeriod] = useState('7')

    // 各グラフの個別期間設定（初期値を7日間に統一）
    const [chartPeriods, setChartPeriods] = useState({
        steps: '7',
        heartRate: '7',
        sleep: '7',
        weight: '7',
        activity: '7'
    })



    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin')
            return
        }

        if (status === 'authenticated') {
            fetchData()
        }
    }, [status, selectedPeriod])

    // 上部のプルダウン変更時に全グラフの期間を更新
    const handleGlobalPeriodChange = (newPeriod: string) => {
        setSelectedPeriod(newPeriod)
        setChartPeriods({
            steps: newPeriod,
            heartRate: newPeriod,
            sleep: newPeriod,
            weight: newPeriod,
            activity: newPeriod
        })
    }

    // 各グラフの期間変更時にデータを再取得
    useEffect(() => {
        if (status === 'authenticated') {
            fetchExtendedData()
        }
    }, [chartPeriods])

    const fetchExtendedData = async () => {
        try {
            // 最大期間（1年）のデータを取得
            const maxDays = Math.max(...Object.values(chartPeriods).map(p => parseInt(p)))
            const extendedRange = getExtendedDateRange(maxDays)

            const dataResponse = await fetch(`/api/fitbit/data?from=${extendedRange.from}&to=${extendedRange.to}`)
            if (dataResponse.ok) {
                const dataResult = await dataResponse.json()
                setFitbitData(dataResult.data || [])
            }
        } catch (error) {
            console.error('Error fetching extended data:', error)
        }
    }

    const getExtendedDateRange = (days: number) => {
        const to = new Date().toISOString().split('T')[0]
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0]
        return { from, to }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Fitbit data
            const dataResponse = await fetch(`/api/fitbit/data?from=${getDateRange().from}&to=${getDateRange().to}`)
            if (dataResponse.ok) {
                const dataResult = await dataResponse.json()
                setFitbitData(dataResult.data || [])
            }

            // Fetch sync status
            const statusResponse = await fetch(`/api/fitbit/sync-status?days=${selectedPeriod}`)
            if (statusResponse.ok) {
                const statusResult = await statusResponse.json()
                setSyncStatus(statusResult)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getDateRange = () => {
        const to = new Date().toISOString().split('T')[0]
        const from = new Date(Date.now() - parseInt(selectedPeriod) * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0]
        return { from, to }
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            const response = await fetch('/api/fitbit/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: new Date().toISOString().split('T')[0] })
            })

            if (response.ok) {
                await fetchData() // Refresh data after sync
            } else {
                const error = await response.json()
                alert(`Sync failed: ${error.error}`)
            }
        } catch (error) {
            console.error('Sync error:', error)
            alert('Sync failed. Please try again.')
        } finally {
            setSyncing(false)
        }
    }

    const formatChartData = () => {
        return fitbitData
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(item => ({
                date: new Date(item.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                steps: item.steps || 0,
                calories: item.calories_burned || 0,
                distance: item.distance_km || 0,
                activeMinutes: item.active_minutes || 0,
                sleepHours: item.sleep_hours || 0,
                heartRate: item.resting_heart_rate || 0,
                weight: item.weight || null,
                bodyFat: item.body_fat || null
            }))
    }

    // 各グラフ用のデータフィルタリング関数（有効値ありのデータから開始）
    const getFilteredChartData = (chartType: string) => {
        const days = parseInt(chartPeriods[chartType as keyof typeof chartPeriods])
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

        // 指定期間内のデータを取得
        const periodData = fitbitData
            .filter(item => new Date(item.date) >= cutoffDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // チャートタイプに応じて有効なデータの条件を設定
        let validDataFilter: (item: FitbitData) => boolean

        switch (chartType) {
            case 'steps':
                validDataFilter = (item) => item.steps != null && item.steps > 0
                break
            case 'heartRate':
                validDataFilter = (item) => item.resting_heart_rate != null && item.resting_heart_rate > 0
                break
            case 'sleep':
                validDataFilter = (item) => item.sleep_hours != null
                break
            case 'weight':
                validDataFilter = (item) => item.weight != null || item.body_fat != null
                break
            case 'activity':
                validDataFilter = (item) => (item.active_minutes != null && item.active_minutes > 0) ||
                    (item.calories_burned != null && item.calories_burned > 0)
                break
            default:
                validDataFilter = () => true
        }

        // 有効なデータがある最古の日付を見つける
        const firstValidData = periodData.find(validDataFilter)
        const startDate = firstValidData ? new Date(firstValidData.date) : cutoffDate

        // 有効なデータがある日付以降のデータを返す
        return periodData
            .filter(item => new Date(item.date) >= startDate)
            .map(item => ({
                date: new Date(item.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
                steps: item.steps || 0,
                calories: item.calories_burned || 0,
                distance: item.distance_km || 0,
                activeMinutes: item.active_minutes || 0,
                sleepHours: item.sleep_hours, // NULLをそのまま保持
                heartRate: item.resting_heart_rate || 0,
                weight: item.weight, // NULLをそのまま保持
                bodyFat: item.body_fat // NULLをそのまま保持
            }))
    }

    // 統計情報を計算する関数
    const calculateStats = (data: any[], key: string) => {
        // 生データから有効な値を抽出
        const rawValues = data.map(item => item[key])

        // データタイプに応じて有効な値の条件を設定
        let values = []

        if (key === 'sleepHours' || key === 'weight' || key === 'bodyFat') {
            // 睡眠時間、体重、体脂肪は0も有効な値として扱う
            values = rawValues.filter(val => {
                // null, undefined, NaN, 文字列を除外
                if (val === null || val === undefined) return false
                const num = parseFloat(val)
                return !isNaN(num) && isFinite(num)
            }).map(val => parseFloat(val))
        } else {
            // その他（歩数、心拍数、カロリーなど）は0を除外
            values = rawValues.filter(val => {
                if (val === null || val === undefined) return false
                const num = parseFloat(val)
                return !isNaN(num) && isFinite(num) && num > 0
            }).map(val => parseFloat(val))
        }

        // 有効なデータがない場合
        if (values.length === 0) {
            return { avg: '-', min: '-', max: '-', count: 0 }
        }

        // 統計計算
        const sum = values.reduce((acc, val) => acc + val, 0)
        const avg = sum / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)

        // データタイプに応じて適切にフォーマット
        const formatValue = (val: number) => {
            if (!isFinite(val) || isNaN(val)) return '-'

            if (key === 'sleepHours' || key === 'weight' || key === 'bodyFat') {
                return Math.round(val * 10) / 10 // 小数点1桁
            }
            return Math.round(val) // その他は整数
        }

        return {
            avg: formatValue(avg),
            min: formatValue(min),
            max: formatValue(max),
            count: values.length
        }
    }

    // 期間選択オプション
    const periodOptions = [
        { value: '7', label: '7日' },
        { value: '14', label: '14日' },
        { value: '30', label: '1ヶ月' },
        { value: '60', label: '2ヶ月' },
        { value: '90', label: '3ヶ月' },
        { value: '180', label: '6ヶ月' },
        { value: '365', label: '1年' }
    ]

    // キリの良い数字に丸める関数
    const roundToNiceNumber = (value: number, isMin: boolean = false) => {
        if (value <= 0) return 0

        const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
        const normalized = value / magnitude

        let nice
        if (normalized <= 1) nice = 1
        else if (normalized <= 2) nice = 2
        else if (normalized <= 5) nice = 5
        else nice = 10

        const result = nice * magnitude

        // 最小値の場合は少し下に、最大値の場合は少し上に調整
        if (isMin) {
            return Math.floor(result * 0.9)
        } else {
            return Math.ceil(result * 1.1)
        }
    }

    // グラフのY軸範囲を計算する関数（整数でキリの良い数字）
    const calculateYAxisDomain = (data: any[], key: string) => {
        const values = data.map(item => item[key]).filter(val => val != null && !isNaN(val) && val > 0)
        if (values.length === 0) return [0, 100]

        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min

        let domainMin, domainMax

        if (range === 0) {
            // 全て同じ値の場合
            domainMin = Math.max(0, Math.floor(min * 0.9))
            domainMax = Math.ceil(max * 1.1)
        } else if (range < 10) {
            // 範囲が小さい場合
            domainMin = Math.max(0, Math.floor(min - 2))
            domainMax = Math.ceil(max + 2)
        } else {
            // 通常の場合：キリの良い数字に丸める
            domainMin = Math.max(0, roundToNiceNumber(min, true))
            domainMax = roundToNiceNumber(max, false)
        }

        // 睡眠時間の場合は特別処理（小数点を許可）
        if (key === 'sleepHours') {
            domainMin = Math.max(0, Math.floor(min * 2) / 2 - 0.5) // 0.5時間単位
            domainMax = Math.ceil(max * 2) / 2 + 0.5
        }

        return [domainMin, domainMax]
    }

    // Y軸の目盛り数を計算する関数
    const calculateTickCount = (domain: number[]) => {
        const range = domain[1] - domain[0]
        if (range <= 10) return Math.max(3, Math.ceil(range))
        if (range <= 50) return 5
        if (range <= 100) return 6
        return 8
    }





    const getHealthScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600'
        if (score >= 60) return 'text-blue-600'
        if (score >= 40) return 'text-yellow-600'
        return 'text-red-600'
    }

    const getHealthScoreIcon = (status: string) => {
        switch (status) {
            case 'excellent':
            case 'good':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'fair':
                return <Clock className="w-5 h-5 text-yellow-600" />
            default:
                return <AlertCircle className="w-5 h-5 text-red-600" />
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Loading activity data...</p>
                </div>
            </div>
        )
    }

    const chartData = formatChartData()

    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                    <Activity className="w-8 h-8 text-blue-600" />
                                    Activity Dashboard
                                </h1>
                                <p className="text-gray-600 mt-2">Track your fitness data from Fitbit</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <select
                                    value={selectedPeriod}
                                    onChange={(e) => handleGlobalPeriodChange(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="7">Last 7 days</option>
                                    <option value="14">Last 14 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="60">Last 60 days</option>
                                    <option value="90">Last 90 days</option>
                                    <option value="180">Last 180 days</option>
                                    <option value="365">Last 365 days</option>
                                </select>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Syncing...' : 'Sync Now'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sync Status Card */}
                    {syncStatus && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-900">Sync Status</h2>
                                <div className="flex items-center gap-2">
                                    {getHealthScoreIcon(syncStatus.healthScore.status)}
                                    <span className={`font-semibold ${getHealthScoreColor(syncStatus.healthScore.overall)}`}>
                                        {syncStatus.healthScore.overall}/100
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">{syncStatus.summary.daysWithSteps}</div>
                                    <div className="text-sm text-gray-600">Days with Steps</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{syncStatus.summary.daysWithSleep}</div>
                                    <div className="text-sm text-gray-600">Days with Sleep</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">{syncStatus.summary.daysWithHeartRate}</div>
                                    <div className="text-sm text-gray-600">Days with Heart Rate</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-orange-600">{syncStatus.errors.total}</div>
                                    <div className="text-sm text-gray-600">Recent Errors</div>
                                </div>
                            </div>

                            {syncStatus.healthScore.recommendations.length > 0 && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h3 className="font-medium text-blue-900 mb-2">Recommendations</h3>
                                    <ul className="space-y-1">
                                        {syncStatus.healthScore.recommendations.map((rec, index) => (
                                            <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                                                <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary Cards */}
                    {syncStatus && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Average Steps</p>
                                        <p className="text-2xl font-bold text-gray-900">{syncStatus.summary.averageSteps.toLocaleString()}</p>
                                    </div>
                                    <Footprints className="w-8 h-8 text-blue-600" />
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Average Sleep</p>
                                        <p className="text-2xl font-bold text-gray-900">{syncStatus.summary.averageSleepHours}h</p>
                                    </div>
                                    <Moon className="w-8 h-8 text-purple-600" />
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Data Completeness</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {Math.round((syncStatus.summary.daysWithSteps / syncStatus.summary.totalDays) * 100)}%
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-green-600" />
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Last Sync</p>
                                        <p className="text-sm font-bold text-gray-900">
                                            {syncStatus.summary.lastSync ?
                                                new Date(syncStatus.summary.lastSync).toLocaleDateString('ja-JP') : 'Never'}
                                        </p>
                                    </div>
                                    <Calendar className="w-8 h-8 text-gray-600" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Steps Chart */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Footprints className="w-5 h-5 text-blue-600" />
                                    Daily Steps
                                </h3>
                                <select
                                    value={chartPeriods.steps}
                                    onChange={(e) => setChartPeriods(prev => ({ ...prev, steps: e.target.value }))}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {periodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {(() => {
                                const stepsData = getFilteredChartData('steps')
                                const stats = calculateStats(stepsData, 'steps')
                                return (
                                    <>
                                        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                            <div>
                                                <div className="text-sm text-gray-600">平均</div>
                                                <div className="text-lg font-semibold text-blue-600">{stats.avg.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">最大</div>
                                                <div className="text-lg font-semibold text-green-600">{stats.max.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">最小</div>
                                                <div className="text-lg font-semibold text-orange-600">{stats.min.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={stepsData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis
                                                    domain={calculateYAxisDomain(stepsData, 'steps')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(stepsData, 'steps'))}
                                                    tickFormatter={(value) => Math.round(value).toLocaleString()}
                                                />
                                                <Tooltip formatter={(value) => [Math.round(value).toLocaleString(), 'Steps']} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="steps"
                                                    stroke="#2563eb"
                                                    fill="#3b82f6"
                                                    fillOpacity={0.3}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </>
                                )
                            })()}
                        </div>

                        {/* Heart Rate Chart */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-red-600" />
                                    Resting Heart Rate
                                </h3>
                                <select
                                    value={chartPeriods.heartRate}
                                    onChange={(e) => setChartPeriods(prev => ({ ...prev, heartRate: e.target.value }))}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {periodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {(() => {
                                const heartRateData = getFilteredChartData('heartRate')
                                const stats = calculateStats(heartRateData, 'heartRate')
                                return (
                                    <>
                                        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                            <div>
                                                <div className="text-sm text-gray-600">平均</div>
                                                <div className="text-lg font-semibold text-red-600">{stats.avg} bpm</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">最大</div>
                                                <div className="text-lg font-semibold text-green-600">{stats.max} bpm</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">最小</div>
                                                <div className="text-lg font-semibold text-orange-600">{stats.min} bpm</div>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={heartRateData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis
                                                    domain={calculateYAxisDomain(heartRateData, 'heartRate')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(heartRateData, 'heartRate'))}
                                                    tickFormatter={(value) => Math.round(value).toString()}
                                                />
                                                <Tooltip formatter={(value) => [Math.round(value), 'bpm']} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="heartRate"
                                                    stroke="#dc2626"
                                                    strokeWidth={2}
                                                    dot={{ fill: '#dc2626' }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </>
                                )
                            })()}
                        </div>

                        {/* Sleep Chart */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Moon className="w-5 h-5 text-purple-600" />
                                    Sleep Hours
                                </h3>
                                <select
                                    value={chartPeriods.sleep}
                                    onChange={(e) => setChartPeriods(prev => ({ ...prev, sleep: e.target.value }))}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {periodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {(() => {
                                const sleepData = getFilteredChartData('sleep')
                                const stats = calculateStats(sleepData, 'sleepHours')
                                return (
                                    <>
                                        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                            <div>
                                                <div className="text-sm text-gray-600">平均</div>
                                                <div className="text-lg font-semibold text-purple-600">{stats.avg}h</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">最大</div>
                                                <div className="text-lg font-semibold text-green-600">{stats.max}h</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">最小</div>
                                                <div className="text-lg font-semibold text-orange-600">{stats.min}h</div>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={sleepData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis
                                                    domain={calculateYAxisDomain(sleepData, 'sleepHours')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(sleepData, 'sleepHours'))}
                                                    tickFormatter={(value) => typeof value === 'number' ? value.toFixed(1) : '0'}
                                                />
                                                <Tooltip formatter={(value) => [
                                                    typeof value === 'number' ? value.toFixed(1) : '0',
                                                    'Hours'
                                                ]} />
                                                <Bar dataKey="sleepHours" fill="#7c3aed" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </>
                                )
                            })()}
                        </div>

                        {/* Weight Chart */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Scale className="w-5 h-5 text-indigo-600" />
                                    Weight & Body Fat
                                </h3>
                                <select
                                    value={chartPeriods.weight}
                                    onChange={(e) => setChartPeriods(prev => ({ ...prev, weight: e.target.value }))}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {periodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {(() => {
                                const weightData = getFilteredChartData('weight')
                                const weightStats = calculateStats(weightData, 'weight')
                                const bodyFatStats = calculateStats(weightData, 'bodyFat')
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-6 mb-4">
                                            <div>
                                                <div className="text-sm text-gray-600 mb-2">体重 (kg)</div>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <div className="text-xs text-gray-500">平均</div>
                                                        <div className="text-sm font-semibold text-indigo-600">{weightStats.avg}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最大</div>
                                                        <div className="text-sm font-semibold text-green-600">{weightStats.max}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最小</div>
                                                        <div className="text-sm font-semibold text-orange-600">{weightStats.min}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600 mb-2">体脂肪率 (%)</div>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <div className="text-xs text-gray-500">平均</div>
                                                        <div className="text-sm font-semibold text-amber-600">{bodyFatStats.avg}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最大</div>
                                                        <div className="text-sm font-semibold text-red-600">{bodyFatStats.max}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最小</div>
                                                        <div className="text-sm font-semibold text-green-600">{bodyFatStats.min}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={weightData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis
                                                    yAxisId="left"
                                                    domain={calculateYAxisDomain(weightData, 'weight')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(weightData, 'weight'))}
                                                    tickFormatter={(value) => Math.round(value * 10) / 10}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    domain={calculateYAxisDomain(weightData, 'bodyFat')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(weightData, 'bodyFat'))}
                                                    tickFormatter={(value) => Math.round(value * 10) / 10}
                                                />
                                                <Tooltip formatter={(value, name) => [
                                                    Math.round(value * 10) / 10,
                                                    name === 'weight' ? 'Weight (kg)' : 'Body Fat (%)'
                                                ]} />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="weight"
                                                    stroke="#6366f1"
                                                    strokeWidth={2}
                                                    name="weight"
                                                    dot={{ fill: '#6366f1' }}
                                                />
                                                <Line
                                                    yAxisId="right"
                                                    type="monotone"
                                                    dataKey="bodyFat"
                                                    stroke="#f59e0b"
                                                    strokeWidth={2}
                                                    name="bodyFat"
                                                    dot={{ fill: '#f59e0b' }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </>
                                )
                            })()}
                        </div>

                        {/* Activity Chart */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-orange-600" />
                                    Active Minutes & Calories
                                </h3>
                                <select
                                    value={chartPeriods.activity}
                                    onChange={(e) => setChartPeriods(prev => ({ ...prev, activity: e.target.value }))}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {periodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {(() => {
                                const activityData = getFilteredChartData('activity')
                                const activeMinutesStats = calculateStats(activityData, 'activeMinutes')
                                const caloriesStats = calculateStats(activityData, 'calories')
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-6 mb-4">
                                            <div>
                                                <div className="text-sm text-gray-600 mb-2">活動時間 (分)</div>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <div className="text-xs text-gray-500">平均</div>
                                                        <div className="text-sm font-semibold text-orange-600">{activeMinutesStats.avg}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最大</div>
                                                        <div className="text-sm font-semibold text-green-600">{activeMinutesStats.max}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最小</div>
                                                        <div className="text-sm font-semibold text-red-600">{activeMinutesStats.min}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600 mb-2">消費カロリー</div>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <div className="text-xs text-gray-500">平均</div>
                                                        <div className="text-sm font-semibold text-green-600">{caloriesStats.avg.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最大</div>
                                                        <div className="text-sm font-semibold text-blue-600">{caloriesStats.max.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">最小</div>
                                                        <div className="text-sm font-semibold text-purple-600">{caloriesStats.min.toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={activityData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis
                                                    yAxisId="left"
                                                    domain={calculateYAxisDomain(activityData, 'activeMinutes')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(activityData, 'activeMinutes'))}
                                                    tickFormatter={(value) => Math.round(value).toString()}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    domain={calculateYAxisDomain(activityData, 'calories')}
                                                    tickCount={calculateTickCount(calculateYAxisDomain(activityData, 'calories'))}
                                                    tickFormatter={(value) => Math.round(value).toLocaleString()}
                                                />
                                                <Tooltip formatter={(value, name) => [
                                                    name === 'activeMinutes' ? Math.round(value) : Math.round(value).toLocaleString(),
                                                    name === 'activeMinutes' ? 'Active Minutes' : 'Calories'
                                                ]} />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="activeMinutes"
                                                    stroke="#ea580c"
                                                    strokeWidth={2}
                                                    name="activeMinutes"
                                                />
                                                <Line
                                                    yAxisId="right"
                                                    type="monotone"
                                                    dataKey="calories"
                                                    stroke="#16a34a"
                                                    strokeWidth={2}
                                                    name="calories"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Recent Errors */}
                    {syncStatus && syncStatus.errors.recent.length > 0 && (
                        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                Recent Sync Errors
                            </h3>
                            <div className="space-y-3">
                                {syncStatus.errors.recent.map((error, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-red-900">{error.error_type}</span>
                                                <span className="text-xs text-red-600">
                                                    {new Date(error.created_at).toLocaleDateString('ja-JP')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-red-800">{error.error_message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No Data Message */}
                    {chartData.length === 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Data</h3>
                            <p className="text-gray-600 mb-6">
                                Connect your Fitbit account and sync your data to see your activity dashboard.
                            </p>
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Syncing...' : 'Sync Fitbit Data'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}