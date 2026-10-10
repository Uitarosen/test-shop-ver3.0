/* =========================================================
   共通レイアウト（ヘッダー・メニュー・フッター・追従CTA）
   ナビの項目を変えるときは NAV / FOOTER_LINKS を編集してください。
   各ページの <html data-root="../" data-page="buy"> を参照します。
   ========================================================= */
(function(){
  var html = document.documentElement;
  html.classList.add('js');
  var ROOT = html.getAttribute('data-root') || '';
  var PAGE = html.getAttribute('data-page') || 'home';
  var C = window.AUGUST_CONFIG || {};
  html.setAttribute('data-page', PAGE);

  function p(path){ return (ROOT + path) || './'; }
  function cur(key){ return key === PAGE ? ' aria-current="page"' : ''; }

  var NAV = [
    {key:'buy',     label:'買取について', href:'buy/'},
    {key:'results', label:'買取実績',     href:'results/'},
    {key:'brands',  label:'取扱ブランド', href:'brands/'},
    {key:'store',   label:'ショップ・通販', href:'store/'}
  ];
  var FOOTER_LINKS = [
    {key:'home',    label:'トップ',       href:''},
    {key:'buy',     label:'買取について', href:'buy/'},
    {key:'',        label:'買取フォーム', href:'buy/#form'},
    {key:'',        label:'LINE査定',     href:'buy/#line'},
    {key:'results', label:'買取実績',     href:'results/'},
    {key:'brands',  label:'取扱ブランド', href:'brands/'},
    {key:'store',   label:'ショップ・通販', href:'store/'},
    {key:'',        label:'restore',      href:'#restore'},
    {key:'',        label:'Instagram',    href:C.instagram, ext:true}
  ];

  function navLinks(){
    return NAV.map(function(n){ return '<a href="' + p(n.href) + '"' + cur(n.key) + '>' + n.label + '</a>'; }).join('');
  }

  var header =
    '<header class="site-header" id="siteHeader">' +
      '<div class="wrap site-header__inner">' +
        '<a class="brand" href="' + p('') + '" aria-label="August Buy&amp;Sell トップへ">' +
          '<img class="brand__logo brand__logo--light" src="' + ROOT + 'assets/img/logo-ivory.png" alt="" width="642" height="211">' +
          '<img class="brand__logo brand__logo--dark" src="' + ROOT + 'assets/img/logo-ink.png" alt="" width="642" height="211">' +
        '</a>' +
        '<nav class="nav" aria-label="メインメニュー">' + navLinks() +
          '<a class="btn btn--light btn--sm" href="' + p('buy/#form') + '">買取フォーム</a>' +
          '<a class="btn btn--outline-light btn--sm" href="' + p('buy/#line') + '">LINE査定</a>' +
        '</nav>' +
        '<button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="メニューを開く"><span></span><span></span></button>' +
      '</div>' +
    '</header>' +
    '<div class="menu" id="menu" hidden>' +
      '<a href="' + p('') + '"' + cur('home') + '>トップ</a>' + navLinks() +
      '<a href="' + C.instagram + '" target="_blank" rel="noopener">Instagram</a>' +
      '<div class="menu__cta">' +
        '<a class="btn btn--light" href="' + p('buy/#form') + '">買取フォーム</a>' +
        '<a class="btn btn--outline-light" href="' + p('buy/#line') + '">LINE査定</a>' +
      '</div>' +
    '</div>';

  var footer =
    '<footer class="footer">' +
      '<div class="wrap">' +
        '<div class="footer__top">' +
          '<div>' +
            '<p class="footer__name"><img src="' + ROOT + 'assets/img/logo-ivory.png" alt="August Buy&amp;Sell" width="642" height="211"></p>' +
            '<address>アメカジ・ブランド古着の買取と販売<br>' + (C.address || '') + '<br>' + (C.license || '') + '</address>' +
          '</div>' +
          '<nav class="footer__links" aria-label="フッターメニュー">' +
            FOOTER_LINKS.map(function(l){
              var href = l.ext ? l.href : (l.href.charAt(0) === '#' ? p('') + l.href : p(l.href));
              if(l.href === '#restore' && PAGE === 'home') href = '#restore';
              return '<a href="' + href + '"' + (l.ext ? ' target="_blank" rel="noopener"' : cur(l.key)) + '>' + l.label + '</a>';
            }).join('') +
            '<a href="' + p('buy/#form') + '">お問い合せ</a>' +
          '</nav>' +
        '</div>' +
        '<p class="footer__bottom">© AUGUST SHOP</p>' +
      '</div>' +
    '</footer>' +
    '<div class="dock" id="dock">' +
      '<a class="btn btn--white" href="' + p('buy/#form') + '">買取フォーム</a>' +
      '<a class="btn btn--wire" href="' + p('buy/#line') + '">LINE査定</a>' +
    '</div>';

  function swap(sel, markup){
    var slot = document.querySelector(sel);
    if(!slot) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    while(tmp.firstChild) slot.parentNode.insertBefore(tmp.firstChild, slot);
    slot.parentNode.removeChild(slot);
  }

  /* 設定値の差し込み（<span data-cfg="address"></span> など） */
  function fillConfig(){
    document.querySelectorAll('[data-cfg]').forEach(function(el){
      var v = C[el.getAttribute('data-cfg')];
      if(v != null && v !== '') el.textContent = v;
    });
    document.querySelectorAll('[data-line-link]').forEach(function(el){
      if(C.lineUrl){ el.href = C.lineUrl; el.hidden = false; }
      else { el.hidden = true; }
    });
    /* 「LINE査定」ボタン（buy/#line へのリンク）と LINE ID の表記は、LINE の友だち追加へ直接リンクする */
    if(C.lineUrl){
      document.querySelectorAll('a[href$="#line"], a[data-line-href]').forEach(function(el){
        el.href = C.lineUrl;
        el.target = '_blank';
        el.rel = 'noopener';
      });
    }
  }

  /* ヘッダーはこのスクリプトの直前のスロットへ即時に描画（ちらつき防止） */
  swap('[data-include="header"]', header);

  function late(){
    swap('[data-include="footer"]', footer);
    fillConfig();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', late);
  else late();

  window.AUGUST_ROOT = ROOT;
})();
