'use client'

import { ReactNode, useState } from 'react'

interface TooltipProps {
    content: string
    children: ReactNode
    position?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
}

export default function Tooltip({
    content,
    children,
    position = 'bottom',
    delay = 300
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

    const showTooltip = () => {
        const id = setTimeout(() => {
            setIsVisible(true)
        }, delay)
        setTimeoutId(id)
    }

    const hideTooltip = () => {
        if (timeoutId) {
            clearTimeout(timeoutId)
            setTimeoutId(null)
        }
        setIsVisible(false)
    }

    const getPositionClasses = () => {
        switch (position) {
            case 'top':
                return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'
            case 'bottom':
                return 'top-full left-1/2 transform -translate-x-1/2 mt-2'
            case 'left':
                return 'right-full top-1/2 transform -translate-y-1/2 mr-2'
            case 'right':
                return 'left-full top-1/2 transform -translate-y-1/2 ml-2'
            default:
                return 'top-full left-1/2 transform -translate-x-1/2 mt-2'
        }
    }

    const getArrowClasses = () => {
        switch (position) {
            case 'top':
                return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900'
            case 'bottom':
                return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900'
            case 'left':
                return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900'
            case 'right':
                return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900'
            default:
                return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900'
        }
    }

    return (
        <div
            className="relative inline-block"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-50 ${getPositionClasses()}`}>
                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                        {content}
                    </div>
                    <div className={`absolute w-0 h-0 border-2 ${getArrowClasses()}`} />
                </div>
            )}
        </div>
    )
}