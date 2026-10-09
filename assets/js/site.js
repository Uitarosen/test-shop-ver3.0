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
  AUG.img = function(path){ return ROOT + 'assets/img/' + String(path).replace(/^\/+/, ''); };
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

  var cache = {};
  AUG.load = function(name){
    if(!cache[name]){
      cache[name] = fetch(ROOT + 'data/' + name + '.json', {cache:'no-cache'})
        .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(d){ if(!Array.isArray(d)) throw new Error('not array'); return d; });
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
  AUG.resultHTML = function(r){
    var E = AUG.esc;
    var img = r.image
      ? '<img src="' + E(AUG.img(r.image)) + '" alt="' + E((r.brand || '') + ' ' + (r.item || '')) + '" data-brand="' + E(r.brand || '') + '" loading="lazy" onerror="AUG.noimg(this)">'
      : '<span class="result__noimg">' + E(r.brand || '') + '</span>';
    var meta = [];
    if(r.size) meta.push('サイズ ' + E(r.size));
    if(r.condition) meta.push(E(r.condition));
    return '<article class="result">' +
      '<div class="result__img">' + img + (r.date ? '<span class="result__date">' + AUG.dispDate(r.date) + '</span>' : '') + '</div>' +
      '<div class="result__body">' +
        '<p class="result__brand">' + E(r.brand || '') + '</p>' +
        (r.item ? '<p class="result__item">' + E(r.item) + '</p>' : '') +
        (AUG.yen(r.price) ? '<p class="result__price"><small>買取価格</small>' + AUG.yen(r.price) + '</p>' : '') +
        (meta.length ? '<p class="result__meta">' + meta.map(function(m){ return '<span>' + m + '</span>'; }).join('') + '</p>' : '') +
      '</div></article>';
  };

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
