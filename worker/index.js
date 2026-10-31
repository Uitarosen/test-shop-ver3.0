/* =========================================================
   AUGUST SHOP サイトの受け口（Cloudflare Worker）
   - サイトのファイル（HTML・画像など）はそのまま配信（env.ASSETS）
   - 買取実績・クーポン：スプレッドシート（Apps Script）から届いたデータを保存して配る
       GET  /api/results            掲載中の買取実績（JSON）
       GET  /api/coupons            掲載中のクーポン（JSON）
       GET  /media/<name>           買取実績の写真
   - Apps Script 専用（合言葉 SYNC_SECRET が必要）
       GET  /api/admin/media        保存済みの写真の一覧
       PUT  /api/admin/media/<name> 写真を1枚保存
       POST /api/admin/sync         実績・クーポンをまとめて差し替え、使われなくなった写真を削除
   保存先は KV（binding: STORE）。本番で R2 に切り替えるときは store の中身だけ差し替える。
   ========================================================= */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   /* 1枚の上限（縮小後の写真なら十分） */
const MAX_ITEMS = 2000;                      /* 実績・クーポンの件数の上限 */
const NAME_RE = /^[a-f0-9]{16,64}\.(jpg|png|webp)$/;
const IMG_TYPES = {jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/admin/')) return await admin(req, env, path);
      if (path === '/api/results' || path === '/api/coupons') return await publicData(req, env, path.slice(5));
      if (path.startsWith('/api/')) return json({ok: false, error: 'not_found'}, 404);
      if (path.startsWith('/media/')) return await media(req, env, path.slice(7));
    } catch (err) {
      console.error(err && err.stack || err);
      return json({ok: false, error: 'server_error'}, 500);
    }
    return env.ASSETS.fetch(req);
  }
};

/* ---------------- 公開：データ ---------------- */
async function publicData(req, env, key) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ok: false, error: 'method'}, 405);
  const body = await env.STORE.get('data:' + key);
  /* まだ一度も反映していない → 404（サイトは同梱のサンプルデータを表示する） */
  if (body == null) return json({ok: false, error: 'empty'}, 404, {'Cache-Control': 'no-store'});
  return new Response(body, {headers: secure({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60'
  })});
}

/* ---------------- 公開：写真 ---------------- */
async function media(req, env, name) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', {status: 405});
  if (!NAME_RE.test(name)) return new Response('Not Found', {status: 404, headers: secure({})});
  const {value, metadata} = await env.STORE.getWithMetadata('img:' + name, {type: 'arrayBuffer'});
  if (!value) return new Response('Not Found', {status: 404, headers: secure({'Cache-Control': 'no-store'})});
  const type = (metadata && metadata.type) || IMG_TYPES[name.split('.').pop()];
  return new Response(req.method === 'HEAD' ? null : value, {headers: secure({
    'Content-Type': type,
    'Cache-Control': 'public, max-age=604800',
    'Content-Disposition': 'inline'
  })});
}

