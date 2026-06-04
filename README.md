# sakaki-harvest-log

榊の収穫管理アプリです。Cloudflare Pages Functions + D1 を主保存先にして、スマホで使いやすい入力・集計・CSV出力を安定運用する構成に移行しています。

- 主保存先: Cloudflare D1
- 既存UI: なるべく維持
- Google Sheets: 既存連携は残す
- OCR: 保留
- OpenAI API: 未実装

## できること
- 日付 / 圃場 / 規格 / 重量一覧 / 合計重量 / 担当者 / メモの入力
- 保存、読込、編集、削除
- 月別・圃場別・規格別の集計
- CSV出力
- localStorage へのバックアップ

## 構成
- `docs/` - 静的UI
- `functions/` - Cloudflare Pages Functions API
- `migrations/` - D1 マイグレーション
- `schema.sql` - 初期スキーマ
- `wrangler.toml` - Cloudflare 設定

## Cloudflare セットアップ

### 1. Cloudflare アカウント作成
1. Cloudflare にログインします。
2. `Workers & Pages` を開きます。

### 2. GitHub 連携
1. `Pages` から `Create a project` を選びます。
2. GitHub リポジトリ `sakaki-harvest-log` を接続します。
3. ビルド設定は `docs` を公開ディレクトリとして使います。

### 3. D1 作成
`wrangler` が入っている前提で、次のコマンドを実行します。

```bash
npx wrangler d1 create sakaki-harvest-log
```

作成後に表示される `database_id` を `wrangler.toml` の `REPLACE_WITH_D1_DATABASE_ID` に設定します。

### 4. migration 適用
ローカルにプレビューを作る場合:

```bash
npx wrangler d1 migrations apply sakaki-harvest-log --local
```

本番 D1 に反映する場合:

```bash
npx wrangler d1 migrations apply sakaki-harvest-log --remote
```

### 5. ローカル実行
Pages Functions を含めてローカルで動かす例です。

```bash
npx wrangler pages dev docs
```

D1 を紐づける例:

```bash
npx wrangler pages dev docs --d1 DB=<database_id>
```

### 6. デプロイ
Cloudflare Pages に GitHub を接続している場合は、`main` ブランチへ push すると自動デプロイされます。

手動デプロイする場合の例:

```bash
npx wrangler pages deploy docs
```

## Secret 設定
将来の OpenAI 連携用に、API キーは GitHub に置かず Cloudflare の Secret に保存します。

Pages の Secret を追加する例:

```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name sakaki-harvest-log
```

ローカル開発用に `.dev.vars` を使う場合は、Git に入れないでください。`.gitignore` に登録済みです。

## 使い方（アプリ）
- `docs/index.html` を Cloudflare Pages で開く
- 日付 / 圃場 / 規格 / 重量一覧 / メモ を入力して保存
- `D1読込` で保存済みログを再読込
- `CSV出力` でアグリノート取り込み用 CSV を出力
- `JSON取込` は localStorage バックアップの取り込み用

## CSV 出力
CSV は後からフォーマットを変えやすいように、コード内のエクスポート定義をまとめています。現在は下記列で出力します。

`id,date,field,grade,weights,total_weight,user,memo,created_at,updated_at`

## 動作確認
### 保存
1. フォームに値を入れます。
2. `保存` を押します。
3. D1 にレコードが追加されます。

### 読込
1. `D1読込` を押します。
2. 一覧に保存済みレコードが表示されます。

### 編集 / 削除
1. 一覧の `編集` / `削除` を使います。
2. D1 と localStorage のバックアップが更新されます。

### CSV
1. `CSV出力` を押します。
2. ブラウザで CSV がダウンロードされます。

## Google Sheets について
Google Sheets 連携のコードは残していますが、主保存先は Cloudflare D1 です。既存連携をバックアップ用途で使う場合は、設定画面の URL をそのまま利用できます。

## OCR について
OCR は今回は保留です。コードは残していますが、主機能からは切り離しています。
