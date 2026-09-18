# AUGUST SHOP — 公式サイト（静的サイト）

`august-static-mock ver1.1` のアセットをベースに構築した、そのまま公開できる静的サイトです。
ビルドツールは不要で、ファイルをそのままサーバーへアップロードすれば動作します。

## 構成

```
.
├── index.html          トップページ（1カラムLP / 全セクション）
├── privacy.html        プライバシーポリシー
├── 404.html            エラーページ（noindex）
├── robots.txt
├── sitemap.xml
└── assets/
    ├── style.css       全ページ共通スタイル
    ├── app.js          ローダー / ドロワー / スクロール演出
    ├── favicon.svg     ファビコン（Aモノグラム）
    ├── apple-touch-icon.png
    └── *.jpg / *.png   写真素材・ロゴ・LINE QR
```

## ローカル確認

```bash
python3 -m http.server 4173
```

→ http://localhost:4173

## モックから変更した点

- モック配布用の「テーマZIP ダウンロード」ボタン／フローティングバッジを削除
- `<head>` を刷新：canonical / OGP / Twitter Card / favicon / 構造化データ（schema.org `Store`）
- 下層ページを追加：`privacy.html`、`404.html`（ヘッダー・ドロワー・フッターはトップと共通）
- 画像に `width` / `height` / `loading="lazy"` を付与（CLS 対策・初期表示の軽量化）。ヒーロー画像のみ `fetchpriority="high"` で先読み
- アクセシビリティ：スキップリンク、`:focus-visible` のアウトライン、ドロワーの `aria-expanded` / `aria-hidden` / フォーカストラップ・フォーカス復帰
- SP（〜680px）でヒーローの SCROLL 表示がボタンと重なっていたため非表示に
- 実リンクを設定：LINE 友だち追加（`@776yyqfq`）、Instagram（`@august_shop`）、プライバシーポリシー

## 公開前に差し替えが必要な項目（TODO）

| 箇所 | 内容 |
|---|---|
| 各ファイルの `https://august-shop.net/` | 本番ドメインに合わせて canonical / OGP / sitemap / robots を修正 |
| `index.html` ONLINE STORE / フッター SNS | ヤフオク・楽天市場・メルカリ・BASE の各URL（現在 `href="#"`） |
| `index.html` SHOP INFO | 地図プレースホルダを Google マップ埋め込みに差し替え、住所・最寄駅を記載 |
| `privacy.html` | `[　］` 内（所在地・代表者名・古物商許可番号・制定日）を記入 |
| 未使用 | `assets/hero.png` は現在どこからも参照していません |

**法令面の注意**：古物営業法により、古物商はウェブサイト上に許可を受けた公安委員会名・許可番号・
氏名（名称）の表示が必要です。`privacy.html` に記入欄を用意していますが、フッターまたは
会社概要への掲載もあわせてご検討ください。オンライン販売を自社サイトで行う場合は
「特定商取引法に基づく表記」ページも別途必要になります。

## デプロイ

静的ホスティング（Netlify / Vercel / Cloudflare Pages / S3 / レンタルサーバー等）にそのまま配置できます。
404 ページを有効にするには、ホスティング側で 404 時の表示先を `/404.html` に設定してください。
（Netlify / Cloudflare Pages はルート直下の `404.html` を自動で使用します。Apache の場合は
`.htaccess` に `ErrorDocument 404 /404.html` を追記してください。）

## 対応ファイル

- 旧ファイル `august-shop-renewal.html` は今回の構成では使用していません（参考用に残しています）。
