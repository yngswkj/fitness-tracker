'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Utensils, Dumbbell, Target, Activity } from 'lucide-react'

const bottomNavigation = [
    { name: 'ホーム', href: '/', icon: Home },
    { name: '食事', href: '/meals', icon: Utensils },
    { name: '運動', href: '/workouts', icon: Dumbbell },
    { name: '目標', href: '/goals', icon: Target },
    { name: '活動', href: '/activity', icon: Activity },
]

export default function BottomNavigation() {
    const pathname = usePathname()

    // 認証ページでは表示しない
    if (pathname.startsWith('/auth/')) {
        return null
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg md:hidden z-40">
            <div className="grid grid-cols-5 h-16">
                {bottomNavigation.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href))

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex flex-col items-center justify-center px-1 py-2 text-xs font-medium transition-colors active:bg-gray-100 ${isActive
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <item.icon
                                className={`h-5 w-5 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-400'
                                    }`}
                            />
                            <span className={`${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}