import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

// 食事記録の更新
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const mealId = parseInt(params.id)
        if (isNaN(mealId)) {
            return NextResponse.json({ error: '無効なIDです' }, { status: 400 })
        }

        // 食事記録の存在確認と所有者チェック
        const { rows: existingMeals } = await sql`
      SELECT id FROM meals WHERE id = ${mealId} AND user_id = ${session.user.id}
    `

        if (existingMeals.length === 0) {
            return NextResponse.json(
                { error: '食事記録が見つかりません' },
                { status: 404 }
            )
        }

        const body = await request.json()
        const {
            meal_type,
            food_name,
            quantity,
            unit,
            calories,
            protein,
            carbs,
            fat,
            recorded_at
        } = body

        // バリデーション
        if (meal_type && !['breakfast', 'lunch', 'dinner', 'snack'].includes(meal_type)) {
            return NextResponse.json(
                { error: '無効な食事タイプです' },
                { status: 400 }
            )
        }

        if (quantity !== undefined && quantity <= 0) {
            return NextResponse.json(
                { error: '分量は0より大きい値を入力してください' },
                { status: 400 }
            )
        }

        // 更新クエリの構築
        const updateFields = []
        const updateValues = []
        let paramIndex = 1

        if (meal_type !== undefined) {
            updateFields.push(`meal_type = $${paramIndex++}`)
            updateValues.push(meal_type)
        }
        if (food_name !== undefined) {
            updateFields.push(`food_name = $${paramIndex++}`)
            updateValues.push(food_name)
        }
        if (quantity !== undefined) {
            updateFields.push(`quantity = $${paramIndex++}`)
            updateValues.push(quantity)
        }
        if (unit !== undefined) {
            updateFields.push(`unit = $${paramIndex++}`)
            updateValues.push(unit)
        }
        if (calories !== undefined) {
            updateFields.push(`calories = $${paramIndex++}`)
            updateValues.push(calories)
        }
        if (protein !== undefined) {
            updateFields.push(`protein = $${paramIndex++}`)
            updateValues.push(protein)
        }
        if (carbs !== undefined) {
            updateFields.push(`carbs = $${paramIndex++}`)
            updateValues.push(carbs)
        }
        if (fat !== undefined) {
            updateFields.push(`fat = $${paramIndex++}`)
            updateValues.push(fat)
        }
        if (recorded_at !== undefined) {
            updateFields.push(`recorded_at = $${paramIndex++}`)
            updateValues.push(recorded_at)
        }

        if (updateFields.length === 0) {
            return NextResponse.json(
                { error: '更新するフィールドがありません' },
                { status: 400 }
            )
        }

        updateValues.push(mealId, session.user.id)

        const query = `
      UPDATE meals 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING id, meal_type, food_name, quantity, unit, calories, protein, carbs, fat, recorded_at, created_at
    `

        const { rows } = await sql.query(query, updateValues)

        return NextResponse.json({
            message: '食事記録を更新しました',
            meal: rows[0]
        })

    } catch (error) {
        console.error('Update meal error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// 食事記録の削除
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const mealId = parseInt(params.id)
        if (isNaN(mealId)) {
            return NextResponse.json({ error: '無効なIDです' }, { status: 400 })
        }

        // 食事記録の存在確認と削除
        const { rows } = await sql`
      DELETE FROM meals 
      WHERE id = ${mealId} AND user_id = ${session.user.id}
      RETURNING id
    `

        if (rows.length === 0) {
            return NextResponse.json(
                { error: '食事記録が見つかりません' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            message: '食事記録を削除しました',
            deleted_id: rows[0].id
        })

    } catch (error) {
        console.error('Delete meal error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}