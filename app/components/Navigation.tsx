'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
    Home,
    Activity,
    Utensils,
    Dumbbell,
    Target,
    Settings,
    LogOut,
    Menu,
    X
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Tooltip from './Tooltip'

const navigation = [
    { name: 'ダッシュボード', href: '/', icon: Home },
    { name: '食事記録', href: '/meals', icon: Utensils },
    { name: 'アクティビティ', href: '/activity', icon: Activity },
    { name: 'ワークアウト', href: '/workouts', icon: Dumbbell },
    { name: '目標管理', href: '/goals', icon: Target },
    { name: '設定', href: '/settings', icon: Settings },
]

export default function Navigation() {
    const { data: session } = useSession()
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const handleSignOut = () => {
        signOut({ callbackUrl: '/auth/signin' })
    }

    // 外側クリックでドロップダウンを閉じる
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setMobileMenuOpen(false)
            }
        }

        if (mobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [mobileMenuOpen])

    // モバイルメニューが開いている時にボディのスクロールを防ぐ
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = 'unset'
            }
        }
    }, [mobileMenuOpen])

    // ESCキーでメニューを閉じる
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && mobileMenuOpen) {
                setMobileMenuOpen(false)
            }
        }

        if (mobileMenuOpen) {
            document.addEventListener('keydown', handleEscapeKey)
            return () => {
                document.removeEventListener('keydown', handleEscapeKey)
            }
        }
    }, [mobileMenuOpen])

    return (
        <nav className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <Activity className="h-8 w-8 text-blue-600" />
                            <span className="ml-2 text-xl font-bold text-gray-900">FitnessTracker</span>
                        </div>
                        {/* デスクトップナビゲーション (1024px以上) */}
                        <div className="hidden lg:ml-6 lg:flex lg:space-x-8">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            }`}
                                    >
                                        <item.icon className="w-4 h-4 mr-2" />
                                        {item.name}
                                    </Link>
                                )
                            })}
                        </div>

                        {/* タブレットナビゲーション (768px-1023px) */}
                        <div className="hidden md:ml-6 md:flex md:space-x-2 lg:hidden">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href
                                return (
                                    <Tooltip key={item.name} content={item.name} position="bottom">
                                        <Link
                                            href={item.href}
                                            className={`inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium min-w-[44px] min-h-[44px] transition-all duration-200 ${isActive
                                                ? 'bg-blue-100 text-blue-700 shadow-sm border-2 border-blue-200'
                                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-2 border-transparent'
                                                }`}
                                            aria-label={item.name}
                                        >
                                            <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : ''}`} />
                                        </Link>
                                    </Tooltip>
                                )
                            })}
                        </div>
                    </div>
                    {/* デスクトップユーザー情報エリア (1024px以上) */}
                    <div className="hidden lg:ml-6 lg:flex lg:items-center">
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-700">
                                {session?.user?.name || session?.user?.email}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                ログアウト
                            </button>
                        </div>
                    </div>

                    {/* タブレットユーザー情報エリア (768px-1023px) */}
                    <div className="hidden md:ml-6 md:flex md:items-center lg:hidden">
                        <div className="flex items-center space-x-2">
                            {/* ユーザーアバター（ドロップダウン付き） */}
                            <div className="relative" ref={dropdownRef}>
                                <Tooltip content={session?.user?.name || session?.user?.email || 'ユーザー'} position="bottom">
                                    <button
                                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                        className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                                        aria-label="ユーザーメニューを開く"
                                        aria-expanded={mobileMenuOpen}
                                    >
                                        <span className="text-white text-sm font-medium">
                                            {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    </button>
                                </Tooltip>

                                {/* タブレット用ドロップダウンメニュー */}
                                {mobileMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {session?.user?.name || 'ユーザー'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {session?.user?.email}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                handleSignOut()
                                                setMobileMenuOpen(false)
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center transition-colors duration-200 active:bg-gray-200"
                                        >
                                            <LogOut className="w-4 h-4 mr-3" />
                                            ログアウト
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* モバイルメニューボタン (768px未満) */}
                    <div className="-mr-2 flex items-center md:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="inline-flex items-center justify-center p-3 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 active:bg-gray-200 transition-colors min-w-[44px] min-h-[44px]"
                            aria-expanded={mobileMenuOpen}
                            aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
                        >
                            {mobileMenuOpen ? (
                                <X className="block h-6 w-6" />
                            ) : (
                                <Menu className="block h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* モバイルメニュー (768px未満) */}
            <div className={`md:hidden bg-white border-t border-gray-200 shadow-lg transition-all duration-300 ease-in-out ${mobileMenuOpen
                ? 'max-h-screen opacity-100 visible'
                : 'max-h-0 opacity-0 invisible overflow-hidden'
                }`}>
                <div className="pt-2 pb-3 space-y-1">
                    {navigation.map((item, index) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`block pl-4 pr-4 py-4 border-l-4 text-base font-medium transition-all duration-200 active:bg-gray-100 min-h-[48px] flex items-center ${isActive
                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                                    }`}
                                onClick={() => setMobileMenuOpen(false)}
                                style={{
                                    transitionDelay: mobileMenuOpen ? `${index * 50}ms` : '0ms'
                                }}
                            >
                                <div className="flex items-center">
                                    <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                                    <span>{item.name}</span>
                                </div>
                            </Link>
                        )
                    })}
                </div>
                <div className="pt-4 pb-4 border-t border-gray-200">
                    <div className="flex items-center px-4 mb-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-sm font-medium">
                                {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">
                                {session?.user?.name || 'ユーザー'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {session?.user?.email}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <button
                            onClick={() => {
                                handleSignOut()
                                setMobileMenuOpen(false)
                            }}
                            className="block px-4 py-4 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left transition-colors duration-200 active:bg-gray-200 min-h-[48px]"
                        >
                            <div className="flex items-center">
                                <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
                                <span>ログアウト</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}