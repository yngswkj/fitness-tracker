import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from './components/AuthProvider'
import BottomNavigation from './components/BottomNavigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: 'Fitness Tracking App',
    description: '筋トレ継続のための健康管理アプリ',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <body className={inter.className}>
                <AuthProvider>
                    <div className="min-h-screen bg-gray-50">
                        {children}
                        <BottomNavigation />
                    </div>
                </AuthProvider>
            </body>
        </html>
    )
}