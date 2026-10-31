/* =========================================================
   共通スクリプト：ヘッダー/メニュー/フェードイン と
   データ（data/*.json）の読み込み・表示
   ========================================================= */
(function(){
  var ROOT = window.AUGUST_ROOT || '';
  var C = window.AUGUST_CONFIG || {};

  /* ---------------- utilities ---------------- */
  var AUG = window.AUG = {};

  AUG.esc = function(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };
  AUG.url = function(path){ return (ROOT + path) || './'; };
  AUG.img = function(path){
    var p = String(path || '').replace(/^\/+/, '');
    if(/^https?:\/\//.test(p)) return p;
    if(/^media\//.test(p)) return ROOT + p;   /* スプレッドシートから掲載した写真（Cloudflare） */
    return ROOT + 'assets/img/' + p;
  };
  AUG.yen = function(n){
    var v = Number(String(n).replace(/[^\d.-]/g, ''));
    return isFinite(v) && String(n) !== '' ? '¥' + Math.round(v).toLocaleString('ja-JP') : '';
  };
  AUG.today = function(){
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };
  AUG.normDate = function(s){
    var m = String(s || '').trim().match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
  };
  AUG.dispDate = function(s){
    var d = AUG.normDate(s);
    return d ? d.replace(/-/g, '.') : '';
  };
  /* 年月だけ（2026-10-03 → 2026.10）：買取実績の買取時期に使用 */
  AUG.dispMonth = function(s){
    var d = AUG.normDate(s);
    return d ? d.slice(0, 7).replace('-', '.') : '';
  };

  /* データの読み込み
     - 買取実績・クーポンは、スプレッドシートから掲載したデータ（Cloudflare の /api/）を優先
     - それが無い環境（GitHub Pages・プレビュー）や未反映のときは data/*.json を表示
     - keepSampleResults が true のあいだは、掲載した実績の下にサンプルの実績も並べる */
  var cache = {};
  var LIVE = { results: true, coupons: true };
  function getJSON(url, ms){
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl && ms ? setTimeout(function(){ ctrl.abort(); }, ms) : null;
    return fetch(url, {cache:'no-cache', signal: ctrl ? ctrl.signal : undefined})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){ if(timer) clearTimeout(timer); if(!Array.isArray(d)) throw new Error('not array'); return d; },
            function(e){ if(timer) clearTimeout(timer); throw e; });
  }
  AUG.load = function(name){
    if(!cache[name]){
      var local = function(){ return getJSON(ROOT + 'data/' + name + '.json'); };
      if(C.liveData === false || !LIVE[name]){
        cache[name] = local();
      } else {
        cache[name] = getJSON(ROOT + 'api/' + name, 8000).then(function(live){
          if(name === 'results' && C.keepSampleResults){
            live.forEach(function(r){ r._live = true; });
            return local().catch(function(){ return []; }).then(function(samples){ return live.concat(samples); });
          }
          return live;
        }, local);
      }
    }
    return cache[name];
  };

  /* クーポンの有効判定：active が true、開始日〜終了日の範囲内 */
  AUG.activeCoupons = function(list){
    var t = AUG.today();
    return list.filter(function(c){
      if(!c || c.active === false || !c.title) return false;
      var s = AUG.normDate(c.start), e = AUG.normDate(c.end);
      if(s && t < s) return false;
      if(e && t > e) return false;
      return true;
    }).sort(function(a, b){ return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
  };

  AUG.sortedResults = function(list){
    return list.filter(function(r){ return r && (r.brand || r.item); })
      .map(function(r, i){ return {r:r, i:i}; })
      .sort(function(a, b){
        /* スプレッドシートから掲載した実績を、サンプルより先に */
        if(!!a.r._live !== !!b.r._live) return a.r._live ? -1 : 1;
        var da = AUG.normDate(a.r.date), db = AUG.normDate(b.r.date);
        if(da !== db) return da < db ? 1 : -1;
        return b.i - a.i; /* 同じ日付は後に書いたものを先に */
      })
      .map(function(x){ return x.r; });
  };

  /* ページ内リンク（#form など）で開いたとき、クーポンや実績の読み込みで
     ページが伸びて位置がずれるので、読み込み後に目的の位置へ合わせ直す。
     ユーザーが自分でスクロールし始めたら合わせ直さない。 */
  var userMoved = false;
  ['wheel','touchmove','keydown','mousedown'].forEach(function(ev){
    window.addEventListener(ev, function(){ userMoved = true; }, {passive:true, once:true});
  });
  AUG.realignHash = function(){
    if(userMoved || !location.hash || location.hash.length < 2) return;
    var id; try{ id = decodeURIComponent(location.hash.slice(1)); }catch(_){ return; }
    var el = document.getElementById(id);
    if(!el || el.id === 'main') return;
    /* 表示アニメーション（transform）の影響を受けないよう、レイアウト上の位置で計算 */
    var y = 0, n = el;
    while(n){ y += n.offsetTop; n = n.offsetParent; }
    var margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    window.scrollTo({top: Math.max(0, y - margin), behavior:'instant'});
  };
  /* ページを開いたときの位置を整える
     - #付きのリンク（#form など）：目的の見出しの位置へ
     - #なしのリンク：必ずページの先頭へ（プレビュー環境などで直前のスクロール位置が
       引き継がれてしまうのを防ぐ）。再読み込み・戻るボタンのときは元の位置のまま */
  var navType = '';
  try{ var ne = performance.getEntriesByType('navigation')[0]; navType = ne ? ne.type : ''; }catch(_){}
  AUG.settleScroll = function(){
    if(userMoved) return;
    if(location.hash && location.hash.length > 1){ AUG.realignHash(); return; }
    if(navType === 'reload' || navType === 'back_forward') return;
    if(window.scrollY !== 0) window.scrollTo({top:0, behavior:'instant'});
  };
  if('scrollRestoration' in history && navType === 'navigate') history.scrollRestoration = 'manual';
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', AUG.settleScroll);
  else AUG.settleScroll();
  window.addEventListener('load', AUG.settleScroll);
  window.addEventListener('pageshow', function(e){ if(!e.persisted) AUG.settleScroll(); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(AUG.settleScroll);
  [150, 500, 1200, 2000].forEach(function(ms){ setTimeout(AUG.settleScroll, ms); });

  function state(el, msg){ el.innerHTML = '<p class="datastate">' + msg + '</p>'; }

  /* ---------------- coupons ---------------- */
  function couponHTML(c){
    var E = AUG.esc;
    var notes = Array.isArray(c.notes) && c.notes.length
      ? '<ul class="coupon__notes">' + c.notes.map(function(n){ return '<li>' + E(n) + '</li>'; }).join('') + '</ul>' : '';
    var end = AUG.normDate(c.end);
    var meta = '<p class="coupon__meta"><span>クーポンID <b>' + E(c.id || '') + '</b></span>' +
      '<span>' + (end ? '有効期限 ' + AUG.dispDate(end) + 'まで' : '有効期限 なし') + '</span></p>';
    var href = AUG.url('buy/') + '?coupon=' + encodeURIComponent(c.id || '') + '#form';
    var cta = '<p class="coupon__cta"><a class="btn ' + (c.featured ? 'btn--light' : 'btn--ghost') + ' btn--sm btn--arrow" href="' + href + '" data-coupon-apply="' + E(c.id || '') + '">このクーポンで申し込む</a></p>';
    var img = c.image ? '<div class="coupon__img"><img src="' + E(AUG.img(c.image)) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></div>' : '';
    var rate = c.rate ? '<p class="coupon__rate">' + E(c.rate) + '</p>' : '';

    if(c.featured){
      return '<article class="coupon coupon--featured">' +
        '<div class="coupon__hero"><span class="label">Coupon</span>' + rate + '<h3 class="coupon__title">' + E(c.title) + '</h3></div>' +
        '<div class="coupon__body">' + img +
          (c.description ? '<p class="coupon__desc">' + E(c.description) + '</p>' : '') +
          notes + meta + cta +
        '</div></article>';
    }
    return '<article class="coupon">' + img +
      '<div class="coupon__body"><span class="label">Coupon</span>' + rate +
        '<h3 class="coupon__title">' + E(c.title) + '</h3>' +
        (c.description ? '<p class="coupon__desc">' + E(c.description) + '</p>' : '') +
        notes + meta + cta +
      '</div></article>';
  }

  AUG.renderCoupons = function(el){
    AUG.load('coupons').then(function(list){
      var act = AUG.activeCoupons(list);
      if(!act.length){ state(el, '現在ご利用いただけるクーポンはありません。'); return; }
      /* 使い方はカードごとに繰り返さず、一覧の下に1回だけ表示 */
      el.innerHTML = act.map(couponHTML).join('') +
        '<dl class="coupon-how"><div><dt>買取フォーム</dt><dd>「利用するクーポン」で選ぶだけ</dd></div>' +
        '<div><dt>LINE査定</dt><dd>最初のメッセージでクーポンIDを送信</dd></div>' +
        '<div><dt>店頭買取</dt><dd>クーポンの画面をスタッフにご提示</dd></div></dl>';
      document.dispatchEvent(new CustomEvent('aug:coupons', {detail:act}));
      AUG.realignHash();
    }).catch(function(){ state(el, 'クーポン情報を読み込めませんでした。時間をおいて再度お試しください。'); });
  };

  /* トップの最初の画面に、おすすめ（featured）のクーポンを1つ表示。なければ非表示 */
  AUG.renderHeroCoupon = function(el){
    AUG.load('coupons').then(function(list){
      var c = AUG.activeCoupons(list)[0];
      if(!c){ el.hidden = true; return; }
      el.innerHTML = '<span class="hero__badge-k">Coupon</span>' + AUG.esc(c.title);
      el.href = AUG.url('buy/') + '#coupons';
      el.hidden = false;
    }).catch(function(){ el.hidden = true; });
  };

  /* ---------------- results ---------------- */
  /* 写真の一覧："images"（複数）を優先。従来の "image"（1枚）もそのまま使える */
  AUG.resultPhotos = function(r){
    var list = Array.isArray(r.images) ? r.images : (r.image ? [r.image] : []);
    return list.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  };
  var resultStore = [];
  AUG.resultHTML = function(r){
    var E = AUG.esc;
    var photos = AUG.resultPhotos(r);
    var label = ((r.brand || '') + ' ' + (r.item || '')).trim();
    var idx = -1;
    if(photos.length){ idx = resultStore.indexOf(r); if(idx < 0){ idx = resultStore.length; resultStore.push(r); } }
    var img = photos.length
      ? '<img src="' + E(AUG.img(photos[0])) + '" alt="' + E(label) + '" data-brand="' + E(r.brand || '') + '" loading="lazy" onerror="AUG.noimg(this)">'
      : '<span class="result__noimg">' + E(r.brand || '') + '</span>';
    var count = photos.length > 1 ? '<span class="result__count" aria-hidden="true">' + photos.length + '枚</span>' : '';
    var media = '<div class="result__img">' + img + (r.date ? '<span class="result__date">' + AUG.dispMonth(r.date) + '</span>' : '') + count + '</div>';
    if(idx >= 0){
      media = '<button class="result__open" type="button" data-result-open="' + idx + '" aria-label="' + E(label + 'の写真を見る' + (photos.length > 1 ? '（' + photos.length + '枚）' : '')) + '">' + media + '</button>';
    }
    var meta = [];
    if(r.size) meta.push('サイズ ' + E(r.size));
    if(r.condition) meta.push(E(r.condition));
    var coupon = r.coupon === true ? '<span class="result__coupon">クーポン利用</span>' : '';
    return '<article class="result">' + media +
      '<div class="result__body">' +
        '<p class="result__brand">' + E(r.brand || '') + '</p>' +
        (r.item ? '<p class="result__item">' + E(r.item) + '</p>' : '') +
        (AUG.yen(r.price) ? '<p class="result__price"><small>買取価格</small>' + AUG.yen(r.price) + coupon + '</p>' : '') +
        (meta.length ? '<p class="result__meta">' + meta.map(function(m){ return '<span>' + m + '</span>'; }).join('') + '</p>' : '') +
      '</div></article>';
  };

  /* 買取実績の写真の拡大表示（矢印・スワイプ・←→キーで切り替え、×・Esc・背景で閉じる） */
  var lb = null, lbRow = null, lbPhotos = [], lbAt = 0, lbBack = null;
  function lbBuild(){
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-labelledby', 'lbTitle');
    lb.innerHTML =
      '<div class="lightbox__bar">' +
        '<p class="lightbox__title" id="lbTitle"></p>' +
        '<button class="lightbox__close" type="button" data-lb="close" aria-label="閉じる">×</button>' +
      '</div>' +
      '<div class="lightbox__stage" data-lb="stage">' +
        '<img class="lightbox__img" alt="">' +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" data-lb="prev" aria-label="前の写真">‹</button>' +
        '<button class="lightbox__nav lightbox__nav--next" type="button" data-lb="next" aria-label="次の写真">›</button>' +
      '</div>' +
      '<div class="lightbox__foot">' +
        '<p class="lightbox__meta"></p>' +
        '<p class="lightbox__count" aria-live="polite"></p>' +
        '<div class="lightbox__dots" data-lb="dots"></div>' +
      '</div>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function(e){
      if(swiped){ swiped = false; return; } /* スワイプの直後のクリックでは閉じない */
      var t = e.target.closest('[data-lb]');
      var k = t ? t.getAttribute('data-lb') : '';
      if(k === 'close' || e.target === lb || (k === 'stage' && e.target === t)) return lbClose();
      if(k === 'prev') return lbGo(lbAt - 1);
      if(k === 'next') return lbGo(lbAt + 1);
      var dot = e.target.closest('[data-lb-dot]');
      if(dot) lbGo(Number(dot.getAttribute('data-lb-dot')));
    });
    /* スワイプ */
    var sx = null, sy = 0, swiped = false;
    var stage = lb.querySelector('.lightbox__stage');
    stage.addEventListener('pointerdown', function(e){ sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', function(e){
      if(sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      swiped = Math.abs(dx) > 10 || Math.abs(dy) > 10;
      if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) lbGo(lbAt + (dx < 0 ? 1 : -1));
      if(swiped) setTimeout(function(){ swiped = false; }, 400);
    });
    document.addEventListener('keydown', function(e){
      if(!lb || lb.hidden) return;
      if(e.key === 'Escape'){ e.preventDefault(); lbClose(); }
      else if(e.key === 'ArrowLeft') lbGo(lbAt - 1);
      else if(e.key === 'ArrowRight') lbGo(lbAt + 1);
      else if(e.key === 'Tab'){
        var f = Array.prototype.filter.call(lb.querySelectorAll('button'), function(b){ return !b.hidden && b.offsetParent !== null; });
        if(!f.length) return;
        var i = f.indexOf(document.activeElement);
        if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
        else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
      }
    });
  }
  function lbGo(n){
    if(!lbPhotos.length) return;
    lbAt = (n + lbPhotos.length) % lbPhotos.length;
    var img = lb.querySelector('.lightbox__img');
    img.src = AUG.img(lbPhotos[lbAt]);
    img.alt = ((lbRow.brand || '') + ' ' + (lbRow.item || '')).trim() + '（' + (lbAt + 1) + '枚目）';
    var many = lbPhotos.length > 1;
    lb.querySelectorAll('.lightbox__nav').forEach(function(b){ b.hidden = !many; });
    lb.querySelector('.lightbox__count').textContent = many ? (lbAt + 1) + ' / ' + lbPhotos.length : '';
    lb.querySelectorAll('[data-lb-dot]').forEach(function(d, i){ d.setAttribute('aria-current', String(i === lbAt)); });
    /* 次の写真を先に読み込む */
    if(many){ var pre = new Image(); pre.src = AUG.img(lbPhotos[(lbAt + 1) % lbPhotos.length]); }
  }
  function lbOpen(r, from){
    if(!lb) lbBuild();
    lbRow = r; lbPhotos = AUG.resultPhotos(r); lbBack = from || null;
    var E = AUG.esc;
    lb.querySelector('.lightbox__title').innerHTML = '<b>' + E(r.brand || '') + '</b>' + (r.item ? '<span>' + E(r.item) + '</span>' : '');
    var meta = [];
    if(AUG.yen(r.price)) meta.push('<span class="lightbox__price">買取価格 ' + AUG.yen(r.price) + '</span>' + (r.coupon === true ? '<span class="result__coupon">クーポン利用</span>' : ''));
    if(r.date) meta.push('<span>' + AUG.dispMonth(r.date) + '</span>');
    if(r.size) meta.push('<span>サイズ ' + E(r.size) + '</span>');
    if(r.condition) meta.push('<span>' + E(r.condition) + '</span>');
    lb.querySelector('.lightbox__meta').innerHTML = meta.join('');
    lb.querySelector('[data-lb="dots"]').innerHTML = lbPhotos.length > 1 ? lbPhotos.map(function(_, i){
      return '<button type="button" data-lb-dot="' + i + '" aria-label="' + (i + 1) + '枚目を表示"></button>';
    }).join('') : '';
    lb.hidden = false;
    document.documentElement.classList.add('is-lightbox');
    lbGo(0);
    lb.querySelector('.lightbox__close').focus();
  }
  function lbClose(){
    if(!lb) return;
    lb.hidden = true;
    document.documentElement.classList.remove('is-lightbox');
    lb.querySelector('.lightbox__img').removeAttribute('src');
    if(lbBack && document.contains(lbBack)) lbBack.focus({preventScroll:true});
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-result-open]');
    if(!b) return;
    var r = resultStore[Number(b.getAttribute('data-result-open'))];
    if(r) lbOpen(r, b);
  });

  AUG.noimg = function(img){
    var s = document.createElement('span');
    s.className = 'result__noimg';
    s.textContent = img.getAttribute('data-brand') || '';
    img.replaceWith(s);
  };

  AUG.renderResults = function(el){
    var limit = parseInt(el.getAttribute('data-limit'), 10) || 0;
    AUG.load('results').then(function(list){
      var rows = AUG.sortedResults(list);
      if(limit) rows = rows.slice(0, limit);
      if(!rows.length){ state(el, '買取実績は準備中です。'); return; }
      el.innerHTML = rows.map(AUG.resultHTML).join('');
      AUG.realignHash();
    }).catch(function(){ state(el, '買取実績を読み込めませんでした。時間をおいて再度お試しください。'); });
  };

  /* ---------------- brand marquee (top) ---------------- */
  AUG.renderMarquee = function(el){
    AUG.load('brands').then(function(list){
      var rows = [[], []];
      list.forEach(function(b){
        if(!b || !b.name) return;
        var m = Number(b.marquee);
        if(m === 1 || m === 2) rows[m - 1].push(b.name);
      });
      var tracks = el.querySelectorAll('.marquee__track');
      rows.forEach(function(names, i){
        if(!names.length || !tracks[i]) return;
        var one = function(hidden){
          return names.map(function(n){
            return '<span' + (hidden ? ' aria-hidden="true"' : '') + '>' + AUG.esc(n) + '</span><span aria-hidden="true">/</span>';
          }).join('');
        };
        /* 2周分並べてループさせる（短いリストは更に繰り返す） */
        var reps = Math.max(1, Math.ceil(6 / names.length));
        var block = '';
        for(var k = 0; k < reps; k++) block += one(k > 0);
        tracks[i].innerHTML = block + block.replace(/<span>/g, '<span aria-hidden="true">');
      });
    }).catch(function(){ /* 失敗時は HTML に書かれた初期表示のまま */ });
  };

  /* ---------------- page chrome ---------------- */
  function chrome(){
    /* header: solid once past the hero */
    var header = document.getElementById('siteHeader');
    var dock = document.getElementById('dock');
    var hero = document.getElementById('top');
    if(header){
      if(hero && 'IntersectionObserver' in window){
        var io = new IntersectionObserver(function(entries){
          entries.forEach(function(e){
            header.classList.toggle('is-solid', !e.isIntersecting);
            if(dock) dock.classList.toggle('is-on', !e.isIntersecting);
          });
        }, {rootMargin:'-72px 0px 0px 0px', threshold:0});
        io.observe(hero);
      } else {
        header.classList.add('is-solid');
        if(dock) dock.classList.add('is-on');
      }
    }

    /* mobile menu */
    var burger = document.getElementById('burger');
    var menu = document.getElementById('menu');
    if(burger && menu){
      var setOpen = function(open){
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
        menu.hidden = !open;
        document.body.style.overflow = open ? 'hidden' : '';
      };
      burger.addEventListener('click', function(){ setOpen(burger.getAttribute('aria-expanded') !== 'true'); });
      menu.addEventListener('click', function(e){ if(e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function(e){
        if(e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') setOpen(false);
      });
    }

    /* reveal on scroll */
    var items = document.querySelectorAll('.reveal');
    if(items.length){
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reduce || !('IntersectionObserver' in window)){
        items.forEach(function(el){ el.classList.add('is-in'); });
      } else {
        var ro = new IntersectionObserver(function(entries){
          entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-in'); ro.unobserve(e.target); } });
        }, {rootMargin:'0px 0px -12% 0px', threshold:0.05});
        items.forEach(function(el){
          if(el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
          else ro.observe(el);
        });
      }
    }

    /* 紹介文の「詳しく読む」（スマホのみ折りたたみ） */
    document.querySelectorAll('.readmore').forEach(function(btn){
      var box = document.getElementById(btn.getAttribute('aria-controls'));
      if(!box) return;
      btn.addEventListener('click', function(){
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        box.classList.toggle('is-open', open);
        btn.textContent = open ? '閉じる' : 'お店について詳しく読む';
      });
    });

    /* data blocks */
    document.querySelectorAll('[data-coupons]').forEach(AUG.renderCoupons);
    document.querySelectorAll('[data-hero-coupon]').forEach(AUG.renderHeroCoupon);
    document.querySelectorAll('[data-results]').forEach(AUG.renderResults);
    document.querySelectorAll('[data-marquee]').forEach(AUG.renderMarquee);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chrome);
  else chrome();
})();
