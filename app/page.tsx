import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Dashboard from './components/Dashboard'

export default async function Home() {
    const session = await getServerSession()

    if (!session) {
        redirect('/auth/signin')
    }

    return <Dashboard />
}