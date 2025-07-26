// ワークアウトAPI テストスクリプト
// 使用方法: node test-workout-api.js

const BASE_URL = 'http://localhost:3000'

// テスト用のセッションクッキーを設定する必要があります
// 実際のテストでは認証済みのセッションが必要です

async function testWorkoutAPI() {
    console.log('🏋️ ワークアウトAPI テスト開始\n')

    try {
        // 1. ワークアウト一覧取得テスト
        console.log('1. ワークアウト一覧取得テスト')
        const workoutsResponse = await fetch(`${BASE_URL}/api/workouts`)
        console.log('Status:', workoutsResponse.status)

        if (workoutsResponse.status === 401) {
            console.log('❌ 認証が必要です。ログインしてからテストしてください。\n')
        } else {
            const workoutsData = await workoutsResponse.json()
            console.log('Response:', JSON.stringify(workoutsData, null, 2))
        }

        // 2. ワークアウト作成テスト
        console.log('\n2. ワークアウト作成テスト')
        const createWorkoutResponse = await fetch(`${BASE_URL}/api/workouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'テスト ワークアウト',
                notes: 'APIテスト用のワークアウト'
            })
        })
        console.log('Status:', createWorkoutResponse.status)

        if (createWorkoutResponse.status === 401) {
            console.log('❌ 認証が必要です。\n')
        } else {
            const createData = await createWorkoutResponse.json()
            console.log('Response:', JSON.stringify(createData, null, 2))
        }

        // 3. エクササイズ作成テスト（ワークアウトIDが必要）
        console.log('\n3. エクササイズ作成テスト')
        const createExerciseResponse = await fetch(`${BASE_URL}/api/exercises`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                workout_id: 1, // 実際のワークアウトIDに変更してください
                exercise_name: 'ベンチプレス',
                sets: 3,
                reps: 10,
                weight: 60.0,
                rest_seconds: 90
            })
        })
        console.log('Status:', createExerciseResponse.status)

        if (createExerciseResponse.status === 401) {
            console.log('❌ 認証が必要です。\n')
        } else {
            const exerciseData = await createExerciseResponse.json()
            console.log('Response:', JSON.stringify(exerciseData, null, 2))
        }

        // 4. エクササイズ順序変更テスト
        console.log('\n4. エクササイズ順序変更テスト')
        const reorderResponse = await fetch(`${BASE_URL}/api/exercises/reorder`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                workout_id: 1,
                exercise_orders: [
                    { exercise_id: 2 },
                    { exercise_id: 1 }
                ]
            })
        })
        console.log('Status:', reorderResponse.status)

        if (reorderResponse.status === 401) {
            console.log('❌ 認証が必要です。\n')
        } else {
            const reorderData = await reorderResponse.json()
            console.log('Response:', JSON.stringify(reorderData, null, 2))
        }

        // 5. エクササイズ統計テスト
        console.log('\n5. エクササイズ統計テスト')
        const statsResponse = await fetch(`${BASE_URL}/api/exercises/stats?exercise_name=ベンチプレス&period=30`)
        console.log('Status:', statsResponse.status)

        if (statsResponse.status === 401) {
            console.log('❌ 認証が必要です。\n')
        } else {
            const statsData = await statsResponse.json()
            console.log('Response:', JSON.stringify(statsData, null, 2))
        }

        // 6. ワークアウトテンプレート取得テスト
        console.log('\n6. ワークアウトテンプレート取得テスト')
        const templatesResponse = await fetch(`${BASE_URL}/api/exercises/copy?limit=5`)
        console.log('Status:', templatesResponse.status)

        if (templatesResponse.status === 401) {
            console.log('❌ 認証が必要です。\n')
        } else {
            const templatesData = await templatesResponse.json()
            console.log('Response:', JSON.stringify(templatesData, null, 2))
        }

    } catch (error) {
        console.error('❌ テストエラー:', error.message)
    }

    console.log('\n🏁 テスト完了')
}

// APIエンドポイントの説明
function showAPIDocumentation() {
    console.log('📚 ワークアウトAPI ドキュメント\n')

    console.log('🏋️ ワークアウト管理:')
    console.log('GET    /api/workouts              - ワークアウト一覧取得')
    console.log('POST   /api/workouts              - ワークアウト開始')
    console.log('GET    /api/workouts/[id]         - 特定ワークアウト取得')
    console.log('PUT    /api/workouts/[id]         - ワークアウト更新・終了')
    console.log('DELETE /api/workouts/[id]         - ワークアウト削除')

    console.log('\n💪 エクササイズ管理:')
    console.log('GET    /api/exercises?workout_id=N - エクササイズ一覧取得')
    console.log('POST   /api/exercises              - エクササイズ追加')
    console.log('GET    /api/exercises/[id]         - 特定エクササイズ取得')
    console.log('PUT    /api/exercises/[id]         - エクササイズ更新')
    console.log('DELETE /api/exercises/[id]         - エクササイズ削除')

    console.log('\n🔄 エクササイズ高度な機能:')
    console.log('PUT    /api/exercises/reorder      - エクササイズ順序変更')
    console.log('PUT    /api/exercises/batch        - エクササイズバッチ更新')
    console.log('DELETE /api/exercises/batch        - エクササイズバッチ削除')
    console.log('POST   /api/exercises/copy         - エクササイズコピー')
    console.log('GET    /api/exercises/copy         - ワークアウトテンプレート取得')
    console.log('GET    /api/exercises/stats        - エクササイズ統計情報')
    console.log('POST   /api/exercises/stats        - 人気エクササイズランキング')

    console.log('\n📋 リクエスト例:')
    console.log('ワークアウト開始:')
    console.log(JSON.stringify({
        name: 'プッシュデイ',
        notes: '胸・肩・三頭筋'
    }, null, 2))

    console.log('\nエクササイズ追加:')
    console.log(JSON.stringify({
        workout_id: 1,
        exercise_name: 'ベンチプレス',
        sets: 3,
        reps: 10,
        weight: 60.0,
        rest_seconds: 90
    }, null, 2))

    console.log('\nワークアウト完了:')
    console.log(JSON.stringify({
        action: 'complete',
        notes: '良いワークアウトでした'
    }, null, 2))

    console.log('\nエクササイズ順序変更:')
    console.log(JSON.stringify({
        workout_id: 1,
        exercise_orders: [
            { exercise_id: 2 },
            { exercise_id: 1 },
            { exercise_id: 3 }
        ]
    }, null, 2))

    console.log('\nエクササイズバッチ更新:')
    console.log(JSON.stringify({
        workout_id: 1,
        exercises: [
            {
                id: 1,
                exercise_name: 'ベンチプレス',
                sets: 4,
                reps: 8,
                weight: 65.0,
                rest_seconds: 120
            }
        ]
    }, null, 2))

    console.log('\nエクササイズコピー:')
    console.log(JSON.stringify({
        source_workout_id: 1,
        target_workout_id: 2,
        exercise_ids: [1, 2]
    }, null, 2))
}

// コマンドライン引数をチェック
const args = process.argv.slice(2)
if (args.includes('--docs') || args.includes('-d')) {
    showAPIDocumentation()
} else {
    testWorkoutAPI()
}