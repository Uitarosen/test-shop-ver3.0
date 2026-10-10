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
  lineId: "[LINE IDを差し込み]",
  lineUrl: "",            /* 友だち追加URL（例: https://line.me/R/ti/p/@xxxx）。空ならボタンは出ません */

  /* 店舗情報（ヘッダー・フッター・販売ページで使用） */
  address: "[住所を差し込み]",
  access: "[最寄駅からの案内を差し込み]",
  payment: "[対応している決済方法を差し込み]",
  license: "[許可番号を差し込み]",
  buyMail: "[買取専用メールアドレスを差し込み]",

  instagram: "https://www.instagram.com/august_shop_sgn/",

  /* 宅配買取の条件（買取ページの「流れ」「よくある質問」に表示されます）
     実際の運用に合わせて書き換えてください。 */
  kitDays: "[例：お申し込みから2〜3日でお届け]",            /* 配送キットが届くまで */
  shippingFee: "[例：着払い（送料は当店負担）]", /* 発送時の送料 */
  replyDays: "[例：到着から2営業日以内]",           /* 査定結果のご連絡まで */
  payout: "[例：ご承諾から2営業日以内に、ご指定の口座へお振込み]", /* 入金方法・時期 */
  cancelFee: "[例：お客様のご負担]",         /* 査定後キャンセル時の返送料 */
  idDocs: "[例：運転免許証・保険証などのコピーを同梱]", /* 本人確認書類 */

  /* 写真アップロードの設定 */
  photoMaxPerItem: 5,     /* 1アイテムあたりの上限枚数 */
  photoMaxEdge: 1600,     /* 長辺のピクセル数（縮小後） */
  photoQuality: 0.82,     /* JPEG画質 0〜1 */
  itemMax: 20             /* 1回の申込で追加できるアイテム数の上限 */
};
