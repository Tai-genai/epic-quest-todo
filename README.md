# Epic Quest Todo 🎮

ゲーム感覚でタスク管理ができるモチベーションアップTodoアプリ

![Epic Quest Todo](https://img.shields.io/badge/Epic%20Quest-Todo%20App-purple)
![Node.js](https://img.shields.io/badge/Node.js-v20.19.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🌟 特徴

### ゲーミフィケーション要素
- **レベルシステム** - タスク完了でXPを獲得してレベルアップ
- **実績システム** - マイルストーンを達成して実績を解除
- **難易度設定** - Easy(5XP), Medium(10XP), Hard(20XP), Epic(50XP)
- **ストリーク機能** - 連続ログイン日数を記録

### デザイン
- **ダークモード** - 目に優しい黒ベースのデザイン
- **グラスモーフィズム** - 透明感のあるモダンなUI
- **ネオングロー効果** - テキストが光る演出
- **パーティクルエフェクト** - タスク完了時の視覚的フィードバック
- **レスポンシブデザイン** - PC・スマホ対応

## 🚀 技術スタック

### フロントエンド
- HTML5
- CSS3 (Tailwind CSS)
- JavaScript (Vanilla)
- Font Awesome Icons

### バックエンド
- Node.js
- Express.js
- SQLite3
- JWT認証

## 📦 インストール方法

1. リポジトリをクローン
```bash
git clone https://github.com/yourusername/epic-quest-todo.git
cd epic-quest-todo
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定
```bash
cp .env.example .env
# .envファイルを編集してJWT_SECRETを設定
```

4. アプリケーションを起動
```bash
npm run dev  # 開発モード
# または
npm run build && npm start  # 本番モード
```

5. ブラウザでアクセス
```
http://localhost:9999
```

## 🎮 使い方

1. **アカウント作成** - 「Create Account」から新規登録
2. **ログイン** - ユーザー名またはメールアドレスでログイン
3. **タスク追加** - 「New Quest」ボタンでタスクを作成
4. **難易度設定** - タスクの難易度に応じてXPが変動
5. **タスク完了** - チェックマークでタスクを完了してXPを獲得
6. **レベルアップ** - 100XPごとにレベルアップ
7. **実績解除** - 条件を満たして実績を獲得

## 📱 スクリーンショット

### ログイン画面
- グラスモーフィズムを使用したモダンなデザイン
- ネオングロー効果のタイトル

### ダッシュボード
- ユーザーステータス表示（レベル、XP、ストリーク）
- アクティブなタスク一覧
- 解除済み実績の表示

### タスク管理
- 優先度別の色分け（Low: 緑, Medium: 青, High: 黄, Critical: 赤）
- 難易度バッジ表示
- 完了時のパーティクルエフェクト

## 🛠️ 開発

### ディレクトリ構造
```
epic-quest-todo/
├── client/
│   └── public/
│       ├── index.html
│       └── app.js
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── index.ts
│   └── app.js
├── package.json
├── tsconfig.json
└── README.md
```

### スクリプト
- `npm run dev` - 開発サーバー起動（nodemon使用）
- `npm run build` - TypeScriptをビルド
- `npm start` - 本番サーバー起動

## 🤝 コントリビューション

プルリクエストを歓迎します！大きな変更の場合は、まずissueを作成して変更内容を議論してください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- Tailwind CSS - スタイリングフレームワーク
- Font Awesome - アイコン
- SQLite - データベース

---

Made with ❤️ and 🎮 by [Your Name]
