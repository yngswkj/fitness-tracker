'use client'

import { useState, useEffect } from 'react'
import { Timer, Play, Pause } from 'lucide-react'

interface WorkoutTimerProps {
    startTime: string
}

export default function WorkoutTimer({ startTime }: WorkoutTimerProps) {
    const [elapsed, setElapsed] = useState(0)
    const [isRunning, setIsRunning] = useState(true)

    useEffect(() => {
        const calculateElapsed = () => {
            const start = new Date(startTime).getTime()
            const now = new Date().getTime()
            return Math.floor((now - start) / 1000)
        }

        // 初期値を設定
        setElapsed(calculateElapsed())

        // タイマーが動いている場合のみ更新
        if (!isRunning) return

        const interval = setInterval(() => {
            setElapsed(calculateElapsed())
        }, 1000)

        return () => clearInterval(interval)
    }, [startTime, isRunning])

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`
    }

    const toggleTimer = () => {
        setIsRunning(!isRunning)
    }

    return (
        <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Timer className="h-4 w-4 text-green-600" />
            <span className="font-mono text-lg font-semibold text-green-700">
                {formatTime(elapsed)}
            </span>
            <button
                onClick={toggleTimer}
                className="text-green-600 hover:text-green-700"
                title={isRunning ? 'タイマーを一時停止' : 'タイマーを再開'}
            >
                {isRunning ? (
                    <Pause className="h-4 w-4" />
                ) : (
                    <Play className="h-4 w-4" />
                )}
            </button>
        </div>
    )
}