'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    actions?: ReactNode
    children?: ReactNode
}

export default function PageHeader({
    title,
    description,
    icon: Icon,
    actions,
    children
}: PageHeaderProps) {
    return (
        <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                {Icon && <Icon className="w-8 h-8 text-blue-600" />}
                                {title}
                            </h1>
                            {description && (
                                <p className="text-gray-600 mt-2">{description}</p>
                            )}
                        </div>
                        {actions && (
                            <div className="flex items-center gap-4">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
                {children}
            </div>
        </div>
    )
}