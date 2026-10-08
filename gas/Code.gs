/**
 * AUGUST SHOP 買取フォーム 受付スクリプト（Google Apps Script）
 *
 * できること
 *  - サイトの買取フォームから送られた申込を、スプレッドシートに1件1行で記録
 *  - 添付写真を Google ドライブのフォルダ（申込ごとのサブフォルダ）に保存し、リンクをシートに記録
 *  - 申込があったら通知メールを送信
 *
 * 初回の準備は docs/GASデプロイ手順.md を参照してください。
 * 通知先メールアドレスは、下の NOTIFY_EMAIL を書き換えるか、
 * 「プロジェクトの設定 > スクリプト プロパティ」の NOTIFY_EMAIL で変更できます（プロパティが優先）。
 */

var NOTIFY_EMAIL = ''; // 通知先（カンマ区切りで複数可）。公開リポジトリに載せないよう、ここは空欄のままスクリプト プロパティ NOTIFY_EMAIL で設定するのがおすすめ
var SHEET_NAME = '申込一覧';
var FOLDER_NAME = 'AUGUST SHOP 買取フォーム 写真';
var MAX_PHOTOS_PER_ITEM = 5;

var HEADERS = [
  '受付日時', '受付番号', 'お名前', '電話番号', 'メールアドレス', '郵便番号', 'ご住所',
  '買取方法', '配送キット', 'クーポン', 'アイテム数', 'アイテム詳細', '写真枚数', '写真フォルダ', '備考', '対応状況'
];

/* ---------- 初回だけ実行：シートと写真フォルダを作成 ---------- */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = getSpreadsheet_();
  var folder = getFolder_();
  Logger.log('スプレッドシート: ' + ss.getUrl());
  Logger.log('写真フォルダ: ' + folder.getUrl());
  Logger.log('通知先: ' + getNotifyEmail_());
  return {sheet: ss.getUrl(), folder: folder.getUrl()};
}

/* ---------- 動作確認用：ダミー申込を1件記録してメールを送る ---------- */
function testSubmit() {
  var res = handle_({
    name: 'テスト 太郎', tel: '090-0000-0000', email: 'test@example.com', zip: '100-0001',
    address: '東京都千代田区1-1', method: '宅配買取', kit: '希望する',
    coupon: 'NEW20', couponLabel: '新規買取 買取価格20%UP（NEW20）', note: 'GASエディタからのテスト送信',
    items: [{no: 1, brand: "Levi's", name: '501', size: 'W32', condition: '使用感あり', memo: '', photos: []}]
  });
  Logger.log(JSON.stringify(res));
}

