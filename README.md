# sakaki-harvest-log

GitHub Pages 上で動く、榊の収穫管理（入力・集計・ログ閲覧）アプリです。

- 通常時: Google スプレッドシート（Apps Script経由）へ保存
- 通信失敗時: localStorage に退避（バックアップ）

## 使い方（アプリ）
- `docs/index.html` をブラウザで開く（GitHub Pages 推奨）
- 日付/圃場/規格/入力者/重量一覧/メモを入力して保存
- 写真を撮影して OCR で重量候補を読み取り、候補を修正して重量一覧へ反映できる
- `Sheets読込` でスプレッドシート保存済みログを取得（任意）
- CSV/JSON の出力、JSON取込（localStorage向け）

## OCR機能
- `写真を選択 / 撮影` からホワイトボード画像を選ぶ
- `読み取る` を押して OCR を実行する
- `読み取った重量候補` で数値を手動修正・削除する
- `重量一覧へ反映` でフォームの重量一覧に入れる
- OCR はブラウザ内で動く Tesseract.js を使用するため、APIキーは不要
- OCR 前処理として画像縮小・グレースケール化・コントラスト強調・白黒化を行う
- OCR 候補は `OCR値 / 補正値 / 信頼度` を確認してから反映する
- 妥当値は 0.50～5.00kg を目安にし、範囲外は警告表示する

## Google Apps Script（スプレッドシート連携）

### 1) スプレッドシートを用意
- Google スプレッドシートを作成（名前: **榊収穫管理DB**）
- シート名は仮で **シート1**
- 1行目（ヘッダ）を次の列で作成:

```
id
date
field
grade
weights
total_weight
user
memo
created_at
updated_at
```

### 2) Apps Script を作成
- スプレッドシートで「拡張機能」→「Apps Script」
- `gas/Code.gs` の内容を貼り付け
- `SPREADSHEET_ID` に「榊収穫管理DB」のスプレッドシートIDを設定する
- `SHEET_NAME` が実際のシート名と一致していることを確認（初期: `シート1`）

### 3) Webアプリとしてデプロイ
- 「デプロイ」→「新しいデプロイ」
- 種類: **ウェブアプリ**
- 実行ユーザー: **自分**
- アクセスできるユーザー: 運用に合わせて選択（テストは「全員」推奨）
- デプロイ後に表示される **WebアプリURL** を控える

### 4) アプリ側にURL設定
次のいずれかで Apps Script URL を設定します（秘密情報は不要です）。

- 推奨: アプリの `設定` → 「Apps Script WebアプリURL」に貼り付け（端末ごとにlocalStorage保存）
- もしくは: `docs/app.js` の `GAS_ENDPOINT` を **既定値** として設定（全端末で共通URLにしたい場合）

※スマホでも `GAS_ENDPOINT` を設定していれば、端末ごとの設定が無くてもSheets保存できます。端末別に異なるURLを使いたい場合のみ `設定` で上書きしてください。

### iPhone Safari 対策
- iPhone Safari では `fetch` が `TypeError: Load failed` になりやすいため、保存は hidden iframe + form 送信で行います。
- `docs/app.js` は `payload` hidden input を使って Apps Script に送信します。
- Apps Script 側の `doPost` は `e.parameter.payload` と `e.postData.contents` の両方に対応しています。

## 動作確認手順

### A. Sheets保存の確認
1. アプリを開く
2. `設定` で Apps Script WebアプリURL を設定
3. 入力して `保存`
4. 「Sheets保存しました」と表示される
5. スプレッドシートに行が追加されている

### B. 通信失敗時の退避確認
1. `設定` のURLを空にする（または無効なURLを入れる）
2. 入力して `保存`
3. 「Sheets保存失敗 → localStorageに退避しました」と表示される
4. 一覧が localStorage 表示で増えている

### C. Sheets読込の確認（任意）
1. `Sheets読込`
2. 「Sheets読み込み完了: n件」と表示される

### D. OCRの確認
1. `写真を選択 / 撮影` からホワイトボード画像を選ぶ
2. `読み取る` を押す
3. `読み取った重量候補` に `OCR値 / 補正値 / 信頼度` が表示される
4. 候補を修正して `重量一覧へ反映` を押す
5. 合計重量が自動計算される

## GitHub Pages
GitHub Pages を使う場合は、Pages の Source を `main` ブランチの `/docs` に設定してください。

