/* 買取実績ページ：カテゴリーで絞り込み＋「もっと見る」で12件ずつ表示
   カテゴリーの一覧と並び順は assets/js/config.js の resultCategories で決めます。
   "category" が未記入、または一覧にない実績は「その他」として扱います。 */
(function(){
  var grid = document.getElementById('resultGrid');
  var filter = document.getElementById('resultFilter');
  var count = document.getElementById('resultCount');
  var moreWrap = document.getElementById('resultMoreWrap');
  var moreBtn = document.getElementById('resultMore');
  if(!grid || !window.AUG) return;
  var C = window.AUGUST_CONFIG || {};
  var CATS = Array.isArray(C.resultCategories) && C.resultCategories.length ? C.resultCategories :
    ['アメカジ', 'ヴィンテージ', 'ドメスティック', 'ハイブラインポートデザイナーズ', 'アウトドア', '靴', '鞄', 'アクセサリー・小物', 'レディース', 'その他'];
  var OTHER = CATS.indexOf('その他') >= 0 ? 'その他' : CATS[CATS.length - 1];
  var STEP = 12;
  var all = [], current = 'ALL', shown = STEP;

  function catOf(r){
    var c = String(r.category || '').trim();
    return CATS.indexOf(c) >= 0 ? c : OTHER;
  }

  function draw(){
    var rows = current === 'ALL' ? all : all.filter(function(r){ return catOf(r) === current; });
    if(!rows.length){
      grid.innerHTML = '<p class="datastate">' + (current === 'ALL' ? '買取実績は準備中です。' : '「' + AUG.esc(current) + '」の買取実績は準備中です。') + '</p>';
      count.textContent = '';
      moreWrap.hidden = true;
      return;
    }
    grid.innerHTML = rows.slice(0, shown).map(AUG.resultHTML).join('');
    count.textContent = rows.length + '件中 ' + Math.min(shown, rows.length) + '件を表示';
    moreWrap.hidden = shown >= rows.length;
  }

  AUG.load('results').then(function(list){
    all = AUG.sortedResults(list);
    var tally = {};
    all.forEach(function(r){ var c = catOf(r); tally[c] = (tally[c] || 0) + 1; });
    if(all.length){
      filter.innerHTML = '<button class="chip" type="button" data-c="ALL" aria-pressed="true">すべて<span class="n">' + all.length + '</span></button>' +
        CATS.map(function(c){
          var n = tally[c] || 0;
          return '<button class="chip' + (n ? '' : ' chip--empty') + '" type="button" data-c="' + AUG.esc(c) + '" aria-pressed="false">' + AUG.esc(c) + '<span class="n">' + n + '</span></button>';
        }).join('');
    }
    draw();
  }).catch(function(){
    grid.innerHTML = '<p class="datastate">買取実績を読み込めませんでした。時間をおいて再度お試しください。</p>';
  });

  filter.addEventListener('click', function(e){
    var b = e.target.closest('.chip');
    if(!b) return;
    current = b.getAttribute('data-c');
    shown = STEP;
    filter.querySelectorAll('.chip').forEach(function(c){ c.setAttribute('aria-pressed', String(c === b)); });
    draw();
  });
  moreBtn.addEventListener('click', function(){ shown += STEP; draw(); });
})();
