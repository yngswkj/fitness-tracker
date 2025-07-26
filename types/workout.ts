// ワークアウト関連の型定義

export interface Workout {
    id: number
    user_id: number
    name: string
    started_at: string
    ended_at?: string | null
    notes?: string | null
    created_at: string
    exercise_count?: number
    duration_minutes?: number | null
    exercises?: Exercise[]
}

export interface Exercise {
    id: number
    workout_id: number
    exercise_name: string
    sets: number
    reps: number
    weight?: number | null
    rest_seconds?: number | null
    order_index: number
    created_at: string
}

export interface WorkoutSummary {
    week_start: string
    workout_count: number
    avg_duration_minutes?: number | null
    completed_workouts: number
}

export interface CreateWorkoutRequest {
    name: string
    notes?: string
    started_at?: string
}

export interface UpdateWorkoutRequest {
    name?: string
    ended_at?: string
    notes?: string
    action?: 'complete' | 'update'
}

export interface CreateExerciseRequest {
    workout_id: number
    exercise_name: string
    sets: number
    reps: number
    weight?: number | null
    rest_seconds?: number | null
    order_index?: number
}

export interface UpdateExerciseRequest {
    exercise_name?: string
    sets?: number
    reps?: number
    weight?: number | null
    rest_seconds?: number | null
    order_index?: number
}

export interface WorkoutResponse {
    workouts: Workout[]
    summary: WorkoutSummary[]
    pagination: {
        limit: number
        offset: number
        hasMore: boolean
    }
}

export interface WorkoutDetailResponse {
    workout: Workout
}

export interface ExerciseResponse {
    exercises: Exercise[]
}

// エクササイズ順序変更リクエスト
export interface ReorderExercisesRequest {
    workout_id: number
    exercise_orders: {
        exercise_id: number
    }[]
}

// エクササイズバッチ更新リクエスト
export interface BatchUpdateExercisesRequest {
    workout_id: number
    exercises: {
        id: number
        exercise_name: string
        sets: number
        reps: number
        weight?: number | null
        rest_seconds?: number | null
    }[]
}

// エクササイズコピーリクエスト
export interface CopyExercisesRequest {
    source_workout_id: number
    target_workout_id: number
    exercise_ids?: number[]
}

// ワークアウトテンプレート
export interface WorkoutTemplate {
    id: number
    name: string
    started_at: string
    exercise_count: number
    exercises: Exercise[]
}

// エクササイズ統計
export interface ExerciseStats {
    exercise_name: string
    period_days: number
    history: ExerciseHistory[]
    stats: {
        total_workouts: number
        total_sets: number
        total_reps: number
        max_weight: number | null
        avg_weight: number | null
        max_reps: number
        avg_reps: number
        progress_trend: {
            weight_change_percent: number
            trend: 'improving' | 'declining' | 'stable'
        } | null
    }
    personal_records: {
        max_weight_pr: number | null
        max_reps_pr: number | null
        max_volume_pr: number | null
    }
}

// エクササイズ履歴
export interface ExerciseHistory {
    id: number
    sets: number
    reps: number
    weight: number | null
    rest_seconds: number | null
    workout_date: string
    workout_name: string
    workout_id: number
}

// 人気エクササイズ
export interface PopularExercise {
    exercise_name: string
    workout_count: number
    total_sets: number
    total_volume: number
    avg_weight: number | null
    max_weight: number | null
    first_performed: string
    last_performed: string
}

export interface ApiResponse<T = any> {
    message?: string
    error?: string
    workout?: Workout
    exercise?: Exercise
    workouts?: Workout[]
    exercises?: Exercise[]
    summary?: WorkoutSummary[]
    pagination?: {
        limit: number
        offset: number
        hasMore: boolean
    }
    copied_exercises?: Exercise[]
    deleted_count?: number
    workout_templates?: WorkoutTemplate[]
    exercise_stats?: ExerciseStats
    popular_exercises?: PopularExercise[]
}