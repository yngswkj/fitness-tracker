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
        <div className="py-4 md:py-6 lg:py-8">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
                <div className="mb-6 md:mb-8 lg:mb-10">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start lg:items-center gap-4 md:gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                                {Icon && <Icon className="w-5 h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-blue-600 flex-shrink-0" />}
                                <span className="truncate">{title}</span>
                            </h1>
                            {description && (
                                <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base lg:text-lg">{description}</p>
                            )}
                        </div>
                        {actions && (
                            <div className="flex items-center gap-2 md:gap-3 lg:gap-4 flex-shrink-0 flex-wrap">
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