import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fitbitトークンを削除
        await sql`
      DELETE FROM fitbit_tokens 
      WHERE user_id = ${session.user.id}
    `

        // ユーザーテーブルのFitbit IDをクリア
        await sql`
      UPDATE users 
      SET fitbit_user_id = NULL, updated_at = NOW()
      WHERE id = ${session.user.id}
    `

        // Fitbitデータは保持（ユーザーが明示的に削除を要求した場合のみ削除）
        // 必要に応じて以下のコメントアウトを解除
        /*
        await sql`
          DELETE FROM fitbit_data 
          WHERE user_id = ${session.user.id}
        `
        */

        return NextResponse.json({
            message: 'Fitbit連携を解除しました'
        })

    } catch (error) {
        console.error('Fitbit disconnect error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}