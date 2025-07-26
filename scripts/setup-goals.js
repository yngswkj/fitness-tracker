require('dotenv').config({ path: '.env.local' })
const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

async function setupGoalsDatabase() {
    try {
        console.log('目標管理データベースのセットアップを開始します...')

        // SQLファイルを読み込み
        const sqlFilePath = path.join(__dirname, 'setup-goals-db.sql')
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')

        // SQLを実行（複数のステートメントを分割して実行）
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0)

        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`実行中: ${statement.substring(0, 50)}...`)
                await sql.query(statement)
            }
        }

        console.log('✅ 目標管理データベースのセットアップが完了しました')

        // テーブルの存在確認
        const { rows } = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('goals', 'goal_progress')
            ORDER BY table_name
        `

        console.log('作成されたテーブル:')
        rows.forEach(row => {
            console.log(`  - ${row.table_name}`)
        })

        // 各テーブルの構造を確認
        for (const table of ['goals', 'goal_progress']) {
            const { rows: columns } = await sql`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = ${table}
                ORDER BY ordinal_position
            `

            console.log(`\n${table}テーブルの構造:`)
            columns.forEach(col => {
                console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`)
            })
        }

    } catch (error) {
        console.error('❌ データベースセットアップエラー:', error)
        process.exit(1)
    }
}

// 直接実行された場合
if (require.main === module) {
    setupGoalsDatabase()
        .then(() => {
            console.log('\n🎉 セットアップが正常に完了しました')
            process.exit(0)
        })
        .catch(error => {
            console.error('セットアップに失敗しました:', error)
            process.exit(1)
        })
}

module.exports = { setupGoalsDatabase }