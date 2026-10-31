/* =========================================================
   AUGUST SHOP サイト設定
   ここを書き換えるだけで、全ページに反映されます。
   ========================================================= */
window.AUGUST_CONFIG = {
  /* 買取フォームの送信先（Google Apps Script の WebアプリURL）
     例: "https://script.google.com/macros/s/xxxxxxxx/exec"
     空のままだと「送信先未設定」と表示され、実際の送信は行われません。 */
  formEndpoint: "https://script.google.com/macros/s/AKfycbys2lGrQ7DOiyn3kh_FncOBILSiyayI3snK1ABE_oL7dJDLfhh2BXRJQp29ljMQOsnE/exec",

  /* LINE公式アカウント */
  lineId: "@776yyqfq",
  lineUrl: "https://line.me/R/ti/p/@776yyqfq", /* 友だち追加URL。「LINE査定」ボタン・LINE ID の表記はすべてここへリンクします */

  /* 店舗情報（ヘッダー・フッター・販売ページで使用） */
  address: "〒243-0018 神奈川県厚木市中町4-10-3 中町三紫ビル101",
  license: "古物商許可証 第452740013242号／神奈川県公安委員会",

  instagram: "https://www.instagram.com/august_shop_sgn/",

  /* 買取実績のカテゴリー（買取実績ページの絞り込みに、この順番で並びます）
     data/results.json の "category" には、このどれかを書いてください。 */
  resultCategories: [
    "アメカジ", "ヴィンテージ", "ドメスティック", "ハイブラインポートデザイナーズ", "アウトドア",
    "靴", "鞄", "アクセサリー・小物", "レディース", "その他"
  ],

  /* 宅配買取の条件（買取ページの「流れ」「よくある質問」に表示されます） */
  kitDays: "お申し込みから2〜3日でお届け",            /* 配送キットが届くまで */
  shippingFee: "着払い（送料は当店負担）", /* 発送時の送料 */
  replyDays: "到着から2営業日以内",           /* 査定結果のご連絡まで */
  payout: "ご承諾から2営業日以内に、ご指定の口座へお振込み", /* 入金方法・時期 */
  idDocs: "運転免許証・マイナンバーカード（表面のみ）のコピーを同梱、または画像データを当店までメールかLINEでお送りください。", /* 本人確認書類 */

  /* 写真アップロードの設定 */
  photoMaxPerItem: 5,     /* 1アイテムあたりの上限枚数 */
  photoMaxEdge: 1600,     /* 長辺のピクセル数（縮小後） */
  photoQuality: 0.82,     /* JPEG画質 0〜1 */
  itemMax: 20             /* 1回の申込で追加できるアイテム数の上限 */
};
