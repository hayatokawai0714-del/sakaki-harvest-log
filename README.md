# sakaki-harvest-log

榊収穫管理アプリです。Cloudflare Pages + Pages Functions + D1 を使い、スマホでの入力・保存・読込・編集・削除・集計・CSV出力を安定して運用することを目的にしています。

## 構成

- `docs/` - 静的サイト本体
- `functions/` - Cloudflare Pages Functions API
- `migrations/` - D1 マイグレーション
- `schema.sql` - D1 初期スキーマ
- `wrangler.toml` - Cloudflare Pages + D1 設定

## Cloudflare Pages の設定

Cloudflare Pages のプロジェクト設定は次の通りです。

- Build command: 空欄、または不要
- Build output directory: `docs`

`functions/` は Pages Functions として自動的に使われます。Worker 用の `main = "src/index.ts"` は使いません。

## D1 の作成

```bash
npx wrangler d1 create sakaki-harvest-log
```

作成後に表示される `database_id` を `wrangler.toml` の `REPLACE_WITH_D1_DATABASE_ID` に入れてください。

## migration の適用

ローカル:

```bash
npx wrangler d1 migrations apply sakaki-harvest-log --local
```

本番:

```bash
npx wrangler d1 migrations apply sakaki-harvest-log --remote
```

## ローカル実行

Pages Functions を含めて確認するには、次を使います。

```bash
npx wrangler pages dev docs
```

D1 を付ける場合は、`wrangler.toml` の設定を使うか、必要に応じて D1 バインドを追加してください。

## デプロイ

Cloudflare Pages に GitHub リポジトリを接続している場合は、`main` ブランチへ push すると自動デプロイされます。

手動で確認したい場合は、Pages としてデプロイしてください。

```bash
npx wrangler pages deploy docs
```

Worker としての `wrangler deploy` は使わず、Pages 用のデプロイを使います。

## Secret の設定

将来の OpenAI 連携などで API キーが必要になった場合は、GitHub に入れず Cloudflare Secret に保存します。

```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name sakaki-harvest-log
```

## 動作確認

1. `docs/` を Cloudflare Pages にデプロイする
2. アプリ画面で新規入力を保存する
3. D1 にレコードが追加されることを確認する
4. 読込・編集・削除・集計・CSV出力が動くことを確認する

## 変更に関するメモ

- Google Sheets 連携はバックアップ用途として残しています
- OCR は今回は保留です
- 秘密情報は GitHub に保存しないでください

CSV export uses BOM-prefixed UTF-8 for Excel.
If Excel still garbles text, import via Data -> From Text/CSV and choose 65001 (UTF-8).

## Agrinote CSV to JSON
- Convert Agrinote CSV into the app import JSON format with:
  `node scripts/convert_agrinote_to_json.js input.csv agrinote_import.json`
