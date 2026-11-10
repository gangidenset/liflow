# AI LIFE MANAGER Lite

日常のタスクと予定をスマートフォンで管理するアプリです。iPhone・Android 共通のコードで動作します。

## 機能

- **ホーム**: 今日の日付、今日のタスク、完了数・未完了数、進捗率
- **タスク管理**: 登録・編集・削除、完了・未完了の切り替え（タスク名、詳細・メモ、期限、優先度）
- **タスク一覧**: すべて・未完了・完了済みの切り替え、期限が近いタスクの強調、優先度の色分け
- **家計簿**: 支出・収入の記録（金額、日付、カテゴリ、メモ）と編集・削除、月ごとの支出・収入・収支、支出のカテゴリ別内訳、1 か月の支出予算と残額
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
npm run lint
```

```bash
npm test
```

`npm test` は、日付の判定、並び替えと絞り込み、タスクの状態更新、保存データの読み書きを対象にした自動テスト（Jest）を実行します。テストは `src/__tests__/` にあります。

```bash
npx expo-doctor
```

## Web 版（ホーム画面に追加して使う）

Web 版は GitHub Pages で公開します。`main` に変更が入るたびに、GitHub Actions（`.github/workflows/deploy-web.yml`）が自動でビルドして公開します。

公開 URL: https://gangidenset.github.io/liflow/

### 初回の設定（1 回だけ）

1. GitHub のリポジトリを公開（Public）にします（Settings → General → Danger Zone → Change repository visibility）。
2. Settings → Pages の「Build and deployment」で、Source を「GitHub Actions」にします。

### ホーム画面に追加する

- **iPhone**: Safari で公開 URL を開き、共有ボタン →「ホーム画面に追加」を選びます。
- **Android**: Chrome で公開 URL を開き、メニュー（⋮）→「ホーム画面に追加」または「アプリをインストール」を選びます。

追加したアイコンから開くと、ブラウザの枠なしで起動します。

### 注意点

- データはブラウザ内に保存されます。Expo Go 版や他の端末・他のブラウザとは共有されません。
- ブラウザの「サイトデータを削除」を行うと、タスクも消えます。
- オフラインでは起動できません（通信が必要です）。
- 期限の入力欄は、ブラウザ標準の日付入力になります。

### 手元でビルドする

```bash
npm run build:web
```

`dist/` に出力されます。公開先のサブパス（`/liflow`）は `app.json` の `experiments.baseUrl` と `public/index.html` で指定しています。リポジトリ名を変える場合は両方を変更してください。

## CI

プルリクエストの作成・更新時と `main` への Push 時に、GitHub Actions が lint・型チェック・自動テスト・`expo-doctor` を実行します。設定は `.github/workflows/ci.yml` にあります。

## ディレクトリ構成

```
src/
  app/          画面（Expo Router）
    (tabs)/     下部タブ（ホーム・タスク一覧）
    task-editor.tsx  タスク追加・編集（モーダル）
  __tests__/    自動テスト
  components/   共通コンポーネント
  context/      タスクの状態管理
  hooks/        共通フック
  storage/      AsyncStorage の読み書き
  theme/        色・余白・文字サイズ
  types/        型定義
  utils/        日付・並び替えなどの補助関数
```
