const { sql } = require('@vercel/postgres')

async function initHealthPlanetDB() {
    try {
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

        console.log('✅ HealthPlanet database setup completed successfully!')

    } catch (error) {
        console.error('❌ Error setting up HealthPlanet database:', error)
        process.exit(1)
    }
}

// 環境変数をロード
require('dotenv').config({ path: '.env.local' })

// スクリプト実行
initHealthPlanetDB()