import { sql } from '@vercel/postgres'

// データベース接続テスト用の関数
export async function testDatabaseConnection() {
    try {
        const { rows } = await sql`SELECT NOW() as current_time`
        console.log('✅ Database connection successful:', rows[0])
        return true
    } catch (error) {
        console.error('❌ Database connection failed:', error)
        return false
    }
}

// ユーザー作成のヘルパー関数
export async function createUser(email: string, name: string, passwordHash: string) {
    try {
        const { rows } = await sql`
      INSERT INTO users (email, name, password_hash)
      VALUES (${email}, ${name}, ${passwordHash})
      RETURNING id, email, name, created_at
    `
        return rows[0]
    } catch (error) {
        console.error('Error creating user:', error)
        throw error
    }
}