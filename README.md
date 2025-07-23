# Fitness Tracking App

筋トレ継続のための健康管理WEBアプリケーション

## 機能

- 食事記録と栄養価計算
- Fitbit連携による活動データ同期
- ワークアウト記録と進捗追跡
- 統合ダッシュボード
- PWA対応（オフライン機能）

## 技術スタック

- **フロントエンド**: Next.js 14, React, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes, Vercel Edge Functions
- **データベース**: Vercel Postgres
- **認証**: NextAuth.js
- **デプロイ**: Vercel

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example`を`.env.local`にコピーして設定:

```bash
cp .env.local.example .env.local
```

### 3. データベースの初期化

```bash
npm run db:setup
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

## データベーススキーマ

### users テーブル
- ユーザー情報の管理

### meals テーブル
- 食事記録の保存

### workouts テーブル
- ワークアウトセッションの記録

### exercises テーブル
- 個別エクササイズの詳細

### fitbit_data テーブル
- Fitbitから同期されたデータ

## API エンドポイント

- `GET /api/dashboard/summary` - ダッシュボードサマリー
- `POST /api/meals` - 食事記録の作成
- `GET /api/meals` - 食事記録の取得
- `POST /api/workouts` - ワークアウト記録の作成

## デプロイ

Vercelへのデプロイ:

```bash
vercel --prod
```

## ライセンス

MIT