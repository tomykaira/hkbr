# お題交換 (hkbr)

参加者がお題を1つずつ出し合い、締め切り後に「自分以外の誰かのお題」がランダムに1つ割り当てられる企画ツール。
ユーザ登録不要（ブラウザの Cookie セッションで識別）。

Cloudflare Workers（Static Assets + Hono API）と D1 で動作し、無料枠内で運用できます。

## 仕様

- **企画を開始する**: タイトル・説明・お題提出締め切り・作品提出締め切り（任意）を設定。参加用 URL `/p/<企画ID>` を共有する
- **企画に参加する**: 企画ページでニックネーム（任意）とお題を送信すると参加済み。トップ画面から URL / ID を入力しても開ける
- **編集**: 主催者のみ。お題締切前はすべて編集可、締切後は作品提出締め切りのみ編集可。参加者は締切前ならお題・ニックネームの修正と参加取り消しが可能
- **割当**: お題締切後に最初に企画ページへアクセスされた時点で実行。全お題がちょうど1回ずつ使われ、誰も自分のお題には当たらない（完全順列を一様に抽選）。参加者が2人未満なら割当なし
- **公開範囲**: 参加者一覧（ニックネーム）は主催者のみ閲覧可。各参加者は自分に割り当てられたお題のみ閲覧可。主催者は「全員の割当を見る」を押したときだけ全体を表示
- **セッション移行**: 「セッション移行」画面で秘密のトークンを発行し、別ブラウザで入力すると同じユーザとして使える。再発行で古いトークンは無効になる

## 構成

| パス | 内容 |
| --- | --- |
| `worker/` | Hono 製 API（`/api/*`）。`assign.ts` が割当ロジック |
| `src/` | React SPA |
| `shared/api.ts` | API の型（Worker と SPA で共有） |
| `migrations/` | D1 のスキーマ |

## ローカル開発

```sh
npm install
npm run db:migrate:local   # ローカル D1 にスキーマ作成
npm run dev                # http://127.0.0.1:5173
npm test                   # 割当ロジックのユニットテスト
npm run typecheck
```

## デプロイ（Cloudflare Workers Builds）

初回のみ:

1. D1 データベースを作成し、表示された `database_id` を `wrangler.jsonc` に書き込んでコミットする
   ```sh
   npx wrangler login
   npx wrangler d1 create hkbr
   ```
2. Cloudflare ダッシュボード → Workers & Pages → Create → **Import a repository** で GitHub リポジトリを選択
   - Build command: `npm run build`
   - Deploy command: `npx wrangler d1 migrations apply hkbr --remote && npx wrangler deploy`
3. 以降は `main` に push すると自動でマイグレーションとデプロイが行われる

手元から直接デプロイする場合は `npm run deploy`。

## 無料枠について

Workers Free（1日10万リクエスト）、D1 Free（1日500万行読み取り・10万行書き込み、5GB）、Workers Builds Free の範囲で動作します。
割当はアクセス時に遅延実行するため Cron Trigger は使っていません。

## ライセンス

[MIT](LICENSE)
