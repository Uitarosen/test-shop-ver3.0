/**
 * AUGUST SHOP サイト掲載データ → サイト 反映スクリプト（Google Apps Script）
 *
 * スプレッドシート「AUGUST SHOP サイト掲載データ」に組み込んで使います（拡張機能 → Apps Script）。
 * ※ 買取フォームの受け口（gas/Code.gs）とは別のスクリプトです。混ぜないでください。
 *
 * できること
 *  - 「実績」「クーポン」シートで「サイトに掲載」にチェックを入れた行だけを、サイト（Cloudflare）に反映
 *  - 写真はドライブ（制限付きのまま）からサイト用の大きさに縮小して送る（撮影場所などの情報は残らない）
 *  - チェックを外すと、サイトからデータと写真を削除
 *  - 反映のきっかけ：チェックの付け外し・掲載中の行の編集／1時間ごとの自動反映／メニュー「今すぐ反映」
 *  - 「選択肢」シートの状態・カテゴリーを、フォーム「買取実績の登録」の選択肢に反映
 *
 * 接続先（API_BASE）と合言葉（SYNC_SECRET）は、メニュー「サイト掲載 ＞ 接続先の設定」で入力します。
 * スクリプト プロパティに保存され、このコードや公開リポジトリには残りません。
 */

var SITE_TZ = 'Asia/Tokyo';
var SHEET_RESULTS = '実績';
var SHEET_COUPONS = 'クーポン';
var SHEET_CHOICES = '選択肢';
var PUBLISH = 'サイトに掲載';
var STATUS = 'サイト反映';          // 反映の結果を書く列（初期設定で右端に作る）
var PHOTO_EDGE = 1600;              // 写真の長辺（px）
var TIME_BUDGET_MS = 4.5 * 60 * 1000; // 1回の反映で写真の処理に使う時間（Apps Script は1回6分まで）
var DEFAULT_CATEGORIES = ['アメカジ', 'ヴィンテージ', 'ドメスティック', 'ハイブラインポートデザイナーズ', 'アウトドア',
  '靴', '鞄', 'アクセサリー・小物', 'レディース', 'その他'];
var Q_CATEGORY = 'カテゴリー';
var Q_COUPON = 'クーポンを利用した買取ですか？';

