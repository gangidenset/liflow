# クラウド同期（Supabase）の準備手順

ログインと複数端末での同期を使うための準備です。作業は 1 回だけで、20 分ほどかかります。

この準備をしなくても、アプリはこれまでどおり端末内だけで動きます。

## 前提

- Supabase の無料プランを使います（2026 年 11 月時点で 0 円、データベース 500 MB、プロジェクト 2 つまで）。
- **無料プランでは、1 週間使われないとプロジェクトが一時停止されます。** 停止中もアプリは端末内のデータで使え、同期だけが止まります。Supabase の管理画面から再開できます。
- ここで扱うのは「公開して問題のない値」だけです。管理用の **secret key（`sb_secret_` で始まるもの）は、どこにも貼り付けたり書いたりしないでください。**

## 1. アカウントとプロジェクトを作る

1. https://supabase.com/dashboard を開き、アカウントを作成します（メールアドレスまたは GitHub アカウント）。
2. 「New project」でプロジェクトを作ります。
   - Name: 例 `liflow`
   - Database Password: 自動生成で構いません（アプリでは使いません。必要なら控えておきます）
   - Region: **Northeast Asia (Tokyo)**
3. 作成が終わるまで数分待ちます。

## 2. テーブルを作る

1. 左のメニューの **SQL Editor** を開きます。
2. このリポジトリの [`supabase/schema.sql`](../supabase/schema.sql) の内容をすべて貼り付けて、**Run** を押します。
3. 「Success. No rows returned」と出れば完了です。

何度実行しても同じ結果になるので、失敗したときはそのままやり直して構いません。

## 3. 認証の設定

左のメニューの **Authentication** を開きます。

1. **URL Configuration**
   - Site URL: `https://gangidenset.github.io/liflow/`
   - Redirect URLs に次の 2 つを追加:
     - `https://gangidenset.github.io/liflow/`
     - `https://gangidenset.github.io/liflow/reset-password`
2. **Sign In / Providers** の Email が有効（Enabled）になっていることを確認します。「Confirm email」は有効のままにします（登録時に確認メールが届きます）。

確認メール・パスワード再設定メールのリンクは、Web 版のアプリで開きます。

## 4. 接続情報を確認する

プロジェクトの画面上部の **Connect**（または Project Settings → API Keys）で、次の 2 つを確認します。

| 名前 | 形 |
|---|---|
| Project URL | `https://xxxxxxxx.supabase.co` |
| Publishable key | `sb_publishable_...` |

## 5. Web 版に接続情報を設定する

1. GitHub のリポジトリの **Settings → Secrets and variables → Actions** を開きます。
2. **Variables** タブ（Secrets ではありません）で **New repository variable** を押し、2 つ登録します。

| Name | Value |
|---|---|
| `SUPABASE_URL` | 手順 4 の Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | 手順 4 の Publishable key |

3. **Actions** タブの「Deploy web」を開き、**Run workflow** で公開し直します。

## 6. 手元の開発環境（Expo Go）に設定する

リポジトリのフォルダで `.env.example` を `.env.local` という名前でコピーし、手順 4 の値を書き込みます。

```bash
cp .env.example .env.local
```

`.env.local` は Git の管理対象外なので、コミットされません。設定後に `npx expo start --clear` で起動し直すと、設定タブにログインのボタンが表示されます。

## うまくいかないとき

| 症状 | 確認すること |
|---|---|
| 設定タブにログインのボタンが出ない | 接続情報が設定されているか。設定後に起動し直したか（Web 版は公開し直したか） |
| 確認メールが届かない | 迷惑メールフォルダ。無料プランのメール送信は回数に上限があるので、時間をおいて再送 |
| 確認メールのリンクを開くとエラーになる | 手順 3 の Site URL と Redirect URLs |
| 「同期できませんでした」と出続ける | プロジェクトが一時停止されていないか（管理画面で再開）。手順 2 の SQL を実行したか |
