import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: NextRequest) {
    try {
        // セキュリティチェック（開発環境のみ実行可能）
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json(
                { error: 'This endpoint is only available in development' },
                { status: 403 }
            )
        }

        console.log('Creating HealthPlanet tokens table...')

        // HealthPlanetトークンテーブルを作成
        await sql`
            CREATE TABLE IF NOT EXISTS healthplanet_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `

        console.log('Creating indexes...')

        // インデックスを作成
        await sql`
            CREATE INDEX IF NOT EXISTS idx_healthplanet_tokens_user_id 
            ON healthplanet_tokens(user_id)
        `

        await sql`
            CREATE INDEX IF NOT EXISTS idx_healthplanet_tokens_expires_at 
            ON healthplanet_tokens(expires_at)
        `

        return NextResponse.json({
            success: true,
            message: 'HealthPlanet database setup completed successfully!'
        })

    } catch (error) {
        console.error('Error setting up HealthPlanet database:', error)
        return NextResponse.json(
            {
                error: 'Failed to setup database',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}