/* ================= メニュー ================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('サイト掲載')
    .addItem('今すぐ反映', 'siteMenuSync')
    .addSeparator()
    .addItem('状態・カテゴリーの選択肢をフォームに反映', 'siteSyncChoicesToForm')
    .addSeparator()
    .addItem('初期設定（最初に1回）', 'siteSetup')
    .addItem('接続先の設定', 'siteConfigure')
    .addToUi();
}

function siteMenuSync() {
  var r = siteSyncAll('menu');
  SpreadsheetApp.getUi().alert(r.message);
}

/* ================= 初期設定 ================= */
function siteSetup() {
  var ui = SpreadsheetApp.getUi();
  if (!prop_('API_BASE') || !prop_('SYNC_SECRET')) siteConfigure();
  if (!prop_('API_BASE') || !prop_('SYNC_SECRET')) { ui.alert('接続先と合言葉が未設定のため、初期設定を中止しました。'); return; }

  var ss = SpreadsheetApp.getActive();
  [SHEET_RESULTS, SHEET_COUPONS].forEach(function (name) {
    var sh = mustSheet_(ss, name);
    var h = headers_(sh);
    if (findCol_(h, [STATUS]) < 0) {
      var c = sh.getLastColumn() + 1;
      sh.getRange(1, c).setValue(STATUS).setFontWeight('bold');
      sh.setColumnWidth(c, 260);
    }
    // 「サイトに掲載」の列全体をチェックボックスに（フォームで行が増えても使えるように）
    var pc = findCol_(headers_(sh), [PUBLISH]) + 1;
    if (pc > 0 && sh.getMaxRows() > 1) {
      var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      sh.getRange(2, pc, sh.getMaxRows() - 1, 1).setDataValidation(rule);
    }
  });

  // 選択肢シートに「カテゴリー」の列がなければ作る
  var ch = mustSheet_(ss, SHEET_CHOICES);
  if (findCol_(headers_(ch), [Q_CATEGORY]) < 0) {
    var cc = ch.getLastColumn() + 1;
    var vals = [[Q_CATEGORY]].concat(DEFAULT_CATEGORIES.map(function (v) { return [v]; }));
    ch.getRange(1, cc, vals.length, 1).setValues(vals);
    ch.getRange(1, cc).setFontWeight('bold');
  }

  siteSyncChoicesToForm(true);

  // トリガー（このスクリプトが作ったものだけ作り直す）
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['siteOnEdit', 'siteOnFormSubmit', 'siteHourlySync'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('siteOnEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('siteOnFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('siteHourlySync').timeBased().everyHours(1).create();

  var r = siteSyncAll('siteSetup');
  ui.alert('初期設定が完了しました。\n\n' + r.message);
}

function siteConfigure() {
  var ui = SpreadsheetApp.getUi();
  var cur = prop_('API_BASE');
  var a = ui.prompt('接続先の設定（1/2）', 'サイトのアドレスを入力してください。\n例：https://august-shop-test.test-shop-ver3.workers.dev' +
    (cur ? '\n\n現在：' + cur + '（変えない場合は空欄のまま OK）' : ''), ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var base = a.getResponseText().trim().replace(/\/+$/, '');
  if (base) {
    if (!/^https:\/\/[^\s\/]+$/.test(base)) { ui.alert('https:// から始まるアドレス（末尾の / やページ名なし）を入力してください。'); return; }
    PropertiesService.getScriptProperties().setProperty('API_BASE', base);
  }
  var b = ui.prompt('接続先の設定（2/2）', 'Cloudflare に登録した合言葉（SYNC_SECRET）を貼り付けてください。' +
    (prop_('SYNC_SECRET') ? '\n\n（設定済みです。変えない場合は空欄のまま OK）' : ''), ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  var secret = b.getResponseText().trim();
  if (secret) {
    if (secret.length < 32) { ui.alert('合言葉が短すぎます（32文字以上）。'); return; }
    PropertiesService.getScriptProperties().setProperty('SYNC_SECRET', secret);
  }
  var test = api_('get', '/api/admin/media');
  ui.alert(test.ok ? '接続を確認しました。' : '接続できませんでした：' + test.error + '\nアドレスと合言葉を確認してください。');
}

/* ================= トリガー ================= */
function siteOnEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    var name = sh.getName();
    if (name === SHEET_CHOICES) return; // 選択肢はメニューから反映
    if (name !== SHEET_RESULTS && name !== SHEET_COUPONS) return;
    if (e.range.getLastRow() < 2) return;
    var h = headers_(sh);
    var pub = findCol_(h, [PUBLISH]) + 1;
    var ignore = [STATUS, '管理メモ', 'メモ'].map(function (k) { return findCol_(h, [k]) + 1; });
    var c1 = e.range.getColumn(), c2 = e.range.getLastColumn();
    if (c1 === c2 && ignore.indexOf(c1) >= 0) return; // メモ欄・結果欄の編集では反映しない
    var touchesPub = pub >= c1 && pub <= c2;
    if (!touchesPub) {
      var vals = sh.getRange(e.range.getRow(), pub, e.range.getNumRows(), 1).getValues();
      if (!vals.some(function (v) { return v[0] === true; })) return; // 未掲載の行の編集は反映不要
    }
    siteSyncAll('edit');
  } catch (err) {
    console.error(err && err.stack || err);
  }
}

function siteOnFormSubmit(e) {
  // フォームで追加された行：チェックボックスと「未掲載」を入れる
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_RESULTS) return;
    var h = headers_(sh);
    var row = e.range.getRow();
    var pub = findCol_(h, [PUBLISH]) + 1, st = findCol_(h, [STATUS]) + 1;
    if (pub > 0) {
      var cell = sh.getRange(row, pub);
      cell.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
      if (cell.getValue() !== true) cell.setValue(false);
    }
    if (st > 0) sh.getRange(row, st).setValue('未掲載（内容を確認してチェックを入れると掲載）');
  } catch (err) {
    console.error(err && err.stack || err);
  }
}

