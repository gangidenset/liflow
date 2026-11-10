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

ターミナルに QR コードが表示されます。終了するときは `Ctrl + C` を押します。

## 実機確認方法（Expo Go）

事前に、PC とスマートフォンを同じ Wi-Fi に接続してください。Expo Go は最新版に更新しておきます（このアプリは Expo SDK 58 を使用しています）。

### iPhone

1. App Store で「Expo Go」をインストールします。
2. PC で `npx expo start` を実行します。
3. iPhone 標準のカメラアプリで、ターミナルの QR コードを読み取ります。
4. 表示された通知をタップすると、Expo Go でアプリが開きます。

### Android

1. Google Play で「Expo Go」をインストールします。
2. PC で `npx expo start` を実行します。
3. Expo Go を開き、「Scan QR code」でターミナルの QR コードを読み取ります。

### 実機で確認する項目

- タスクの追加・編集・削除・完了切り替えができる
- 期限の日付を選択・解除できる（iPhone はカレンダー、Android は日付ダイアログ）
- Expo Go を完全に終了して開き直しても、タスクが残っている
- 文字入力中にキーボードで入力欄や保存ボタンが隠れない
- ノッチやホームバーに表示が重ならない

## うまく動かないとき

| 症状 | 対処 |
|---|---|
| QR コードを読んでも接続できない | PC とスマートフォンが同じ Wi-Fi か確認します。改善しない場合は `npx expo start --tunnel` で起動します。 |
| 「Project is incompatible with this version of Expo Go」と表示される | Expo Go を最新版に更新します。 |
| 変更が反映されない、原因不明のエラーが出る | `npx expo start --clear` でキャッシュを消して起動します。 |
| 依存関係のエラーが出る | `node_modules` を削除して `npm install` をやり直し、`npx expo-doctor` で確認します。 |
| PC のファイアウォールで接続が遮断される | Node.js の通信を許可するか、`--tunnel` で起動します。 |

パッケージを追加するときは、SDK に合ったバージョンが入るよう `npm install` ではなく `npx expo install <パッケージ名>` を使います。

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
