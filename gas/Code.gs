/**
 * AUGUST SHOP 買取フォーム 受付スクリプト（Google Apps Script）
 *
 * できること
 *  - サイトの買取フォームから送られた申込を、指定のスプレッドシートに1件1行で記録
 *  - 添付写真を Google ドライブに保存（申込ごとに「yyyy/MM/dd_お名前さま_受付番号」フォルダを作成）
 *  - お客様へ自動返信メール（お礼・スタッフから折り返す旨・入力内容）を送信
 *  - 店舗へ通知メールを送信
 *
 * 設定は「プロジェクトの設定 > スクリプト プロパティ」で行います（公開リポジトリに載せないため）。
 *   SHEET_ID      … 記録先スプレッドシートのID（URLの /d/ と /edit の間の文字列）【必須】
 *   NOTIFY_EMAIL  … 店舗側の通知先（カンマ区切りで複数可）
 *   FOLDER_ID     … 写真の保存先フォルダのID（任意。空なら初回にマイドライブへ自動作成）
 *   SHEET_NAME    … 記録先のシート名（任意。空なら左端のシート）
 * 手順は docs/GASデプロイ手順.md を参照してください。
 */

var SHOP_NAME = 'AUGUST SHOP';
var FOLDER_NAME = 'AUGUST SHOP 買取フォーム 写真';
var MAX_PHOTOS_PER_ITEM = 5;
var TZ = 'Asia/Tokyo';

var HEADERS = [
  '受付日時', '受付番号', 'お名前', '電話番号', 'メールアドレス', '買取方法',
  '郵便番号', 'ご住所', '配送キット', '来店予定日', 'クーポン',
  'アイテム数', 'アイテム詳細', '写真枚数', '写真フォルダ', '備考', '自動返信', '対応状況'
];

/* ---------- 初回だけ実行：設定の確認と権限の承認 ---------- */
function setup() {
  var sh = getSheet_();
  var folder = getFolder_();
  Logger.log('記録先シート: ' + sh.getParent().getUrl() + '（' + sh.getName() + '）');
  Logger.log('写真フォルダ: ' + folder.getUrl());
  Logger.log('店舗通知先: ' + (getProp_('NOTIFY_EMAIL') || '（未設定）'));
  Logger.log('自動返信の残り送信可能数（本日）: ' + MailApp.getRemainingDailyQuota());
}

/* ---------- 動作確認用：ダミー申込（写真1枚つき）を1件処理する ----------
   自動返信は NOTIFY_EMAIL の先頭アドレス宛てに送られます（お客様役として受け取って確認できます）。 */
