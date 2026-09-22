# AUGUST SHOP ウェブサイト

静的サイトです。ビルド不要で、`index.html` と `assets/` をそのままサーバーの公開ディレクトリに置けば動きます。

```
index.html          ページ本体（HTML / CSS / JS をすべて内包）
assets/img/*.jpg    画像
```

## 公開手順

1. レンタルサーバーなら FTP で `public_html`（または `www`）直下にアップロード
2. Netlify / Cloudflare Pages / Vercel ならこのフォルダごとドラッグ＆ドロップ
3. 独自ドメイン（august-shop.net）を向ける

## 公開前に差し替えるもの

| 場所 | 内容 |
| --- | --- |
| `index.html` 内の `[住所を差し込み]` | 店舗住所（販売についてセクション、フッター、JSON-LD の3か所） |
| `[最寄駅からの案内を差し込み]` | 最寄駅からのアクセス |
| `[対応している決済方法を差し込み]` | 決済方法 |
| `[許可番号を差し込み]` | 古物商許可番号 |
| `[LINE IDを差し込み]` | LINE公式アカウントのID。友だち追加URL（`https://line.me/R/ti/p/@xxxx`）があれば、LINE査定カードにリンクを貼ってください |
| `[買取専用メールアドレスを差し込み]` | 買取専用のメールアドレス |
| `assets/img/*.jpg` | 仮素材（Unsplash）の写真。店内3点はご支給画像ですが解像度が低いため、高解像度版への差し替えを推奨します |

## 買取フォームの送信先

現状はフロント側のバリデーションのみで、送信先が未設定です。`index.html` の

```html
<form id="buyform" novalidate action="" method="post" enctype="multipart/form-data">
```

の `action` に送信先を設定すると、そのまま POST されます。選択肢は主に3つです。

- **フォーム送信サービス**（最短）：Formspree、Tally、SSGFORM など。発行されたURLを `action` に入れるだけ。写真添付にも対応するプランを選んでください
- **サーバーのPHP**：`action="/send.php"` にして、`mail()` や PHPMailer で買取専用アドレスへ転送
- **Google フォーム**：入力項目をGoogleフォーム側に作り、`action` をそのエンドポイントに

どれを選んでも、送信後の完了メッセージは `index.html` 末尾のスクリプト内 `formstatus` の文言を書き換えてください。

## Instagram の自動取り込み

Instagram欄は現在8枚の固定画像です。Instagram Graph API で最新投稿を取り込む場合は、

1. サーバーレス関数などで定期的に最新9件（画像URL・パーマリンク）を取得してJSONに保存
2. `#igGrid` の中身をそのJSONから生成

という構成にすると、表示速度を落とさずに自動更新できます。APIの利用自体は無料です。

## 対応環境

モダンブラウザ全般（Chrome / Safari / Edge / Firefox の最新版）。
`prefers-reduced-motion` を有効にしている環境ではアニメーションが停止します。
