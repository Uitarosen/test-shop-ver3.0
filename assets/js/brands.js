/* 取扱ブランドページ：data/brands.json から50音（ア行〜ワ行）の一覧を作る
   - 各ブランドの "group" に行の頭文字（ア・カ・サ・タ・ナ・ハ・マ・ヤ・ラ・ワ）を書く
   - 行の中は data/brands.json に書いた順番のまま表示する */
(function(){
  var box = document.getElementById('brandIndex');
  var bar = document.getElementById('azbar');
  if(!box || !window.AUG) return;
  var GROUPS = [
    {k:'ア', id:'a'}, {k:'カ', id:'ka'}, {k:'サ', id:'sa'}, {k:'タ', id:'ta'}, {k:'ナ', id:'na'},
    {k:'ハ', id:'ha'}, {k:'マ', id:'ma'}, {k:'ヤ', id:'ya'}, {k:'ラ', id:'ra'}, {k:'ワ', id:'wa'}
  ];
  AUG.load('brands').then(function(list){
    var items = list.filter(function(b){ return b && b.name; });
    if(!items.length){ box.innerHTML = '<p class="datastate">ブランド一覧は準備中です。</p>'; return; }
    var buckets = {}, other = [];
    items.forEach(function(b){
      var g = String(b.group || '').trim().charAt(0);
      if(GROUPS.some(function(x){ return x.k === g; })) (buckets[g] = buckets[g] || []).push(b);
      else other.push(b);
    });
    var shown = GROUPS.filter(function(g){ return buckets[g.k] && buckets[g.k].length; })
      .map(function(g){ return {label:g.k + '行', nav:g.k, id:'kana-' + g.id, list:buckets[g.k]}; });
    if(other.length) shown.push({label:'その他', nav:'他', id:'kana-other', list:other});
    box.innerHTML = shown.map(function(g){
      return '<section class="brandgroup" id="' + g.id + '"><h2>' + g.label + '</h2><ul>' +
        g.list.map(function(b){
          return '<li><b>' + AUG.esc(b.name) + '</b>' + (b.kana ? '<span>' + AUG.esc(b.kana) + '</span>' : '') + '</li>';
        }).join('') + '</ul></section>';
    }).join('');
    if(bar) bar.innerHTML = shown.map(function(g){ return '<a href="#' + g.id + '" aria-label="' + g.label + 'へ移動">' + g.nav + '</a>'; }).join('');
    if(AUG.realignHash) AUG.realignHash();
  }).catch(function(){
    box.innerHTML = '<p class="datastate">ブランド一覧を読み込めませんでした。時間をおいて再度お試しください。</p>';
  });
})();