function siteHourlySync() { siteSyncAll('hourly'); }

/* ================= 反映の本体 ================= */
function siteSyncAll(reason) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(60 * 1000)) return {ok: false, message: 'ほかの反映が実行中です。少し待ってからもう一度お試しください。'};
  try {
    if (!prop_('API_BASE') || !prop_('SYNC_SECRET')) return {ok: false, message: '接続先が未設定です。メニュー「サイト掲載 ＞ 接続先の設定」を実行してください。'};
    var started = Date.now();
    var ss = SpreadsheetApp.getActive();

    var list = api_('get', '/api/admin/media');
    if (!list.ok) return {ok: false, message: 'サイトに接続できませんでした（' + list.error + '）。'};
    var have = {};
    (list.data.names || []).forEach(function (n) { have[n] = true; });

    var res = buildResults_(mustSheet_(ss, SHEET_RESULTS), have, started);
    var cps = buildCoupons_(mustSheet_(ss, SHEET_COUPONS));

    var sync = api_('post', '/api/admin/sync', {results: res.items, coupons: cps.items});
    if (!sync.ok) {
      writeStatus_(mustSheet_(ss, SHEET_RESULTS), res.status.map(function (s) { return s && s.indexOf('掲載中') === 0 ? 'エラー：サイトに送れませんでした' : s; }));
      return {ok: false, message: 'サイトへの反映に失敗しました（' + sync.error + '）。'};
    }
    var when = Utilities.formatDate(new Date(), SITE_TZ, 'MM/dd HH:mm');
    writeStatus_(mustSheet_(ss, SHEET_RESULTS), res.status.map(function (s) { return s ? s.replace('{at}', when) : s; }));
    writeStatus_(mustSheet_(ss, SHEET_COUPONS), cps.status.map(function (s) { return s ? s.replace('{at}', when) : s; }));
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC', when + '（' + reason + '）');

    var msg = '反映しました（' + when + '）。\n買取実績：掲載 ' + res.items.length + '件' +
      (res.pending ? '／写真を準備中 ' + res.pending + '件（次の反映で掲載）' : '') +
      (res.errors ? '／エラー ' + res.errors + '件' : '') +
      '\nクーポン：掲載 ' + cps.items.length + '件' + (cps.errors ? '／エラー ' + cps.errors + '件' : '') +
      (res.errors || cps.errors ? '\n\nエラーの内容は各シートの「' + STATUS + '」列をご覧ください。' : '');
    return {ok: true, message: msg};
  } catch (err) {
    console.error(err && err.stack || err);
    return {ok: false, message: '反映中にエラーが発生しました：' + (err && err.message || err)};
  } finally {
    lock.releaseLock();
  }
}