/* ---------- Webアプリの入口 ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    return json_(handle_(data));
  } catch (err) {
    console.error(err);
    return json_({ok: false, error: 'server_error'});
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet() {
  return json_({ok: true, message: 'AUGUST SHOP form endpoint is running.'});
}

/* ---------- 本体 ---------- */
function handle_(d) {
  d = d || {};
  if (d.website) return {ok: true, id: 'IGNORED'}; // スパム対策

  // 住所は宅配買取のときだけ必須（店頭買取は来店予定日を任意で受け取る）
  var required = ['name', 'tel', 'email'];
  if (str_(d.method) !== '店頭買取') required.push('address');
  for (var i = 0; i < required.length; i++) {
    if (!str_(d[required[i]])) return {ok: false, error: 'missing_' + required[i]};
  }
  var items = Array.isArray(d.items) ? d.items.slice(0, 50) : [];
  if (!items.length || !items.every(function (it) { return str_(it && it.brand); })) {
    return {ok: false, error: 'missing_items'};
  }

  var now = new Date();
  var id = Utilities.formatDate(now, 'Asia/Tokyo', 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);

  // 写真を保存
  var photoCount = 0, folderUrl = '';
  var hasPhotos = items.some(function (it) { return Array.isArray(it.photos) && it.photos.length; });
  if (hasPhotos) {
    var sub = getFolder_().createFolder(id + ' ' + str_(d.name));
    folderUrl = sub.getUrl();
    items.forEach(function (it, idx) {
      (it.photos || []).slice(0, MAX_PHOTOS_PER_ITEM).forEach(function (p, j) {
        if (!p || !p.data) return;
        var bytes = Utilities.base64Decode(p.data);
        var name = 'item' + (idx + 1) + '-' + (j + 1) + '.jpg';
        sub.createFile(Utilities.newBlob(bytes, 'image/jpeg', name));
        photoCount++;
      });
    });
  }

  var detail = items.map(function (it, idx) {
    var parts = [str_(it.brand), str_(it.name), it.size ? 'サイズ:' + str_(it.size) : '', it.condition ? '状態:' + str_(it.condition) : '', str_(it.memo)]
      .filter(function (s) { return s; });
    var n = Array.isArray(it.photos) ? Math.min(it.photos.length, MAX_PHOTOS_PER_ITEM) : 0;
    return (idx + 1) + '. ' + parts.join(' / ') + (n ? '（写真' + n + '枚）' : '');
  }).join('\n');

  var note = (d.visit ? '来店予定：' + str_(d.visit) + (d.note ? '\n' : '') : '') + str_(d.note);

  var row = [
    now, id, d.name, d.tel, d.email, d.zip, d.address,
    d.method, d.kit, d.couponLabel || d.coupon, items.length, detail, photoCount, folderUrl, note, '未対応'
  ].map(function (v, i) { return i === 0 ? v : safe_(v); });

  var sheet = getSheet_();
  sheet.appendRow(row);

  notify_(id, d, detail, photoCount, folderUrl, sheet.getParent().getUrl());
  return {ok: true, id: id};
}

/* ---------- 通知メール ---------- */
function notify_(id, d, detail, photoCount, folderUrl, sheetUrl) {
  var to = getNotifyEmail_();
  if (!to) return;
  var body = [
    '買取フォームから新しいお申し込みがありました。',
    '',
    '受付番号：' + id,
    'お名前：' + str_(d.name),
    '電話番号：' + str_(d.tel),
    'メール：' + str_(d.email),
    '住所：' + [str_(d.zip), str_(d.address)].join(' '),
    '買取方法：' + str_(d.method) + (d.kit ? '（配送キット：' + str_(d.kit) + '）' : '') + (d.visit ? '（来店予定：' + str_(d.visit) + '）' : ''),
    'クーポン：' + (str_(d.couponLabel) || 'なし'),
    '',
    '■ アイテム',
    detail,
    '',
    '写真：' + photoCount + '枚' + (folderUrl ? '\n' + folderUrl : ''),
    '備考：' + (str_(d.note) || 'なし'),
    '',
    '申込一覧：' + sheetUrl
  ].join('\n');
  var opts = {name: 'AUGUST SHOP 買取フォーム'};
  if (d.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) opts.replyTo = String(d.email);
  MailApp.sendEmail(to, '【買取申込】' + str_(d.name) + ' 様（' + id + '）', body, opts);
}

/* ---------- helpers ---------- */
function getNotifyEmail_() {
  return PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || NOTIFY_EMAIL;
}

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('SHEET_ID');
  if (sid) { try { return SpreadsheetApp.openById(sid); } catch (e) {} }
  var ss = SpreadsheetApp.create('AUGUST SHOP 買取申込一覧');
  var sh = ss.getSheets()[0];
  sh.setName(SHEET_NAME);
  sh.appendRow(HEADERS);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#E9E3D6');
  sh.setColumnWidth(12, 420);
  sh.getRange('L:L').setWrap(true);
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}

function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var fid = props.getProperty('FOLDER_ID');
  if (fid) { try { return DriveApp.getFolderById(fid); } catch (e) {} }
  var folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function str_(v) { return v == null ? '' : String(v).trim().slice(0, 2000); }

/* 数式として解釈されない／電話番号の先頭0が消えないよう、文字列として記録する */
function safe_(v) {
  if (typeof v === 'number') return v;
  var s = str_(v);
  return (/^[=+\-@]/.test(s) || /^[\d\s\-()]+$/.test(s)) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
