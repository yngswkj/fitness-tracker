'use client'

import { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Navigation from './Navigation'
import PageHeader from './PageHeader'
import { LucideIcon } from 'lucide-react'

interface PageLayoutProps {
    title: string
    description?: string
    icon?: LucideIcon
    actions?: ReactNode
    children: ReactNode
    requireAuth?: boolean
}

export default function PageLayout({
    title,
    description,
    icon,
    actions,
    children,
    requireAuth = true
}: PageLayoutProps) {
    const { data: session, status } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (requireAuth && status === 'unauthenticated') {
            router.push('/auth/signin')
        }
    }, [status, requireAuth, router])

    if (requireAuth && status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    if (requireAuth && !session) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
            <Navigation />
            <PageHeader
                title={title}
                description={description}
                icon={icon}
                actions={actions}
            >
                {children}
            </PageHeader>
        </div>
    )
}