# AI LIFE MANAGER Lite

日常のタスクと予定をスマートフォンで管理するアプリです。iPhone・Android 共通のコードで動作します。

> 現在は開発中です。画面構成と画面遷移まで実装済みで、タスクの登録・保存機能はこれから実装します。

## 開発環境

| 項目 | バージョン |
|---|---|
| Node.js | 22 系 |
| npm | 10 系 |
| Expo SDK | 58 |
| React Native | 0.88 |
| TypeScript | 6 系 |

画面遷移には Expo Router を使用しています。画面は `src/app/` 配下に置きます。

## セットアップ

```bash
git clone https://github.com/gangidenset/liflow.git
```

```bash
cd liflow
```

```bash
npm install
```

## 起動方法

```bash
npx expo start
```

ターミナルに QR コードが表示されます。

## 実機確認方法（Expo Go）

PC とスマートフォンを同じ Wi-Fi に接続してください。

- **iPhone**: App Store から「Expo Go」をインストールし、標準のカメラアプリで QR コードを読み取ります。
- **Android**: Google Play から「Expo Go」をインストールし、Expo Go 内の「Scan QR code」で読み取ります。

同じ Wi-Fi に接続できない場合は、トンネル接続で起動します。

```bash
npx expo start --tunnel
```

## 開発用コマンド

```bash
npm run typecheck
```

```bash
npx expo-doctor
```

## ディレクトリ構成

```
src/
  app/          画面（Expo Router）
    (tabs)/     下部タブ（ホーム・タスク一覧）
    task-editor.tsx  タスク追加・編集（モーダル）
  components/   共通コンポーネント
  theme/        色・余白・文字サイズ
  utils/        日付などの補助関数
```