function buildResults_(sh, have, started) {
  var values = sh.getDataRange().getValues();
  var h = values[0];
  var col = {
    brand: findCol_(h, ['ブランド']), item: findCol_(h, ['アイテム名']), size: findCol_(h, ['サイズ']),
    condition: findCol_(h, ['状態']), price: findCol_(h, ['買取金額']), date: findCol_(h, ['買取日']),
    photos: findCol_(h, ['写真']), category: findCol_(h, [Q_CATEGORY, 'カテゴリ']), coupon: findCol_(h, ['クーポン']),
    pub: findCol_(h, [PUBLISH])
  };
  if (col.brand < 0 || col.pub < 0) throw new Error('「実績」シートに「ブランド」「' + PUBLISH + '」の列が見つかりません');
  var items = [], status = [], pending = 0, errors = 0;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var brand = sstr_(row[col.brand]);
    var published = row[col.pub] === true;
    if (!brand && !published) { status.push(''); continue; }
    if (!published) { status.push('未掲載'); continue; }
    var date = symd_(col.date >= 0 ? row[col.date] : '');
    var problems = [];
    if (!brand) problems.push('ブランドが空です');
    if (!date) problems.push('買取日を入れてください');
    var price = col.price >= 0 ? toNumber_(row[col.price]) : '';
    if (price === null) problems.push('買取金額は数字で入れてください');
    if (problems.length) { status.push('エラー：' + problems.join('／')); errors++; continue; }

    // 写真：まだサイトにないものだけ縮小して送る
    var ids = col.photos >= 0 ? driveIds_(row[col.photos]) : [];
    var names = [], waiting = false, photoErr = '';
    for (var k = 0; k < ids.length; k++) {
      var name = mediaName_(ids[k]);
      if (!have[name]) {
        if (Date.now() - started > TIME_BUDGET_MS) { waiting = true; break; }
        try {
          var blob = resizedPhoto_(ids[k]);
          var up = api_('put', '/api/admin/media/' + name, blob);
          if (!up.ok) throw new Error(up.error);
          have[name] = true;
        } catch (err) {
          photoErr = (k + 1) + '枚目の写真を送れませんでした（' + (err && err.message || err) + '）';
          break;
        }
      }
      names.push('media/' + name);
    }
    if (photoErr) { status.push('エラー：' + photoErr); errors++; continue; }
    if (waiting) { status.push('写真を準備中（次の反映で掲載）'); pending++; continue; }

    items.push({
      date: date, brand: brand, item: col.item >= 0 ? sstr_(row[col.item]) : '',
      size: col.size >= 0 ? sstr_(row[col.size]) : '', condition: col.condition >= 0 ? sstr_(row[col.condition]) : '',
      category: col.category >= 0 ? sstr_(row[col.category]) : '', price: price === '' ? '' : price,
      coupon: col.coupon >= 0 ? yes_(row[col.coupon]) : false, images: names
    });
    status.push('掲載中（{at} 反映' + (names.length ? '・写真' + names.length + '枚' : '・写真なし') + '）');
  }
  return {items: items, status: status, pending: pending, errors: errors};
}

function buildCoupons_(sh) {
  var values = sh.getDataRange().getValues();
  var h = values[0];
  var col = {
    id: findCol_(h, ['クーポンID']), title: findCol_(h, ['タイトル']), rate: findCol_(h, ['割引内容']),
    description: findCol_(h, ['説明']), notes: findCol_(h, ['注意事項']), image: findCol_(h, ['画像']),
    start: findCol_(h, ['開始日']), end: findCol_(h, ['終了日']), featured: findCol_(h, ['トップに表示']),
    pub: findCol_(h, [PUBLISH])
  };
  if (col.id < 0 || col.pub < 0) throw new Error('「クーポン」シートに「クーポンID」「' + PUBLISH + '」の列が見つかりません');
  var items = [], status = [], errors = 0, seen = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var id = sstr_(row[col.id]);
    var published = row[col.pub] === true;
    if (!id && !published) { status.push(''); continue; }
    if (!published) { status.push('未掲載'); continue; }
    var problems = [];
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) problems.push('クーポンIDは半角英数字で入れてください');
    if (seen[id]) problems.push('クーポンIDが重複しています');
    var title = col.title >= 0 ? sstr_(row[col.title]) : '';
    if (!title) problems.push('タイトルが空です');
    var start = col.start >= 0 ? symd_(row[col.start]) : '', end = col.end >= 0 ? symd_(row[col.end]) : '';
    if (start && end && end < start) problems.push('終了日が開始日より前です');
    if (problems.length) { status.push('エラー：' + problems.join('／')); errors++; continue; }
    seen[id] = true;
    items.push({
      id: id, title: title, rate: col.rate >= 0 ? sstr_(row[col.rate]) : '',
      description: col.description >= 0 ? sstr_(row[col.description]) : '',
      notes: col.notes >= 0 ? String(row[col.notes] || '').split(/\r?\n/).map(sstr_).filter(String) : [],
      image: col.image >= 0 ? sstr_(row[col.image]) : '', start: start, end: end,
      featured: col.featured >= 0 ? row[col.featured] === true : false
    });
    var today = Utilities.formatDate(new Date(), SITE_TZ, 'yyyy-MM-dd');
    var note = (start && today < start) ? '（' + start.replace(/-/g, '/') + 'から表示）' : (end && today > end) ? '（期限切れのため非表示）' : '';
    status.push('掲載中（{at} 反映）' + note);
  }
  return {items: items, status: status, errors: errors};
}

