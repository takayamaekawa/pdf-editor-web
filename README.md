# PDF Editor Pro

Cloudflare Workers × Honoで動作する次世代PDFエディタ

## 🚀 特徴

- ⚡ **Edge Computing**: Cloudflare Workersで高速処理
- 🔒 **Enterprise Security**: セキュアなファイル処理
- 🌍 **Global CDN**: 世界中どこからでも高速アクセス
- 📱 **レスポンシブデザイン**: モバイル・デスクトップ対応
- 🎨 **リアルタイムプレビュー**: PDF.jsによる高品質表示

## 📋 機能

### 📁 PDFアップロード
- ドラッグ&ドロップ対応
- 最大50MBまでのファイルサポート
- Cloudflare R2での安全なストレージ

### ✂️ ページ抽出
- 柔軟なページ範囲指定
- 複数範囲の同時指定可能
- 例: `1,3,5-7,10-15,20`

### 🔄 ページ回転
- 90°, 180°, 270°回転
- リアルタイムプレビュー
- キーボードショートカット対応

## 🛠️ 技術スタック

- **フレームワーク**: Hono
- **ランタイム**: Cloudflare Workers
- **ストレージ**: Cloudflare R2 + KV
- **PDFライブラリ**: pdf-lib, PDF.js
- **UI**: バニラJS + CSS3

## 🚀 セットアップ

### 前提条件
- Node.js 18以上
- Cloudflare アカウント
- Wrangler CLI

### インストール

```bash
# リポジトリクローン
git clone <repository-url>
cd pdf-editor-web

# 依存関係インストール
npm install

# Cloudflare認証
npx wrangler login
```

### 環境設定

1. **R2バケット作成**
```bash
npx wrangler r2 bucket create pdf-editor-files
```

2. **KVネームスペース作成**
```bash
npx wrangler kv:namespace create "PDF_METADATA"
```

3. **wrangler.toml設定**
```toml
name = "pdf-editor-web"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "pdf_editor_files"
bucket_name = "pdf-editor-files"

[[kv_namespaces]]
binding = "PDF_METADATA"
id = "your-kv-namespace-id"

[vars]
ENVIRONMENT = "production"
```

### 開発環境

```bash
# 開発サーバー起動
npm run dev

# TypeScript型チェック
npm run types

# ローカルデプロイ
npm run deploy
```

## 📖 使い方

### 1. PDFアップロード
1. ファイル選択ボタンをクリックまたはドラッグ&ドロップ
2. PDFファイルを選択（最大50MB）
3. アップロード完了後、各タブが有効化

### 2. ページ抽出
1. 「ページ抽出」タブを選択
2. 抽出したいページ番号を入力
   - 単一ページ: `1,3,5`
   - 範囲指定: `1-5`
   - 複合指定: `1,3,5-7,10`
3. 「ページを抽出」ボタンをクリック
4. ダウンロードリンクから新しいPDFを取得

### 3. ページ回転
1. 「ページ回転」タブを選択
2. 左側でページプレビューを確認
3. 各ページの回転ボタンをクリック
   - ↻ 90°右回転
   - ↕ 180°回転
   - ↺ 270°右回転
4. 「回転を適用」ボタンでPDF生成
5. ダウンロードリンクから回転済みPDFを取得

### キーボードショートカット
- `←` 左回転（270°）
- `→` 右回転（90°）
- `↑` 180°回転
- `Enter/Space` ページ選択

## 🏗️ アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   フロントエンド   │    │ Cloudflare       │    │ ストレージ        │
│   (HTML/JS)     │───▶│ Workers         │───▶│ R2 + KV        │
│   PDF.js        │    │ Hono            │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### ファイル構造
```
pdf-editor-web/
├── src/
│   ├── index.ts          # メインアプリケーション
│   └── dev-index.ts      # 開発版（メモリストレージ）
├── wrangler.toml         # Cloudflare設定
├── package.json
└── README.md
```

## 🔧 開発

### 本番環境との違い
- **本番**: Cloudflare R2 + KV ストレージ
- **開発**: メモリストレージ（再起動で消去）

### デバッグ
```bash
# ブラウザの開発者ツールでコンソールログを確認
# PDF.js関連のエラーやアップロードログが表示される
```

### 型安全性
```typescript
type Bindings = {
  pdf_editor_files: R2Bucket;
  PDF_METADATA: KVNamespace;
};

type Variables = {
  uploadId: string;
};
```

## 📊 API エンドポイント

| エンドポイント | メソッド | 説明 |
|-------------|---------|------|
| `/` | GET | メインページ |
| `/upload` | POST | PDFアップロード |
| `/extract` | POST | ページ抽出 |
| `/rotate` | POST | ページ回転 |
| `/download/:id` | GET | ファイルダウンロード |
| `/files` | GET | アップロード済みファイル一覧 |
| `/file/:id` | DELETE | ファイル削除 |
| `/health` | GET | ヘルスチェック |

## 🔒 セキュリティ

- ファイルサイズ制限（50MB）
- PDFファイルタイプ検証
- 24時間後の自動ファイル削除
- CORS設定による適切なアクセス制御

## 📈 パフォーマンス

- **エッジコンピューティング**: 最寄りのCloudflareエッジで処理
- **CDN配信**: 静的アセットの高速配信
- **非同期処理**: UI をブロックしない設計
- **プログレッシブローディング**: 段階的なコンテンツ表示

## 🐛 トラブルシューティング

### よくある問題

1. **ファイル選択ボタンが動作しない**
   - ブラウザの開発者ツールでJavaScriptエラーを確認
   - PDF.jsライブラリの読み込み状況を確認

2. **PDFプレビューが表示されない**
   - PDF.jsのWorkerファイルが正常に読み込まれているか確認
   - ネットワーク接続とCDNアクセスを確認

3. **アップロードが失敗する**
   - ファイルサイズが50MB以下か確認
   - PDFファイル形式か確認
   - Cloudflare R2の設定を確認

## 🤝 コントリビューション

1. Forkしてブランチ作成
2. 機能追加・バグ修正
3. テスト実行
4. Pull Request作成

## 📄 ライセンス

[MIT License](LICENSE)

## 🔗 関連リンク

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Hono Framework](https://hono.dev/)
- [PDF.js](https://mozilla.github.io/pdf.js/)
- [pdf-lib](https://pdf-lib.js.org/)

---

**🚀 Powered by Cloudflare Edge Computing**
