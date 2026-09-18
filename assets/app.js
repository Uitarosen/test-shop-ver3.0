/* =========================================================
   AUGUST SHOP – Renewal Mock / interactions
   ========================================================= */
(function () {
  'use strict';

  /* ---------- loader ---------- */
  var loader = document.getElementById('loader');
  function hideLoader() {
    if (loader) { loader.classList.add('is-hidden'); }
  }
  window.addEventListener('load', function () { setTimeout(hideLoader, 450); });
  // Fallback in case some asset never resolves.
  setTimeout(hideLoader, 2600);

  /* ---------- header scroll state + SP bar ---------- */
  var header = document.getElementById('header');
  var spBar = document.getElementById('spBar');
  var lastY = 0;

  function onScroll() {
    var y = window.pageYOffset;
    if (header) { header.classList.toggle('is-scrolled', y > 80); }
    if (spBar) { spBar.classList.toggle('is-visible', y > 420); }
    lastY = y;
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* ---------- drawer ---------- */
  var drawer = document.getElementById('drawer');
  var burger = document.getElementById('burger');
  var drawerClose = document.getElementById('drawerClose');

  var lastFocused = null;

  function openDrawer() {
    if (!drawer) { return; }
    lastFocused = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (burger) { burger.setAttribute('aria-expanded', 'true'); }
    document.body.style.overflow = 'hidden';
    if (drawerClose) { drawerClose.focus(); }
  }
  function closeDrawer() {
    if (!drawer || !drawer.classList.contains('is-open')) { return; }
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (burger) { burger.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
    lastFocused = null;
  }
  if (drawer) { drawer.setAttribute('aria-hidden', 'true'); }
  if (burger) {
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'drawer');
    burger.addEventListener('click', openDrawer);
  }
  if (drawerClose) { drawerClose.addEventListener('click', closeDrawer); }
  if (drawer) {
    drawer.querySelector('.drawer__bg').addEventListener('click', closeDrawer);
    Array.prototype.forEach.call(drawer.querySelectorAll('a'), function (a) {
      a.addEventListener('click', closeDrawer);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab' || !drawer || !drawer.classList.contains('is-open')) { return; }
    var items = drawer.querySelectorAll('a[href], button');
    if (!items.length) { return; }
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  /* ---------- scroll reveal ---------- */
  var targets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
  }

  /* Stagger children inside grids for a softer entrance. */
  ['.catGrid', '.priceGrid', '.featGrid', '.storeGrid'].forEach(function (sel) {
    var grid = document.querySelector(sel);
    if (!grid) { return; }
    Array.prototype.forEach.call(grid.children, function (child, i) {
      child.style.transitionDelay = Math.min(i, 8) * 70 + 'ms';
    });
  });

  /* ---------- campaign: drag to scroll ---------- */
  var scroller = document.getElementById('campaignScroller');
  if (scroller) {
    var isDown = false, startX = 0, startScroll = 0, moved = false;
    scroller.addEventListener('pointerdown', function (e) {
      isDown = true; moved = false;
      startX = e.clientX;
      startScroll = scroller.scrollLeft;
      scroller.setPointerCapture(e.pointerId);
    });
    scroller.addEventListener('pointermove', function (e) {
      if (!isDown) { return; }
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) { moved = true; }
      scroller.scrollLeft = startScroll - dx;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      scroller.addEventListener(ev, function () { isDown = false; });
    });
    scroller.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); }
    }, true);
  }

  /* ---------- smooth anchor offset for the fixed header ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) { return; }
    var id = a.getAttribute('href');
    if (!id || id === '#' || id.length < 2) { return; }
    var target = document.querySelector(id);
    if (!target) { return; }
    e.preventDefault();
    var offset = window.innerWidth > 680 ? 88 : 66;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  });
})();
