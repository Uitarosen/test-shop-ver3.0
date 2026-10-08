/* 買取実績ページ：ブランドで絞り込み＋「もっと見る」で12件ずつ表示 */
(function(){
  var grid = document.getElementById('resultGrid');
  var filter = document.getElementById('resultFilter');
  var count = document.getElementById('resultCount');
  var moreWrap = document.getElementById('resultMoreWrap');
  var moreBtn = document.getElementById('resultMore');
  if(!grid || !window.AUG) return;
  var STEP = 12;
  var all = [], current = 'ALL', shown = STEP;

  function draw(){
    var rows = current === 'ALL' ? all : all.filter(function(r){ return r.brand === current; });
    if(!rows.length){ grid.innerHTML = '<p class="datastate">買取実績は準備中です。</p>'; count.textContent = ''; moreWrap.hidden = true; return; }
    grid.innerHTML = rows.slice(0, shown).map(AUG.resultHTML).join('');
    count.textContent = rows.length + '件中 ' + Math.min(shown, rows.length) + '件を表示';
    moreWrap.hidden = shown >= rows.length;
  }

  AUG.load('results').then(function(list){
    all = AUG.sortedResults(list);
    var tally = {};
    all.forEach(function(r){ if(r.brand) tally[r.brand] = (tally[r.brand] || 0) + 1; });
    var brands = Object.keys(tally).sort(function(a, b){ return tally[b] - tally[a] || (a < b ? -1 : 1); });
    if(brands.length > 1){
      filter.innerHTML = '<button class="chip" type="button" data-b="ALL" aria-pressed="true">すべて<span class="n">' + all.length + '</span></button>' +
        brands.map(function(b){
          return '<button class="chip" type="button" data-b="' + AUG.esc(b) + '" aria-pressed="false">' + AUG.esc(b) + '<span class="n">' + tally[b] + '</span></button>';
        }).join('');
    }
    draw();
  }).catch(function(){
    grid.innerHTML = '<p class="datastate">買取実績を読み込めませんでした。時間をおいて再度お試しください。</p>';
  });

  filter.addEventListener('click', function(e){
    var b = e.target.closest('.chip');
    if(!b) return;
    current = b.getAttribute('data-b');
    shown = STEP;
    filter.querySelectorAll('.chip').forEach(function(c){ c.setAttribute('aria-pressed', String(c === b)); });
    draw();
  });
  moreBtn.addEventListener('click', function(){ shown += STEP; draw(); });
})();
