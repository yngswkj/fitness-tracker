'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PageLayout from '../components/PageLayout'
import FitbitSyncProgress from '../components/FitbitSyncProgress'
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

    // 各グラフ用のデータフィルタリング関数（欠落データ対応版）
    const getFilteredChartData = (chartType: string) => {
        const days = parseInt(chartPeriods[chartType as keyof typeof chartPeriods])
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        const startDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
        startDate.setHours(0, 0, 0, 0)

        // 既存データを日付でマップ化
        const dataMap = new Map<string, FitbitData>()
        fitbitData.forEach(item => {
            const itemDate = new Date(item.date)
            if (itemDate >= startDate && itemDate <= today) {
                // 日付のみを抽出してキーとして使用
                const dateKey = itemDate.toISOString().split('T')[0]
                dataMap.set(dateKey, item)
            }
        })

        // 連続した日付範囲を生成
        const result = []
        const currentDate = new Date(startDate)
        
        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0]
            const actualItem = dataMap.get(dateStr)
            const formattedDate = currentDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
            
            if (actualItem) {
                result.push({
                    date: formattedDate,
                    originalDate: dateStr,
                    steps: actualItem.steps || 0,
                    calories: actualItem.calories_burned || 0,
                    distance: actualItem.distance_km || 0,
                    activeMinutes: actualItem.active_minutes || 0,
                    sleepHours: actualItem.sleep_hours || 0,
                    heartRate: actualItem.resting_heart_rate || 0,
                    weight: actualItem.weight,
                    bodyFat: actualItem.body_fat,
                    hasValidData: true,
                    isMissing: false
                })
            } else {
                result.push({
                    date: formattedDate,
                    originalDate: dateStr,
                    steps: null,
                    calories: null,
                    distance: null,
                    activeMinutes: null,
                    sleepHours: null,
                    heartRate: null,
                    weight: null,
                    bodyFat: null,
                    hasValidData: false,
                    isMissing: true
                })
            }

            currentDate.setDate(currentDate.getDate() + 1)
        }

        return result
    }

    // Tooltip用の値フォーマット関数
    const formatTooltipValue = (value: any): number => {
        return typeof value === 'number' ? value : parseFloat(value) || 0
    }

    // 型安全なTooltipフォーマッター関数
    const createTooltipFormatter = (unit: string, isInteger: boolean = true) => {
        return (value: any) => {
            const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
            const formatted = isInteger ? Math.round(numValue).toLocaleString() : numValue.toFixed(1)
            return [formatted, unit]
        }
    }

    // 統計情報を計算する関数（新データ構造対応）
    const calculateStats = (data: any[], key: string) => {
        // 有効なデータのみから値を抽出（isMissingがfalseまたは未定義のもの）
        const validData = data.filter(item => !item.isMissing)
        const rawValues = validData.map(item => item[key])

        // データタイプに応じて有効な値の条件を設定
        let values = []

        if (key === 'sleepHours') {
            // 睡眠時間は0より大きい値のみ有効とする
            values = rawValues.filter(val => {
                if (val === null || val === undefined) return false
                const num = parseFloat(val)
                return !isNaN(num) && isFinite(num) && num > 0
            }).map(val => parseFloat(val))
        } else if (key === 'weight' || key === 'bodyFat') {
            // 体重、体脂肪は0も有効な値として扱う
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

            if (key === 'sleepHours') {
                // 睡眠時間は時間と分で表示
                const hours = Math.floor(val)
                const minutes = Math.round((val - hours) * 60)
                if (minutes === 0) {
                    return `${hours}h`
                } else {
                    return `${hours}h${minutes}m`
                }
            } else if (key === 'weight' || key === 'bodyFat') {
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
        // 有効なデータのみから値を抽出
        const validData = data.filter(item => !item.isMissing)
        let values = validData.map(item => item[key]).filter(val => val != null && !isNaN(val))
        
        // 0より大きい値のみを対象にするかどうか（weightとbodyFatは0も有効）
        if (key !== 'weight' && key !== 'bodyFat') {
            values = values.filter(val => val > 0)
        }
        
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

    // Weight & Body Fatグラフ用の同期化された軸範囲計算
    const calculateSynchronizedAxisDomains = (data: any[]) => {
        // 有効なデータのみから値を抽出
        const validData = data.filter(item => !item.isMissing)
        const weightValues = validData.map(item => item.weight).filter(val => val != null && !isNaN(val) && val > 0)
        const bodyFatValues = validData.map(item => item.bodyFat).filter(val => val != null && !isNaN(val) && val > 0)

        if (weightValues.length === 0 && bodyFatValues.length === 0) {
            return { weight: [0, 100], bodyFat: [0, 50] }
        }

        // 各データの範囲を計算
        const weightMin = weightValues.length > 0 ? Math.min(...weightValues) : 0
        const weightMax = weightValues.length > 0 ? Math.max(...weightValues) : 100
        const bodyFatMin = bodyFatValues.length > 0 ? Math.min(...bodyFatValues) : 0
        const bodyFatMax = bodyFatValues.length > 0 ? Math.max(...bodyFatValues) : 50

        // 変化率を計算（左右軸の比率を同じにするため）
        const weightRange = weightMax - weightMin
        const bodyFatRange = bodyFatMax - bodyFatMin

        // 変化率を同じにするため、range/baseRatioで正規化
        const weightBaseRatio = weightRange / (weightMin || 1)
        const bodyFatBaseRatio = bodyFatRange / (bodyFatMin || 1)

        // より大きな変化率に合わせて調整
        const maxRatio = Math.max(weightBaseRatio, bodyFatBaseRatio, 0.1) // 最小10%の変化は保証

        // 同じ比率で軸を設定
        const weightPadding = (weightMin || 70) * maxRatio * 0.1 // 10%のpadding
        const bodyFatPadding = (bodyFatMin || 15) * maxRatio * 0.1

        const weightDomain = [
            Math.max(0, Math.floor((weightMin - weightPadding) * 10) / 10),
            Math.ceil((weightMax + weightPadding) * 10) / 10
        ]

        const bodyFatDomain = [
            Math.max(0, Math.floor((bodyFatMin - bodyFatPadding) * 10) / 10),
            Math.ceil((bodyFatMax + bodyFatPadding) * 10) / 10
        ]

        return { weight: weightDomain, bodyFat: bodyFatDomain }
    }

    // Y軸の目盛り数を計算する関数
    const calculateTickCount = (domain: number[]) => {
        const range = domain[1] - domain[0]
        if (range <= 10) return Math.max(3, Math.ceil(range))
        if (range <= 50) return 5
        if (range <= 100) return 6
        return 8
    }

    // カスタムDotコンポーネント（欠落データ対応版）
    const CustomDot = (props: any) => {
        const { cx, cy, payload, dataKey } = props
        
        if (!payload) return null
        
        // 欠落データの場合はグレーの点を表示
        if (payload.isMissing) {
            return (
                <circle
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="#9ca3af"
                    stroke="#6b7280"
                    strokeWidth={1}
                    opacity={0.7}
                />
            )
        }
        
        // データが存在する場合の処理
        const value = payload[dataKey]
        if (value === null || value === undefined) {
            return null
        }
        
        // データタイプに応じて色を設定
        let color = '#3b82f6' // デフォルト青
        if (dataKey === 'heartRate') color = '#dc2626'
        else if (dataKey === 'weight') color = '#6366f1'
        else if (dataKey === 'bodyFat') color = '#f59e0b'
        else if (dataKey === 'activeMinutes') color = '#ea580c'
        else if (dataKey === 'calories') color = '#16a34a'
        
        return (
            <circle
                cx={cx}
                cy={cy}
                r={3}
                fill={color}
                stroke="white"
                strokeWidth={1}
            />
        )
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

    const headerActions = (
        <>
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
            <FitbitSyncProgress onSyncComplete={fetchData} />
        </>
    )

    return (
        <PageLayout
            title="Activity Dashboard"
            description="Track your fitness data from Fitbit"
            icon={Activity}
            actions={headerActions}
        >

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
                                            tickFormatter={(value) => Math.round(Number(value)).toLocaleString()}
                                        />
                                        <Tooltip formatter={(value) => [
                                            typeof value === 'number' ? Math.round(value).toLocaleString() : '0',
                                            'Steps'
                                        ]} />
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
                                            tickFormatter={(value) => Math.round(Number(value)).toString()}
                                        />
                                        <Tooltip formatter={(value) => [
                                            typeof value === 'number' ? Math.round(value) : Math.round(Number(value) || 0),
                                            'bpm'
                                        ]} />
                                        <Line
                                            type="monotone"
                                            dataKey="heartRate"
                                            stroke="#dc2626"
                                            strokeWidth={2}
                                            connectNulls={true}
                                            dot={<CustomDot dataKey="heartRate" />}
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
                                        <div className="text-lg font-semibold text-purple-600">{stats.avg}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">最大</div>
                                        <div className="text-lg font-semibold text-green-600">{stats.max}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">最小</div>
                                        <div className="text-lg font-semibold text-orange-600">{stats.min}</div>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={sleepData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" />
                                        <YAxis
                                            domain={calculateYAxisDomain(sleepData, 'sleepHours')}
                                            tickCount={calculateTickCount(calculateYAxisDomain(sleepData, 'sleepHours'))}
                                            tickFormatter={(value: any) => {
                                                const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0
                                                const hours = Math.floor(numValue)
                                                const minutes = Math.round((numValue - hours) * 60)
                                                if (minutes === 0) {
                                                    return `${hours}h`
                                                } else {
                                                    return `${hours}h${minutes}m`
                                                }
                                            }}
                                        />
                                        <Tooltip formatter={(value: any) => {
                                            const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0
                                            const hours = Math.floor(numValue)
                                            const minutes = Math.round((numValue - hours) * 60)
                                            if (minutes === 0) {
                                                return [`${hours}h`, '睡眠時間']
                                            } else {
                                                return [`${hours}h${minutes}m`, '睡眠時間']
                                            }
                                        }} />
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
                        const syncedDomains = calculateSynchronizedAxisDomains(weightData)
                        const weightDomain = syncedDomains.weight
                        const bodyFatDomain = syncedDomains.bodyFat
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
                                            domain={weightDomain}
                                            ticks={(() => {
                                                const ticks = []
                                                const start = Math.floor(weightDomain[0])
                                                const end = Math.ceil(weightDomain[1])
                                                for (let i = start; i <= end; i++) {
                                                    ticks.push(i)
                                                }
                                                return ticks
                                            })()}
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(value) => `${value}kg`}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            domain={bodyFatDomain}
                                            ticks={(() => {
                                                const ticks = []
                                                const start = Math.floor(bodyFatDomain[0] * 2) / 2
                                                const end = Math.ceil(bodyFatDomain[1] * 2) / 2
                                                for (let i = start; i <= end; i += 0.5) {
                                                    ticks.push(Math.round(i * 10) / 10)
                                                }
                                                return ticks
                                            })()}
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(value) => `${value}%`}
                                        />
                                        <Tooltip formatter={(value, name) => [
                                            typeof value === 'number' ? Math.round(value * 10) / 10 : Math.round(Number(value || 0) * 10) / 10,
                                            name === 'weight' ? 'Weight (kg)' : 'Body Fat (%)'
                                        ]} />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="weight"
                                            stroke="#6366f1"
                                            strokeWidth={2}
                                            name="weight"
                                            connectNulls={true}
                                            dot={<CustomDot dataKey="weight" />}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="bodyFat"
                                            stroke="#f59e0b"
                                            strokeWidth={2}
                                            name="bodyFat"
                                            connectNulls={true}
                                            dot={<CustomDot dataKey="bodyFat" />}
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
                                            tickFormatter={(value) => Math.round(Number(value)).toString()}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            domain={calculateYAxisDomain(activityData, 'calories')}
                                            tickCount={calculateTickCount(calculateYAxisDomain(activityData, 'calories'))}
                                            tickFormatter={(value) => Math.round(Number(value)).toLocaleString()}
                                        />
                                        <Tooltip formatter={(value, name) => {
                                            const numValue = typeof value === 'number' ? value : Number(value) || 0
                                            return [
                                                name === 'activeMinutes' ? Math.round(numValue) : Math.round(numValue).toLocaleString(),
                                                name === 'activeMinutes' ? 'Active Minutes' : 'Calories'
                                            ]
                                        }} />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="activeMinutes"
                                            stroke="#ea580c"
                                            strokeWidth={2}
                                            name="activeMinutes"
                                            connectNulls={true}
                                            dot={<CustomDot dataKey="activeMinutes" />}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="calories"
                                            stroke="#16a34a"
                                            strokeWidth={2}
                                            name="calories"
                                            connectNulls={true}
                                            dot={<CustomDot dataKey="calories" />}
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
                    <FitbitSyncProgress onSyncComplete={fetchData} />
                </div>
            )}
        </PageLayout>
    )
}