/* ---------------- Apps Script 専用 ---------------- */
async function admin(req, env, path) {
  if (!env.SYNC_SECRET || env.SYNC_SECRET.length < 32) return json({ok: false, error: 'secret_not_set'}, 503);
  if (!(await authorized(req, env.SYNC_SECRET))) return json({ok: false, error: 'unauthorized'}, 401);

  if (path === '/api/admin/media' && req.method === 'GET') {
    return json({ok: true, names: await listImages(env)});
  }

  if (path.startsWith('/api/admin/media/') && req.method === 'PUT') {
    const name = path.slice('/api/admin/media/'.length);
    if (!NAME_RE.test(name)) return json({ok: false, error: 'bad_name'}, 400);
    const type = (req.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ok: false, error: 'bad_type'}, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return json({ok: false, error: 'empty'}, 400);
    if (buf.byteLength > MAX_IMAGE_BYTES) return json({ok: false, error: 'too_large'}, 413);
    if (!looksLikeImage(new Uint8Array(buf))) return json({ok: false, error: 'not_image'}, 415);
    await env.STORE.put('img:' + name, buf, {metadata: {type, size: buf.byteLength, at: Date.now()}});
    return json({ok: true, name});
  }

  if (path === '/api/admin/sync' && req.method === 'POST') {
    let data;
    try { data = await req.json(); } catch (e) { return json({ok: false, error: 'bad_json'}, 400); }
    const out = {ok: true};
    const keep = new Set();
    let results = null;
    if (Array.isArray(data.results)) {
      results = data.results.slice(0, MAX_ITEMS).map(cleanResult).filter(Boolean);
      results.forEach((r) => r.images.forEach((p) => keep.add(p.slice('media/'.length))));
      out.results = await putIfChanged(env, 'data:results', JSON.stringify(results));
    }
    if (Array.isArray(data.coupons)) {
      const coupons = data.coupons.slice(0, MAX_ITEMS).map(cleanCoupon).filter(Boolean);
      out.coupons = await putIfChanged(env, 'data:coupons', JSON.stringify(coupons));
    }
    /* 実績が届いたときだけ、どの実績にも使われていない写真を削除（取り下げ） */
    if (results) {
      const removed = [];
      for (const name of await listImages(env)) {
        if (!keep.has(name)) { await env.STORE.delete('img:' + name); removed.push(name); }
      }
      out.removedImages = removed.length;
      /* 掲載データが参照しているのに、まだ保存されていない写真（Apps Script 側の送り漏れ） */
      const have = new Set(await listImages(env));
      out.missingImages = [...keep].filter((n) => !have.has(n));
    }
    return json(out);
  }

  return json({ok: false, error: 'not_found'}, 404);
}

async function authorized(req, secret) {
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  const enc = new TextEncoder();
  /* 長さの違いでも時間差が出ないよう、両方をハッシュしてから比べる */
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(m[1].trim())),
    crypto.subtle.digest('SHA-256', enc.encode(secret))
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function listImages(env) {
  const names = [];
  let cursor;
  do {
    const page = await env.STORE.list({prefix: 'img:', cursor});
    page.keys.forEach((k) => names.push(k.name.slice(4)));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return names;
}

/* 中身が変わったときだけ書き込む（KV の書き込み回数を節約） */
async function putIfChanged(env, key, value) {
  const cur = await env.STORE.get(key);
  if (cur === value) return 'unchanged';
  await env.STORE.put(key, value);
  return 'updated';
}

function looksLikeImage(b) {
  if (b.length < 12) return false;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;                      /* JPEG */
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;     /* PNG */
  return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
         b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;            /* WEBP */
}

/* ---------------- データの整形（掲載に必要な項目だけを残す） ---------------- */
function s(v, max) { return v == null ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 200); }
function d(v) { const m = s(v, 20).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[0] : ''; }

function cleanResult(r) {
  if (!r || typeof r !== 'object') return null;
  const brand = s(r.brand, 120), item = s(r.item, 200);
  if (!brand && !item) return null;
  const price = Number(r.price);
  const images = (Array.isArray(r.images) ? r.images : [])
    .map((p) => s(p, 120)).filter((p) => NAME_RE.test(p.replace(/^media\//, '')))
    .map((p) => 'media/' + p.replace(/^media\//, '')).slice(0, 20);
  return {
    date: d(r.date), brand, category: s(r.category, 60), item, size: s(r.size, 60), condition: s(r.condition, 60),
    price: Number.isFinite(price) && price >= 0 ? Math.round(price) : '',
    coupon: r.coupon === true, images
  };
}

function cleanCoupon(c) {
  if (!c || typeof c !== 'object') return null;
  const id = s(c.id, 40), title = s(c.title, 120);
  if (!id || !title) return null;
  return {
    id, title, rate: s(c.rate, 40), description: s(c.description, 600),
    notes: (Array.isArray(c.notes) ? c.notes : []).map((n) => s(n, 200)).filter(Boolean).slice(0, 10),
    image: s(c.image, 120).replace(/[^\w.\-\/]/g, ''),
    start: d(c.start), end: d(c.end), featured: c.featured === true, active: true
  };
}

/* ---------------- レスポンス ---------------- */
function secure(h) {
  return Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY'
  }, h);
}
function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {status: status || 200, headers: secure(Object.assign({
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  }, extra || {}))});
}