/* ================= 写真 ================= */
/* ドライブの縮小画像（長辺 PHOTO_EDGE px）を取得。撮影場所などの情報は含まれない */
function resizedPhoto_(fileId) {
  var file = DriveApp.getFileById(fileId); // 権限の確認を兼ねる
  if (!/^image\//.test(file.getMimeType())) throw new Error('画像ではないファイルです');
  var token = ScriptApp.getOAuthToken();
  var meta = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) +
    '?fields=thumbnailLink&supportsAllDrives=true', {headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true});
  if (meta.getResponseCode() === 200) {
    var link = JSON.parse(meta.getContentText()).thumbnailLink;
    if (link) {
      link = /=s\d+[^\/]*$/.test(link) ? link.replace(/=s\d+[^\/]*$/, '=s' + PHOTO_EDGE) : link + '=s' + PHOTO_EDGE;
      for (var t = 0; t < 3; t++) {
        var r = UrlFetchApp.fetch(link, {headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true});
        if (r.getResponseCode() === 200) {
          var blob = r.getBlob();
          var type = blob.getContentType() || 'image/jpeg';
          if (/^image\/(jpeg|png|webp)$/.test(type)) return blob.setContentType(type);
        }
        Utilities.sleep(1500); // アップロード直後は縮小画像の準備に少し時間がかかることがある
      }
    }
  }
  throw new Error('ドライブで縮小画像を作れませんでした。しばらくしてから「今すぐ反映」をお試しください');
}

function mediaName_(fileId) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'august-shop:' + fileId);
  return d.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 32) + '.jpg';
}

function driveIds_(cell) {
  var ids = [];
  String(cell || '').split(/[,\s]+/).forEach(function (u) {
    var m = u.match(/[?&]id=([-\w]{20,})/) || u.match(/\/d\/([-\w]{20,})/) || u.match(/^([-\w]{25,})$/);
    if (m && ids.indexOf(m[1]) < 0) ids.push(m[1]);
  });
  return ids;
}

/* ================= フォームの選択肢 ================= */
function siteSyncChoicesToForm(silent) {
  var ss = SpreadsheetApp.getActive();
  var url = ss.getFormUrl();
  if (!url) throw new Error('このスプレッドシートにつながったフォームが見つかりません');
  var form = FormApp.openByUrl(url);
  var ch = mustSheet_(ss, SHEET_CHOICES);
  var data = ch.getDataRange().getValues();
  var listOf = function (title) {
    var c = findCol_(data[0], [title]);
    if (c < 0) return [];
    return data.slice(1).map(function (r) { return sstr_(r[c]); }).filter(String);
  };
  var states = listOf('状態');
  var cats = listOf(Q_CATEGORY);
  if (!cats.length) cats = DEFAULT_CATEGORIES;

  var items = form.getItems();
  var find = function (pred) { for (var i = 0; i < items.length; i++) if (pred(items[i])) return items[i]; return null; };
  var uploadIndex = (function () { var u = find(function (it) { return it.getType() === FormApp.ItemType.FILE_UPLOAD; }); return u ? u.getIndex() : -1; })();
  var setChoices = function (it, values) {
    if (it.getType() === FormApp.ItemType.LIST) it.asListItem().setChoiceValues(values);
    else if (it.getType() === FormApp.ItemType.MULTIPLE_CHOICE) it.asMultipleChoiceItem().setChoiceValues(values);
  };
  var placeBeforeUpload = function (it) {
    if (uploadIndex >= 0 && it.getIndex() > uploadIndex) { form.moveItem(it.getIndex(), uploadIndex); uploadIndex++; }
  };

  var st = find(function (it) { return it.getTitle() === '状態'; });
  if (st && states.length) setChoices(st, states);

  var cat = find(function (it) { return it.getTitle() === Q_CATEGORY; });
  if (!cat) { cat = form.addListItem().setTitle(Q_CATEGORY).setRequired(true); placeBeforeUpload(cat); }
  setChoices(cat, cats);

  var cp = find(function (it) { return it.getTitle().indexOf('クーポン') >= 0; });
  if (!cp) {
    cp = form.addMultipleChoiceItem().setTitle(Q_COUPON).setRequired(true)
      .setHelpText('クーポンで買取価格が上がった実績は「はい」。サイトの価格の横に「クーポン利用」と表示されます。');
    cp.asMultipleChoiceItem().setChoiceValues(['いいえ', 'はい']);
    placeBeforeUpload(cp);
  }
  if (silent !== true) SpreadsheetApp.getUi().alert('フォームの選択肢を更新しました。\n状態：' + states.join('、') + '\nカテゴリー：' + cats.join('、'));
}

