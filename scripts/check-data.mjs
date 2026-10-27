// data/*.json の書式と、参照している画像の有無をチェックする（GitHub Actions で自動実行）
import fs from 'node:fs';
import vm from 'node:vm';
let errors = 0;
const err = (f, m) => { errors++; console.error(`::error file=${f}::${m}`); };
const load = (f) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { err(f, `JSONの書式エラー: ${e.message}（カンマ忘れ・最後の余分なカンマ・全角記号などを確認）`); return null; }
};
const date = /^\d{4}-\d{2}-\d{2}$/;
const img = (f, p, i) => { if (p && !fs.existsSync('assets/img/' + p)) err(f, `${i + 1}件目: 画像 assets/img/${p} が見つかりません`); };

// 買取実績のカテゴリー一覧は assets/js/config.js の resultCategories から読む
const cfgBox = { window: {} };
try { vm.runInNewContext(fs.readFileSync('assets/js/config.js', 'utf8'), cfgBox); }
catch (e) { err('assets/js/config.js', `config.js を読み込めません: ${e.message}`); }
const cats = (cfgBox.window.AUGUST_CONFIG || {}).resultCategories || [];
if (!cats.length) err('assets/js/config.js', 'resultCategories（買取実績のカテゴリー）がありません');

const results = load('data/results.json');
if (results) results.forEach((r, i) => {
  if (!r.brand) err('data/results.json', `${i + 1}件目: brand がありません`);
  if (cats.length && !cats.includes(r.category)) err('data/results.json', `${i + 1}件目: category は次のどれかを書いてください → ${cats.join(' / ')}`);
  if (!date.test(r.date || '')) err('data/results.json', `${i + 1}件目: date は 2026-10-12 の形で書いてください`);
  if (r.price !== '' && typeof r.price !== 'number') err('data/results.json', `${i + 1}件目: price は数字だけで書いてください（例 38000）`);
  img('data/results.json', r.image, i);
  if ('images' in r) {
    if (!Array.isArray(r.images)) err('data/results.json', `${i + 1}件目: images は ["results/a.jpg", "results/b.jpg"] のように [ ] で囲んで書いてください`);
    else r.images.forEach((x) => img('data/results.json', x, i));
  }
  if ('coupon' in r && typeof r.coupon !== 'boolean') err('data/results.json', `${i + 1}件目: coupon は true / false（" で囲まない）`);
});
const coupons = load('data/coupons.json');
if (coupons) {
  const ids = new Set();
  coupons.forEach((c, i) => {
    if (!c.id || !c.title) err('data/coupons.json', `${i + 1}件目: id と title は必須です`);
    if (ids.has(c.id)) err('data/coupons.json', `${i + 1}件目: id「${c.id}」が重複しています`);
    ids.add(c.id);
    for (const k of ['start', 'end']) if (c[k] && !date.test(c[k])) err('data/coupons.json', `${i + 1}件目: ${k} は 2026-10-12 の形で書いてください`);
    for (const k of ['featured', 'active']) if (k in c && typeof c[k] !== 'boolean') err('data/coupons.json', `${i + 1}件目: ${k} は true / false（" で囲まない）`);
    img('data/coupons.json', c.image, i);
  });
}
const brands = load('data/brands.json');
const kanaGroups = ['ア', 'カ', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ヤ', 'ラ', 'ワ'];
if (brands) brands.forEach((b, i) => {
  if (!b.name) err('data/brands.json', `${i + 1}件目: name がありません`);
  if (!kanaGroups.includes(b.group)) err('data/brands.json', `${i + 1}件目（${b.name || ''}）: group は ${kanaGroups.join('・')} のどれか1文字で書いてください`);
});

if (errors) { console.error(`\n${errors} 件の問題が見つかりました。`); process.exit(1); }
console.log('OK: data/*.json に問題はありません。');
