/* 取扱ブランドページ：data/brands.json からアルファベット順の一覧を作る */
(function(){
  var box = document.getElementById('brandIndex');
  var bar = document.getElementById('azbar');
  if(!box || !window.AUG) return;
  AUG.load('brands').then(function(list){
    var items = list.filter(function(b){ return b && b.name; });
    if(!items.length){ box.innerHTML = '<p class="datastate">ブランド一覧は準備中です。</p>'; return; }
    var key = function(n){ return n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); };
    items.sort(function(a, b){ return key(a.name) < key(b.name) ? -1 : key(a.name) > key(b.name) ? 1 : 0; });
    var groups = {}, order = [];
    items.forEach(function(b){
      var c = key(b.name).charAt(0);
      var g = /[A-Z]/.test(c) ? c : '0-9';
      if(!groups[g]){ groups[g] = []; order.push(g); }
      groups[g].push(b);
    });
    order.sort(function(a, b){ return a === '0-9' ? -1 : b === '0-9' ? 1 : a < b ? -1 : 1; });
    box.innerHTML = order.map(function(g){
      return '<section class="brandgroup" id="az-' + g + '"><h2>' + g + '</h2><ul>' +
        groups[g].map(function(b){
          return '<li><b>' + AUG.esc(b.name) + '</b>' + (b.kana ? '<span>' + AUG.esc(b.kana) + '</span>' : '') + '</li>';
        }).join('') + '</ul></section>';
    }).join('');
    if(bar) bar.innerHTML = order.map(function(g){ return '<a href="#az-' + g + '">' + g + '</a>'; }).join('');
  }).catch(function(){
    box.innerHTML = '<p class="datastate">ブランド一覧を読み込めませんでした。時間をおいて再度お試しください。</p>';
  });
})();