/* ================= 通信 ================= */
function api_(method, path, body) {
  var opt = {method: method, muteHttpExceptions: true, headers: {Authorization: 'Bearer ' + prop_('SYNC_SECRET')}};
  if (body && body.getBytes) { opt.payload = body.getBytes(); opt.contentType = body.getContentType(); }
  else if (body) { opt.payload = JSON.stringify(body); opt.contentType = 'application/json'; }
  for (var t = 0; t < 3; t++) {
    try {
      var r = UrlFetchApp.fetch(prop_('API_BASE') + path, opt);
      var code = r.getResponseCode();
      var data = {};
      try { data = JSON.parse(r.getContentText()); } catch (e) {}
      if (code >= 200 && code < 300 && data.ok !== false) return {ok: true, data: data};
      if (code === 401) return {ok: false, error: '合言葉が違います'};
      if (code === 503 && data.error === 'secret_not_set') return {ok: false, error: 'Cloudflare 側の合言葉が未設定です'};
      if (code < 500) return {ok: false, error: (data.error || 'HTTP ' + code)};
    } catch (err) {
      if (t === 2) return {ok: false, error: String(err && err.message || err)};
    }
    Utilities.sleep(1000 * (t + 1));
  }
  return {ok: false, error: 'サイトが応答しません'};
}

/* ================= helpers ================= */
function prop_(k) { return (PropertiesService.getScriptProperties().getProperty(k) || '').trim(); }
function mustSheet_(ss, name) { var s = ss.getSheetByName(name); if (!s) throw new Error('シート「' + name + '」が見つかりません'); return s; }
function headers_(sh) { return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]; }
/* 見出しの名前で列を探す（完全一致を優先、なければ「含む」） */
function findCol_(h, names) {
  for (var n = 0; n < names.length; n++) for (var i = 0; i < h.length; i++) if (String(h[i]).trim() === names[n]) return i;
  for (n = 0; n < names.length; n++) for (i = 0; i < h.length; i++) if (String(h[i]).indexOf(names[n]) >= 0) return i;
  return -1;
}
function writeStatus_(sh, list) {
  var c = findCol_(headers_(sh), [STATUS]) + 1;
  if (c <= 0 || !list.length) return;
  sh.getRange(2, c, list.length, 1).setValues(list.map(function (v) { return [v || '']; }));
}
function sstr_(v) { return v == null ? '' : String(v).trim().slice(0, 600); }
function yes_(v) { return v === true || /^(はい|あり|yes|true|有)/i.test(String(v || '').trim()); }
function toNumber_(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') return Math.round(v);
  var t = String(v).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[¥￥,，円\s]/g, '');
  return /^\d+$/.test(t) ? Number(t) : null;
}
function symd_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, SITE_TZ, 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
