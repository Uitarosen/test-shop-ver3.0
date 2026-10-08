# AUGUST SHOP ウェブサイト

静的サイトです。ビルド不要で、フォルダ一式をそのまま公開ディレクトリ（GitHub Pages / レンタルサーバー）に置けば動きます。

```
index.html              トップ
buy/index.html          買取について（買取方法・クーポン・買取フォーム）
results/index.html      買取実績
brands/index.html       取扱ブランド
store/index.html        販売について（ECサイト・店舗情報）

assets/css/style.css    全ページ共通のスタイル
assets/js/config.js     ★ 店舗情報・LINE・フォーム送信先などの設定
assets/js/layout.js     ヘッダー／メニュー／フッター／追従ボタン（全ページ共通・ここだけ直せば全ページ反映）
assets/js/site.js       共通の動き、データの読み込みと表示
assets/js/buy-form.js   買取フォーム（アイテム追加、写真縮小、送信）
assets/js/brands.js     取扱ブランド一覧
assets/js/results.js    買取実績一覧（絞り込み・もっと見る）

data/results.json       ★ 買取実績
data/coupons.json       ★ クーポン
data/brands.json        ★ 取扱ブランド
assets/img/results/     買取実績の写真
assets/img/coupons/     クーポン画像（任意）

gas/Code.gs             買取フォームの受け口（Google Apps Script）
docs/運用ガイド.md        ★ 実績・クーポン・ブランドの更新方法
docs/GASデプロイ手順.md   フォーム送信先の設定方法
scripts/check-data.mjs  data/*.json のチェック（GitHub Actions で自動実行）
```

★ の付いたファイルを書き換えるだけで、日々の更新ができます。手順は [docs/運用ガイド.md](docs/運用ガイド.md) を参照してください。

## ローカルで確認する

データを `fetch` で読み込むため、ファイルを直接ダブルクリックで開くと実績・クーポンが表示されません。簡易サーバーで開いてください。

```
python3 -m http.server 4173
# → http://localhost:4173/
```

## 公開前に差し替えるもの

| 場所 | 内容 |
| --- | --- |
| `assets/js/config.js` | LINE ID／友だち追加URL、住所、最寄駅からの案内、決済方法、古物商許可番号、買取専用メールアドレス、フォーム送信先URL |
| `assets/js/config.js`（ver3.2で追加） | 宅配買取の条件：`kitDays`（キット到着まで）、`shippingFee`（発送時の送料）、`replyDays`（査定連絡まで）、`payout`（入金方法・時期）、`cancelFee`（キャンセル時の返送料）、`idDocs`（本人確認書類）。買取ページの「宅配買取の流れ」「よくあるご質問」に表示されます |
| `index.html` 内 JSON-LD の `[住所を差し込み]` | 検索エンジン向けの店舗住所 |
| `data/results.json` と `assets/img/results/` | 現在はサンプル12件。本番データへの入れ替え方は運用ガイド参照 |
| `data/coupons.json` | `NEW20` 以外はサンプル。「【表示されない例】」の2件は削除して構いません |
| `assets/img/*.jpg` | 仮素材（Unsplash）の写真。店内3点はご支給画像ですが解像度が低いため、高解像度版への差し替えを推奨 |

## 買取フォーム

送信先は Google Apps Script（無料）。申込はスプレッドシートに1件1行で記録、写真は Google ドライブに保存、通知メールを送信します。
設定手順は [docs/GASデプロイ手順.md](docs/GASデプロイ手順.md)。`config.js` の `formEndpoint` が空のあいだは、フォームに「テスト表示」と出て、実際には送信されません。

写真はブラウザ側で長辺1600px・JPEGに縮小してから送ります（1アイテム5枚まで。`config.js` で変更可）。

## 対応環境

モダンブラウザ全般（Chrome / Safari / Edge / Firefox の最新版）。
`prefers-reduced-motion` を有効にしている環境ではアニメーションが停止します。

## ver3.2 の変更点

- トップの最初の画面：写真＋「SELECT CLOTH & ARCHIVE・VINTAGE」＋「買取の申込み」「アイテムを見る」の2ボタンだけのシンプルな構成に変更。最初の画面ではヘッダーの申込ボタンとスマホの追従ボタンを隠し、スクロール後に表示
- ロゴ：ヘッダー・フッターをロゴ画像（`assets/img/logo-ivory.png`／`logo-ink.png`。ご支給のロゴから透過で書き出し）に変更。高解像度の元データ（AI/SVG）があれば差し替えを推奨
- 書体：ロゴに合わせて欧文を Libre Caslon Text（クラシックなセリフ）に統一。和文の見出しとボタンは Zen Old Mincho（明朝）、本文は Zen Kaku Gothic New のまま（Google Fonts）
- トップの並び順：最初の画面 → 買取実績 → 買取方法 → クーポン → ブランド → restore/original → 店舗紹介 → 店舗情報 → Instagram → ステートメント → CTA
- クーポン：使い方の説明はカードごとではなく、一覧の下に1回だけ表示
- 買取ページ：「宅配買取の流れ（5ステップ）」と「よくあるご質問」を追加
- 買取フォーム：①買取方法 → ②お客様情報 → ③アイテム → ④確認、の4ステップ構成に変更
  - 宅配買取：郵便番号・住所が必須（郵便番号から住所を自動入力。zipcloud を利用）／配送キット
  - 店頭買取：住所は不要、来店予定日（任意）を入力
  - 同意の対象（買取できないもの・有効期限・個人情報）を同意欄の直前に表示
  - 入力欄の文字を16pxに（iPhoneで入力時に画面が拡大されないように）
- `gas/Code.gs`：住所の必須チェックを宅配買取のときだけに変更。来店予定日を「備考」列と通知メールに記録。**既にデプロイ済みの場合は、Code.gs を差し替えて「新しいバージョン」で再デプロイしてください**
