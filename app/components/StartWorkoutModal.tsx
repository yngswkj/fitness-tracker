'use client'

import { useState } from 'react'
import { X, Play, Copy } from 'lucide-react'
import { WorkoutTemplate } from '@/types/workout'

interface StartWorkoutModalProps {
    onSubmit: (workoutData: { name: string; notes?: string }) => Promise<void>
    onClose: () => void
}

export default function StartWorkoutModal({ onSubmit, onClose }: StartWorkoutModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        notes: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showTemplates, setShowTemplates] = useState(false)
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            setError('ワークアウト名を入力してください')
            return
        }

        setLoading(true)
        setError('')

        try {
            await onSubmit({
                name: formData.name.trim(),
                notes: formData.notes.trim() || undefined
            })
        } catch (error) {
            setError(error instanceof Error ? error.message : 'ワークアウトの開始に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const loadTemplates = async () => {
        if (templates.length > 0) {
            setShowTemplates(!showTemplates)
            return
        }

        setTemplatesLoading(true)
        try {
            const response = await fetch('/api/exercises/copy?limit=10')
            if (response.ok) {
                const data = await response.json()
                setTemplates(data.workout_templates || [])
                setShowTemplates(true)
            }
        } catch (error) {
            console.error('Load templates error:', error)
        } finally {
            setTemplatesLoading(false)
        }
    }

    const handleTemplateSelect = (template: WorkoutTemplate) => {
        setFormData({
            name: template.name,
            notes: `${template.name}のテンプレートから作成`
        })
        setShowTemplates(false)
    }

    const commonWorkoutNames = [
        'プッシュデイ（胸・肩・三頭筋）',
        'プルデイ（背中・二頭筋）',
        'レッグデイ（脚・臀部）',
        '上半身トレーニング',
        '下半身トレーニング',
        '全身トレーニング',
        'カーディオ',
        'ストレッチ・モビリティ'
    ]

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        ワークアウト開始
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* ワークアウト名 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ワークアウト名 *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="例: プッシュデイ、上半身トレーニング"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            required
                        />
                    </div>

                    {/* よく使うワークアウト名 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            よく使うワークアウト
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {commonWorkoutNames.slice(0, 4).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, name }))}
                                    className="text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* テンプレートから選択 */}
                    <div>
                        <button
                            type="button"
                            onClick={loadTemplates}
                            disabled={templatesLoading}
                            className="w-full flex items-center justify-center px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors disabled:opacity-50"
                        >
                            <Copy className="h-4 w-4 mr-2" />
                            {templatesLoading ? '読み込み中...' : '過去のワークアウトから選択'}
                        </button>

                        {showTemplates && templates.length > 0 && (
                            <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => handleTemplateSelect(template)}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="font-medium text-sm">{template.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {template.exercise_count}種目 • {new Date(template.started_at).toLocaleDateString()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* メモ */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            メモ（任意）
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="今日の目標や体調など..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm">{error}</div>
                    )}

                    {/* ボタン */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 btn-primary flex items-center justify-center disabled:opacity-50"
                        >
                            <Play className="h-4 w-4 mr-2" />
                            {loading ? '開始中...' : 'ワークアウト開始'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}