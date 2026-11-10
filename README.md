# AI LIFE MANAGER Lite

日常のタスクと予定をスマートフォンで管理するアプリです。iPhone・Android 共通のコードで動作します。

## 機能

- **ホーム**: 今日の日付、今日のタスク、完了数・未完了数、進捗率
- **タスク管理**: 登録・編集・削除、完了・未完了の切り替え（タスク名、詳細・メモ、期限、優先度）
- **タスク一覧**: すべて・未完了・完了済みの切り替え、期限が近いタスクの強調、優先度の色分け
- **データ保存**: 端末内（AsyncStorage）に保存し、アプリを再起動しても保持

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
  context/      タスクの状態管理
  hooks/        共通フック
  storage/      AsyncStorage の読み書き
  theme/        色・余白・文字サイズ
  types/        型定義
  utils/        日付・並び替えなどの補助関数
```