function testSubmit() {
  // 8x8 の灰色 JPEG（テスト用）
  var jpg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwAooooA/9k=';
  var res = handle_({
    name: 'テスト 太郎', tel: '090-0000-0000', email: getProp_('NOTIFY_EMAIL').split(',')[0].trim() || 'test@example.com', zip: '100-0001',
    address: '東京都千代田区1-1', method: '宅配買取', kit: '希望する',
    coupon: '', couponLabel: '', note: 'GASエディタからのテスト送信',
    items: [{no: 1, brand: "Levi's", name: '501', size: 'W32', condition: '使用感あり', memo: '',
      photos: [{name: 'item1-1.jpg', type: 'image/jpeg', data: jpg}]}]
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
    console.error(err && err.stack || err);
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

  // 住所は宅配買取のときだけ必須
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
  var id = Utilities.formatDate(now, TZ, 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);

  // 写真を保存：フォルダ名「yyyy/MM/dd_お名前さま_受付番号」
  var photoCount = 0, folderUrl = '';
  var hasPhotos = items.some(function (it) { return Array.isArray(it.photos) && it.photos.length; });
  if (hasPhotos) {
    var folderName = Utilities.formatDate(now, TZ, 'yyyy/MM/dd') + '_' + str_(d.name).slice(0, 60) + 'さま_' + id;
    var sub = getFolder_().createFolder(folderName);
    folderUrl = sub.getUrl();
    items.forEach(function (it, idx) {
      (it.photos || []).slice(0, MAX_PHOTOS_PER_ITEM).forEach(function (p, j) {
        if (!p || !p.data) return;
        var bytes = Utilities.base64Decode(p.data);
        sub.createFile(Utilities.newBlob(bytes, 'image/jpeg', 'item' + (idx + 1) + '-' + (j + 1) + '.jpg'));
        photoCount++;
      });
    });
  }

  var detail = itemLines_(items).join('\n');

  // 先にお客様へ自動返信（失敗しても申込自体は受け付ける）
  var replyStatus = '';
  try {
    replyStatus = autoReply_(id, now, d, items) ? '送信済み' : '送信なし（アドレス不正）';
  } catch (err) {
    console.error('autoReply failed: ' + err);
    replyStatus = '送信失敗';
  }

  // 受付日時はシートのタイムゾーン設定に左右されないよう、日本時間の文字列で記録する
  var row = [
    Utilities.formatDate(now, TZ, 'yyyy/MM/dd HH:mm:ss'), id, d.name, d.tel, d.email, d.method,
    d.zip, d.address, d.kit, ymd_(d.visit), d.couponLabel || d.coupon,
    items.length, detail, photoCount, folderUrl, d.note, replyStatus, '未対応'
  ].map(safe_);

  var sheet = getSheet_();
  sheet.appendRow(row);

  try {
    notify_(id, d, detail, photoCount, folderUrl, sheet.getParent().getUrl());
  } catch (err) {
    console.error('notify failed: ' + err);
  }
  return {ok: true, id: id};
}

/* ---------- お客様への自動返信 ---------- */
function autoReply_(id, now, d, items) {
  var to = str_(d.email);
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return false;

  var photoTotal = items.reduce(function (s, it) {
    return s + (Array.isArray(it.photos) ? Math.min(it.photos.length, MAX_PHOTOS_PER_ITEM) : 0);
  }, 0);

  var lines = [
    str_(d.name) + ' 様',
    '',
    'この度は ' + SHOP_NAME + ' の買取にお申し込みいただき、誠にありがとうございます。',
    '以下の内容でお申し込みを受け付けました。',
    '',
    '内容を確認のうえ、担当スタッフより改めてご連絡いたします。',
    '恐れ入りますが、今しばらくお待ちくださいますようお願い申し上げます。',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '■ お申し込み内容',
    '━━━━━━━━━━━━━━━━━━━━',
    '受付番号：' + id,
    '受付日時：' + Utilities.formatDate(now, TZ, 'yyyy/MM/dd HH:mm'),
    '',
    'お名前：' + str_(d.name),
    '電話番号：' + str_(d.tel),
    'メールアドレス：' + str_(d.email),
    '買取方法：' + str_(d.method)
  ];
  if (str_(d.method) === '店頭買取') {
    lines.push('来店予定日：' + (ymd_(d.visit) || '未定'));
  } else {
    lines.push('郵便番号：' + str_(d.zip));
    lines.push('ご住所：' + str_(d.address));
    lines.push('配送キット：' + (str_(d.kit) || '指定なし'));
  }
  lines.push('クーポン：' + (str_(d.couponLabel) || str_(d.coupon) || 'なし'));
  lines.push('');
  lines.push('■ アイテム（' + items.length + '点・写真' + photoTotal + '枚）');
  lines = lines.concat(itemLines_(items));
  lines.push('');
  lines.push('■ 備考');
  lines.push(str_(d.note) || 'なし');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('※ このメールは送信専用のアドレスから自動でお送りしています。');
  lines.push('※ お心当たりのない場合は、お手数ですがこのメールを破棄してください。');
  lines.push('');
  lines.push(SHOP_NAME);
  lines.push('https://www.instagram.com/august_shop_sgn/');

  var opts = {name: SHOP_NAME};
  var shop = (getProp_('NOTIFY_EMAIL') || '').split(',')[0].trim();
  if (shop) opts.replyTo = shop; // お客様が返信したら店舗に届く
  MailApp.sendEmail(to, '【' + SHOP_NAME + '】買取のお申し込みを受け付けました（受付番号：' + id + '）', lines.join('\n'), opts);
  return true;
}

/* ---------- 店舗への通知メール ---------- */
function notify_(id, d, detail, photoCount, folderUrl, sheetUrl) {
  var to = getProp_('NOTIFY_EMAIL');
  if (!to) return;
  var body = [
    '買取フォームから新しいお申し込みがありました。',
    '',
    '受付番号：' + id,
    'お名前：' + str_(d.name),
    '電話番号：' + str_(d.tel),
    'メール：' + str_(d.email),
    '買取方法：' + str_(d.method),
    str_(d.method) === '店頭買取'
      ? '来店予定日：' + (ymd_(d.visit) || '未定')
      : '住所：' + [str_(d.zip), str_(d.address)].join(' ') + '（配送キット：' + (str_(d.kit) || '指定なし') + '）',
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
  var opts = {name: SHOP_NAME + ' 買取フォーム'};
  if (/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(str_(d.email))) opts.replyTo = str_(d.email);
  MailApp.sendEmail(to, '【買取申込】' + str_(d.name) + ' 様（' + id + '）', body, opts);
}

/* ---------- helpers ---------- */
function itemLines_(items) {
  return items.map(function (it, idx) {
    var parts = [str_(it.brand), str_(it.name), it.size ? 'サイズ:' + str_(it.size) : '', it.condition ? '状態:' + str_(it.condition) : '', str_(it.memo)]
      .filter(function (s) { return s; });
    var n = Array.isArray(it.photos) ? Math.min(it.photos.length, MAX_PHOTOS_PER_ITEM) : 0;
    return (idx + 1) + '. ' + parts.join(' / ') + (n ? '（写真' + n + '枚）' : '');
  });
}

function getProp_(k) {
  return (PropertiesService.getScriptProperties().getProperty(k) || '').trim();
}

function getSheet_() {
  var sid = getProp_('SHEET_ID');
  if (!sid) throw new Error('スクリプト プロパティ SHEET_ID が未設定です');
  var ss = SpreadsheetApp.openById(sid);
  var name = getProp_('SHEET_NAME');
  var sh = (name && ss.getSheetByName(name)) || ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#E9E3D6');
    sh.setColumnWidth(13, 420);
    sh.getRange(1, 13, sh.getMaxRows(), 1).setWrap(true);
  }
  return sh;
}

function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var fid = getProp_('FOLDER_ID');
  if (fid) { try { return DriveApp.getFolderById(fid); } catch (e) {} }
  var folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

/* 2026-10-17 → 2026/10/17 */
function ymd_(v) { return str_(v).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1/$2/$3'); }

function str_(v) { return v == null ? '' : String(v).trim().slice(0, 2000); }

/* 数式として解釈されない／電話番号の先頭0が消えないよう、文字列として記録する */
function safe_(v) {
  if (typeof v === 'number') return v;
  var s = str_(v);
  return (/^[=+\-@]/.test(s) || /^[\d\s\-()\/]+$/.test(s)) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
