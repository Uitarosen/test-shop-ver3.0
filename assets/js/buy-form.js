/* =========================================================
   買取フォーム
   - アイテムの追加/削除
   - 写真の選択・プレビュー・ブラウザ側での縮小（JPEG）
   - 入力チェック、二重送信防止、Google Apps Script への送信
   ========================================================= */
(function(){
  var form = document.getElementById('buyform');
  if(!form || !window.AUG) return;

  var C = window.AUGUST_CONFIG || {};
  var MAX_PHOTOS = C.photoMaxPerItem || 5;
  var MAX_EDGE = C.photoMaxEdge || 1600;
  var QUALITY = C.photoQuality || 0.82;
  var MAX_ITEMS = C.itemMax || 20;
  var ENDPOINT = (C.formEndpoint || '').trim();

  var list = document.getElementById('items');
  var tpl = document.getElementById('itemTpl');
  var addBtn = document.getElementById('addItem');
  var itemsErr = document.getElementById('itemsErr');
  var status = document.getElementById('formStatus');
  var submitBtn = document.getElementById('submitBtn');
  var couponSel = document.getElementById('f-coupon');
  var done = document.getElementById('formDone');
  var seq = 0;
  var sending = false;

  document.getElementById('photoMax').textContent = MAX_PHOTOS;
  if(!ENDPOINT) document.getElementById('endpointWarn').hidden = false;

  /* ---------------- items ---------------- */
  function items(){ return Array.prototype.slice.call(list.querySelectorAll('[data-item]')); }

  function renumber(){
    var all = items();
    all.forEach(function(el, i){
      el.querySelector('[data-no]').textContent = i + 1;
      el.querySelector('[data-remove]').disabled = all.length === 1;
    });
    addBtn.disabled = all.length >= MAX_ITEMS;
    addBtn.textContent = all.length >= MAX_ITEMS ? 'アイテムは' + MAX_ITEMS + '点までです' : 'アイテムを追加';
  }

  function addItem(focus){
    if(items().length >= MAX_ITEMS) return;
    seq++;
    var node = tpl.content.firstElementChild.cloneNode(true);
    node._photos = [];
    node.querySelectorAll('[data-k], [data-file]').forEach(function(inp){
      var k = inp.getAttribute('data-k') || 'file';
      inp.id = 'it' + seq + '-' + k;
    });
    node.querySelectorAll('label[data-for]').forEach(function(lb){
      lb.setAttribute('for', 'it' + seq + '-' + lb.getAttribute('data-for'));
    });
    node.querySelector('[data-max]').textContent = MAX_PHOTOS;
    list.appendChild(node);
    renumber();
    itemsErr.hidden = true;
    if(focus){
      node.scrollIntoView({block:'center', behavior:'smooth'});
      node.querySelector('[data-k="brand"]').focus({preventScroll:true});
    }
  }

  addBtn.addEventListener('click', function(){ addItem(true); });

  list.addEventListener('click', function(e){
    var rm = e.target.closest('[data-remove]');
    if(rm){
      var block = rm.closest('[data-item]');
      if(items().length <= 1) return;
      (block._photos || []).forEach(function(p){ if(p.url) URL.revokeObjectURL(p.url); });
      block.remove();
      renumber();
      return;
    }
    var del = e.target.closest('[data-del-photo]');
    if(del){
      var blk = del.closest('[data-item]');
      var id = del.getAttribute('data-del-photo');
      blk._photos = blk._photos.filter(function(p){
        if(p.id === id){ if(p.url) URL.revokeObjectURL(p.url); return false; }
        return true;
      });
      del.parentNode.remove();
      blk.querySelector('[data-photomsg]').hidden = true;
    }
  });

  /* ---------------- photos ---------------- */
  function loadImage(file){
    if(window.createImageBitmap){
      return createImageBitmap(file, {imageOrientation:'from-image'}).catch(function(){ return createImageBitmap(file); }).catch(function(){ return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){ resolve(img); setTimeout(function(){ URL.revokeObjectURL(url); }, 0); };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function shrink(file){
    return loadImage(file).then(function(img){
      var w = img.width, h = img.height;
      var s = Math.min(1, MAX_EDGE / Math.max(w, h));
      var cw = Math.round(w * s), ch = Math.round(h * s);
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      if(img.close) img.close();
      return new Promise(function(resolve, reject){
        cv.toBlob(function(b){ b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', QUALITY);
      });
    });
  }

  list.addEventListener('change', function(e){
    var input = e.target;
    if(!input.matches('[data-file]')) return;
    var block = input.closest('[data-item]');
    var thumbs = block.querySelector('[data-thumbs]');
    var msg = block.querySelector('[data-photomsg]');
    var files = Array.prototype.slice.call(input.files || []).filter(function(f){ return /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name); });
    var room = MAX_PHOTOS - block._photos.length;
    msg.hidden = true;
    if(files.length > room){
      msg.textContent = '写真は1アイテムにつき' + MAX_PHOTOS + '枚までです。' + (room > 0 ? '最初の' + room + '枚だけ追加しました。' : 'これ以上追加できません。不要な写真を削除してから選び直してください。');
      msg.hidden = false;
      files = files.slice(0, Math.max(0, room));
    }
    files.forEach(function(file){
      var id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var entry = {id:id, name:file.name, blob:null, url:null, busy:true};
      block._photos.push(entry);
      var t = document.createElement('div');
      t.className = 'thumb is-busy';
      t.innerHTML = '<button type="button" data-del-photo="' + id + '" aria-label="この写真を削除">×</button>';
      thumbs.appendChild(t);
      shrink(file).then(function(blob){
        entry.blob = blob; entry.busy = false;
        entry.url = URL.createObjectURL(blob);
        var im = document.createElement('img');
        im.src = entry.url; im.alt = file.name;
        t.insertBefore(im, t.firstChild);
        t.classList.remove('is-busy');
      }).catch(function(){
        block._photos = block._photos.filter(function(p){ return p !== entry; });
        t.remove();
        msg.textContent = '「' + file.name + '」を読み込めませんでした。JPEG・PNG形式の写真をお試しください。';
        msg.hidden = false;
      });
    });
    input.value = '';
  });

  /* ---------------- coupons & brands ---------------- */
  var wanted = (new URLSearchParams(location.search).get('coupon') || '').trim();
  AUG.load('coupons').then(function(all){
    AUG.activeCoupons(all).forEach(function(c){
      var o = document.createElement('option');
      o.value = c.id || c.title;
      o.textContent = c.title + (c.id ? '（' + c.id + '）' : '');
      couponSel.appendChild(o);
    });
    if(wanted) couponSel.value = wanted;
    if(couponSel.selectedIndex < 0) couponSel.value = '';
  }).catch(function(){});

  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-coupon-apply]');
    if(!a) return;
    e.preventDefault();
    couponSel.value = a.getAttribute('data-coupon-apply');
    if(couponSel.selectedIndex < 0) couponSel.value = '';
    document.getElementById('form').scrollIntoView({behavior:'smooth'});
    setTimeout(function(){ couponSel.focus({preventScroll:true}); }, 600);
  });

  AUG.load('brands').then(function(all){
    var dl = document.getElementById('brandList');
    dl.innerHTML = all.filter(function(b){ return b && b.name; })
      .map(function(b){ return '<option value="' + AUG.esc(b.name) + '">'; }).join('');
  }).catch(function(){});

  /* 買取方法で入力欄を出し分ける（宅配：郵便番号・住所・配送キット／店頭：来店予定日）
     隠れている欄は disabled にして、必須チェックと送信の対象から外す */
  var branches = Array.prototype.slice.call(form.querySelectorAll('[data-branch]'));
  function currentMethod(){ var r = form.querySelector('input[name="method"]:checked'); return r ? r.value : ''; }
  function applyMethod(){
    var m = currentMethod();
    branches.forEach(function(b){
      var on = b.getAttribute('data-branch') === m;
      b.hidden = !on;
      b.querySelectorAll('input, select, textarea').forEach(function(el){
        el.disabled = !on;
        if(!on){
          if(el.type === 'radio' || el.type === 'checkbox') el.checked = false;
          clearError(el);
        }
      });
    });
  }
  form.addEventListener('change', function(e){ if(e.target.name === 'method') applyMethod(); });

  /* 来店予定日は今日以降 */
  var visit = document.getElementById('f-visit');
  if(visit) visit.min = AUG.today();

  /* 郵便番号から住所を自動入力（zipcloud・JSONP。失敗しても手入力できます） */
  var zip = document.getElementById('f-zip');
  var addr = document.getElementById('f-addr');
  var zipHint = document.getElementById('zipHint');
  var lastAuto = '', lastZip = '';
  function lookupZip(code){
    var cb = 'augZip' + Date.now();
    var sc = document.createElement('script');
    var done = function(){ try{ delete window[cb]; }catch(_){ window[cb] = undefined; } sc.remove(); };
    var timer = setTimeout(done, 6000);
    window[cb] = function(res){
      clearTimeout(timer); done();
      var r = res && res.results && res.results[0];
      if(!r){ zipHint.textContent = '該当する住所が見つかりませんでした。ご住所を直接ご入力ください。'; return; }
      var a = r.address1 + r.address2 + r.address3;
      if(!addr.value.trim() || addr.value === lastAuto){
        addr.value = a; lastAuto = a;
        clearError(addr);
        addr.focus();
        try{ addr.setSelectionRange(a.length, a.length); }catch(_){}
      }
      zipHint.textContent = '住所を自動で入力しました。番地・建物名を続けてご入力ください。';
    };
    sc.src = 'https://zipcloud.ibsnet.co.jp/api/search?zipcode=' + code + '&callback=' + cb;
    sc.onerror = function(){ clearTimeout(timer); done(); };
    document.head.appendChild(sc);
  }
  if(zip && addr){
    zip.addEventListener('input', function(){
      var d = zip.value.replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^\d]/g, '');
      if(d.length === 7 && d !== lastZip){ lastZip = d; lookupZip(d); }
    });
  }

  /* ---------------- validation ---------------- */
  var messages = {
    'f-name':'お名前を入力してください。',
    'f-tel':'ご連絡のつく電話番号を入力してください。',
    'f-mail':'メールアドレスの形式で入力してください。',
    'f-addr':'ご住所を番地・建物名まで入力してください。',
    'f-zip':'郵便番号を7桁で入力してください。',
    'f-agree':'内容をご確認のうえ、チェックを入れてください。',
    brand:'ブランドを入力してください。わからない場合は「不明」とご記入ください。'
  };
  function wrapOf(el){ return el.closest('[data-field]'); }
  function showError(el, msg){
    var box = wrapOf(el); if(!box) return;
    box.setAttribute('data-invalid', 'true');
    var p = box.querySelector('[data-err]');
    if(p){ p.textContent = msg; p.hidden = false; }
    el.setAttribute('aria-invalid', 'true');
  }
  function clearError(el){
    var box = wrapOf(el); if(!box) return;
    box.removeAttribute('data-invalid');
    var p = box.querySelector('[data-err]');
    if(p){ p.hidden = true; p.textContent = ''; }
    el.removeAttribute('aria-invalid');
  }
  function validateField(el){
    if(el.type === 'checkbox'){
      if(!el.checked){ showError(el, messages[el.id]); return false; }
      clearError(el); return true;
    }
    if(el.type === 'radio'){
      var ok = Array.prototype.some.call(form.querySelectorAll('input[name="' + el.name + '"]'), function(r){ return r.checked; });
      if(!ok){ showError(el, '買取方法を選んでください。'); return false; }
      clearError(el); return true;
    }
    var v = (el.value || '').trim();
    if(!v){ showError(el, messages[el.id] || messages[el.getAttribute('data-k')] || '入力してください。'); return false; }
    if(el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ showError(el, messages['f-mail']); return false; }
    if(el.id === 'f-zip' && v.replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^\d]/g, '').length !== 7){ showError(el, messages['f-zip']); return false; }
    if(el.type === 'tel' && v.replace(/[^\d]/g, '').length < 10){ showError(el, '電話番号は市外局番から入力してください。'); return false; }
    clearError(el); return true;
  }

  form.addEventListener('input', function(e){
    var el = e.target;
    var box = wrapOf(el);
    if(el.hasAttribute('required') && box && box.getAttribute('data-invalid') === 'true') validateField(el);
  });
  form.addEventListener('change', function(e){
    var el = e.target;
    if((el.type === 'radio' || el.type === 'checkbox') && el.hasAttribute('required') || el.name === 'method'){
      var box = wrapOf(el);
      if(box && box.getAttribute('data-invalid') === 'true') validateField(el);
    }
  });

  function setStatus(kind, html){
    status.className = 'formstatus' + (kind ? ' is-' + kind : '');
    status.innerHTML = html;
    status.hidden = false;
  }

  /* ---------------- submit ---------------- */
  function blobToBase64(blob){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function collect(){
    var fd = function(n){ var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };
    var radio = function(n){ var el = form.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ''; };
    var payload = {
      method:radio('method'),
      name:fd('name'), tel:fd('tel'), email:fd('email'), zip:'', address:'', kit:'', visit:'',
      coupon:couponSel.value, couponLabel:couponSel.value ? couponSel.options[couponSel.selectedIndex].text : '',
      note:fd('note'), page:location.href, items:[]
    };
    if(payload.method === '宅配買取'){ payload.zip = fd('zip'); payload.address = fd('address'); payload.kit = radio('kit'); }
    if(payload.method === '店頭買取'){ payload.visit = fd('visit'); }
    var jobs = [];
    items().forEach(function(block, i){
      var get = function(k){ return String(block.querySelector('[data-k="' + k + '"]').value || '').trim(); };
      var it = {no:i + 1, brand:get('brand'), name:get('name'), size:get('size'), condition:get('condition'), memo:get('memo'), photos:[]};
      payload.items.push(it);
      block._photos.forEach(function(p, j){
        if(!p.blob) return;
        jobs.push(blobToBase64(p.blob).then(function(b64){
          it.photos.push({name:'item' + (i + 1) + '-' + (j + 1) + '.jpg', type:'image/jpeg', data:b64});
        }));
      });
    });
    return Promise.all(jobs).then(function(){ return payload; });
  }

  function lock(on){
    sending = on;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-sending', on);
    submitBtn.setAttribute('aria-busy', String(on));
    submitBtn.textContent = on ? '送信中…' : 'この内容で申し込む';
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(sending) return;

    var first = null, seen = {};
    form.querySelectorAll('[required]').forEach(function(el){
      if(el.disabled) return;
      if(el.type === 'radio'){ if(seen[el.name]) return; seen[el.name] = true; }
      if(!validateField(el) && !first) first = el;
    });
    items().forEach(function(b){ b.toggleAttribute('data-invalid', !!b.querySelector('[aria-invalid="true"]')); });
    if(!items().length){ itemsErr.textContent = 'アイテムを1点以上追加してください。'; itemsErr.hidden = false; first = first || addBtn; }

    if(first){
      setStatus('error', '入力内容をご確認ください。赤く表示されている項目が未入力です。');
      var target = wrapOf(first) || first;
      target.scrollIntoView({block:'center', behavior:'smooth'});
      first.focus({preventScroll:true});
      return;
    }
    if(items().some(function(b){ return b._photos.some(function(p){ return p.busy; }); })){
      setStatus('error', '写真を処理しています。数秒待ってから、もう一度お試しください。');
      return;
    }

    /* スパム対策（人には見えない欄に入力があれば送らない） */
    if(form.elements.website && form.elements.website.value){
      setStatus('ok', 'お申し込みを受け付けました。');
      return;
    }

    lock(true);
    status.hidden = true;
    collect().then(function(payload){
      if(!ENDPOINT){
        var n = payload.items.reduce(function(s, it){ return s + it.photos.length; }, 0);
        setStatus('', '入力内容の確認が完了しました（アイテム ' + payload.items.length + '点・写真 ' + n + '枚）。<br>現在、送信先が未設定のため、実際の送信は行われていません。お急ぎの場合はLINE査定をご利用ください。');
        lock(false);
        status.focus();
        return;
      }
      var body = JSON.stringify(payload);
      if(body.length > 45 * 1024 * 1024){
        throw new Error('too_large');
      }
      return fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:body, redirect:'follow'})
        .then(function(r){ return r.json(); })
        .then(function(res){
          if(!res || !res.ok) throw new Error((res && res.error) || 'server');
          form.reset();
          applyMethod();
          items().forEach(function(b){ (b._photos || []).forEach(function(p){ if(p.url) URL.revokeObjectURL(p.url); }); b.remove(); });
          addItem(false);
          lock(false);
          status.hidden = true;
          showDone(res.id || '');
        });
    }).catch(function(err){
      lock(false);
      var big = err && err.message === 'too_large';
      setStatus('error', (big ? '写真の容量が大きすぎるため送信できませんでした。写真の枚数を減らしてお試しください。' :
        '送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。') +
        '<br>うまくいかない場合は、LINE査定またはお電話でご連絡ください。');
      status.focus();
    });
  });

  /* ---------------- 送信完了 ---------------- */
  function showDone(id){
    if(!done){
      setStatus('ok', '<strong>送信が完了しました。</strong><br>受付番号：' + AUG.esc(id) + '<br>内容を確認のうえ、担当より折り返しご連絡いたします。');
      status.focus();
      return;
    }
    document.getElementById('formDoneId').textContent = id;
    form.hidden = true;
    done.hidden = false;
    var top = document.getElementById('form') || done;
    top.scrollIntoView({block:'start', behavior:'smooth'});
    done.focus({preventScroll:true});
  }
  var again = document.getElementById('formAgain');
  if(again) again.addEventListener('click', function(){
    done.hidden = true;
    form.hidden = false;
    form.scrollIntoView({block:'start', behavior:'smooth'});
    var first = form.querySelector('input[name="method"]');
    if(first) first.focus({preventScroll:true});
  });

  applyMethod();
  addItem(false);
})();
