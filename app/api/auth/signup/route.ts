import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
    try {
        const { email, password, name } = await request.json()

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'すべてのフィールドを入力してください' },
                { status: 400 }
            )
        }

        // パスワードの強度チェック
        if (password.length < 8) {
            return NextResponse.json(
                { error: 'パスワードは8文字以上で入力してください' },
                { status: 400 }
            )
        }

        // 既存ユーザーのチェック
        const { rows: existingUsers } = await sql`
      SELECT id FROM users WHERE email = ${email}
    `

        if (existingUsers.length > 0) {
            return NextResponse.json(
                { error: 'このメールアドレスは既に登録されています' },
                { status: 400 }
            )
        }

        // パスワードのハッシュ化
        const saltRounds = 12
        const passwordHash = await bcrypt.hash(password, saltRounds)

        // ユーザーの作成
        const { rows } = await sql`
      INSERT INTO users (email, name, password_hash)
      VALUES (${email}, ${name}, ${passwordHash})
      RETURNING id, email, name
    `

        const user = rows[0]

        return NextResponse.json({
            message: 'アカウントが作成されました',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            }
        })

    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json(
            { error: 'アカウント作成に失敗しました' },
            { status: 500 }
        )
    }
}