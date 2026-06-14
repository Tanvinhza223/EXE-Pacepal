/* ============================================================
   PacePal — interactions
   Lenis smooth scroll · GSAP/ScrollTrigger · cursor · demos
   ============================================================ */
(function () {
  'use strict';
  const html = document.documentElement;
  html.classList.add('js');
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- text splitting (em-safe) -------------------------------- */
  function textNodes(el) {
    const out = [];
    (function walk(n) {
      n.childNodes.forEach((c) => {
        if (c.nodeType === 3 && c.textContent.trim() !== '') out.push(c);
        else if (c.nodeType === 1) walk(c);
      });
    })(el);
    return out;
  }
  function splitChars(el) {
    textNodes(el).forEach((node) => {
      const frag = document.createDocumentFragment();
      [...node.textContent].forEach((ch) => {
        const s = document.createElement('span');
        s.className = 'char';
        s.textContent = ch === ' ' ? ' ' : ch;
        frag.appendChild(s);
      });
      node.replaceWith(frag);
    });
    return $$('.char', el);
  }
  function splitWords(el) {
    textNodes(el).forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((tok) => {
        if (tok === '') return;
        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
        const outer = document.createElement('span'); outer.className = 'word';
        const inner = document.createElement('span'); inner.className = 'word__i';
        inner.textContent = tok;
        outer.appendChild(inner); frag.appendChild(outer);
      });
      node.replaceWith(frag);
    });
    return $$('.word__i', el);
  }

  // pre-split once; stagger via per-span transition-delay. Initial hidden state for
  // chars/words is PURE CSS, revealed by toggling .is-in on the container.
  // (GSAP yPercent tweens on these split spans proved unreliable — CSS can't get stuck.)
  $$('[data-split]').forEach((el) => { el._chars = splitChars(el); el._chars.forEach((c, i) => { c.style.transitionDelay = Math.min(i * 0.022, 0.55) + 's'; }); });
  $$('[data-words]').forEach((el) => { el._words = splitWords(el); el._words.forEach((w, i) => { w.style.transitionDelay = Math.min(i * 0.04, 0.6) + 's'; }); });

  /* ============================================================
     PRELOADER
     ============================================================ */
  function runPreloader(done) {
    const pre = $('[data-preloader]');
    const countEl = $('[data-count]');
    let finished = false;
    const finish = () => { if (finished) return; finished = true; if (pre && pre.parentNode) pre.remove(); done(); };
    if (!pre) { done(); return; }
    if (REDUCE) {
      if (countEl) countEl.textContent = '100';
      gsap.to(pre, { autoAlpha: 0, duration: .3, onComplete: finish });
      return;
    }
    const obj = { v: 0 };
    gsap.to(obj, {
      v: 100, duration: 1.7, ease: 'power2.inOut',
      onUpdate: () => { if (countEl) countEl.textContent = Math.round(obj.v); },
      onComplete: () => {
        gsap.to(pre, { yPercent: -100, duration: 1, ease: 'expo.inOut', delay: .15, onComplete: finish });
      },
    });
    // Hard fallback: if the rAF ticker is throttled (e.g. background/hidden tab)
    // or gsap stalls for any reason, never trap the user behind the overlay.
    setTimeout(finish, 4000);
  }

  /* ============================================================
     LENIS SMOOTH SCROLL
     ============================================================ */
  let lenis = null;
  function initLenis() {
    if (REDUCE || typeof Lenis === 'undefined') return;
    lenis = new Lenis({ duration: 1.2, lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 });
    else target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
  }

  /* ============================================================
     HERO INTRO (after preloader)
     ============================================================ */
  function heroIntro() {
    const hero = $('[data-hero]');
    if (!hero) return;
    const reveals = hero.querySelectorAll('[data-reveal]');
    const lines = hero.querySelectorAll('[data-split]');
    if (REDUCE) { gsap.set(reveals, { opacity: 1 }); lines.forEach((l) => l.classList.add('is-in')); return; }
    lines.forEach((line, i) => setTimeout(() => line.classList.add('is-in'), 150 + i * 220));
    gsap.set(reveals, { opacity: 0, y: 26 });
    gsap.to(reveals, { opacity: 1, y: 0, duration: 1, stagger: 0.12, delay: 0.5, ease: 'power3.out' });
  }

  /* ============================================================
     GENERIC SCROLL REVEALS
     ============================================================ */
  // IntersectionObserver-based reveals — independent of ScrollTrigger/pinning,
  // so content after the (formerly pinned) hero always reveals as you scroll.
  function initReveals() {
    const hero = $('[data-hero]');
    const inHero = (el) => hero && hero.contains(el);
    const type = new Map();
    $$('[data-words]').forEach((el) => type.set(el, 'words'));
    $$('[data-split]').forEach((el) => { if (!inHero(el)) type.set(el, 'chars'); });
    $$('[data-reveal]').forEach((el) => { if (!inHero(el)) type.set(el, 'reveal'); });

    const doReveal = (el) => {
      const t = type.get(el);
      if (t === 'reveal') gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' });
      else el.classList.add('is-in');   // CSS rises the chars/words — can never stay stuck hidden
    };

    if (REDUCE) {
      type.forEach((t, el) => { if (t === 'reveal') gsap.set(el, { opacity: 1 }); else el.classList.add('is-in'); });
      return;
    }

    // initial hidden state for plain (opacity) reveals
    type.forEach((t, el) => { if (t === 'reveal') gsap.set(el, { opacity: 0, y: 28 }); });

    const els = [...type.keys()];
    const done = new WeakSet();
    const reveal = (el) => { if (done.has(el)) return; done.add(el); doReveal(el); };

    // primary path: IntersectionObserver
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
      }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
      els.forEach((el) => io.observe(el));
    }

    // bulletproof fallback: also reveal on real scroll position — covers any
    // case where IO notifications are throttled/missed. Native 'scroll' fires
    // with Lenis (it drives real scroll), so this always runs.
    const check = () => {
      const h = window.innerHeight;
      let pending = false;
      els.forEach((el) => {
        if (done.has(el)) return;
        const r = el.getBoundingClientRect();
        if (r.top < h * 0.92 && r.bottom > 0) reveal(el);
        else pending = true;
      });
      if (!pending) window.removeEventListener('scroll', check);
    };
    window.addEventListener('scroll', check, { passive: true });
    check();
    setTimeout(check, 800);
    setTimeout(check, 2200);
  }

  /* ============================================================
     HERO INTERACTIVE TREE
     Starts small. Grows on scroll AND on watering. Drag to rotate,
     tap to shake, water for gentle rain, switch species.
     ============================================================ */
  function initTree() {
    const stageEl = $('[data-tree-stage]');
    if (!stageEl) return;
    const layers = $$('.tree-layer');
    const rtTime = $('[data-rt-time]'), rtLabel = $('[data-rt-label]');
    const dots = $$('[data-tree-progress] i');
    const island = $('[data-tree-click]');
    const treeWrap = $('.tree-wrap');
    const nurture = $('[data-nurture]');
    const sparkBox = $('[data-tree-spark]');
    const rainBox = $('[data-rain]');
    const speciesBox = $('[data-species]');

    const SPECIES = [
      { id: 'co_thu', name: 'Cổ Thụ', times: [30, 60, 120, 180], labels: ['Mầm non', 'Cây non', 'Tán xanh', 'Cổ thụ'] },
      { id: 'huong_duong', name: 'Hướng Dương', times: [30, 60, 120, 180], labels: ['Hạt nảy', 'Thân non', 'Nụ vàng', 'Hướng dương'] },
      { id: 'sen_ngoc', name: 'Sen Ngọc', times: [30, 60, 120, 180], labels: ['Mầm sen', 'Lá nổi', 'Nụ sen', 'Sen ngọc'] },
      { id: 'nam_tien', name: 'Nấm Tiên', times: [30, 60, 120, 180], labels: ['Bào tử', 'Chân nấm', 'Mũ non', 'Nấm tiên'] },
      { id: 'hong_pha_le', name: 'Hồng Pha Lê', times: [30, 60, 120, 180], labels: ['Mầm pha lê', 'Thân non', 'Nụ hồng', 'Hồng pha lê'] },
      { id: 'tinh_van', name: 'Tinh Vân', times: [30, 60, 120, 180], labels: ['Tinh tú', 'Dải sáng', 'Lõi sáng', 'Tinh vân'] },
    ];
    let sp = 0, stage = -1, curF = 0, fScroll = 0, waterFloor = 0, growTween = null;

    // continuous growth: f∈[0..3] crossfades layers; readout updates at integer stages
    function paint(f) {
      curF = gsap.utils.clamp(0, 3, f);
      layers.forEach((img, i) => {
        const o = gsap.utils.clamp(0, 1, 1 - Math.abs(curF - i));
        img.style.opacity = o;
        img.style.transform = `scale(${0.84 + 0.16 * o})`;
      });
      const idx = Math.round(curF);
      if (idx !== stage) {
        stage = idx;
        const s = SPECIES[sp];
        rtTime.textContent = s.times[idx];
        rtLabel.textContent = s.labels[idx];
        dots.forEach((d, i) => d.classList.toggle('on', i <= idx));
        const grown = idx >= 3;
        stageEl.classList.toggle('is-grown', grown);
        island.classList.toggle('is-bloom', grown);
      }
    }
    // displayed growth = the higher of scroll-driven and watered levels
    function applyInstant() { if (growTween) { growTween.kill(); growTween = null; } paint(Math.max(fScroll, waterFloor)); }
    function applyGrow() {
      const target = Math.max(fScroll, waterFloor);
      if (growTween) growTween.kill();
      const proxy = { v: curF };
      growTween = gsap.to(proxy, { v: target, duration: 0.75, ease: 'power2.out', onUpdate: () => paint(proxy.v), onComplete: () => { growTween = null; } });
    }
    function applySpecies() {
      const s = SPECIES[sp];
      layers.forEach((img, i) => { img.src = `assets/${s.id}_stage${i + 1}.svg`; });
      stage = -1;                 // force readout refresh on next paint
      applyInstant();
    }
    function pop() { if (!REDUCE && treeWrap) gsap.fromTo(treeWrap, { scale: 0.95 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.5)' }); }
    function burst() {
      if (!sparkBox) return;
      for (let i = 0; i < 16; i++) {
        const s = document.createElement('span'); s.className = 'sp';
        const sz = 4 + Math.random() * 6; s.style.width = sz + 'px'; s.style.height = sz + 'px';
        if (Math.random() > 0.5) { s.style.background = 'var(--green)'; s.style.boxShadow = '0 0 8px var(--green)'; }
        s.style.left = (42 + Math.random() * 16) + '%'; s.style.top = (38 + Math.random() * 18) + '%';
        sparkBox.appendChild(s);
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 80;
        gsap.fromTo(s, { opacity: 1, x: 0, y: 0, scale: 0.5 },
          { opacity: 0, x: Math.cos(a) * d, y: Math.sin(a) * d - 26, scale: 1.2, duration: 1 + Math.random() * 0.6, ease: 'power2.out', onComplete: () => s.remove() });
      }
    }
    function shake() {
      if (REDUCE || !treeWrap) return;
      gsap.killTweensOf(treeWrap);
      gsap.fromTo(treeWrap, { rotation: 0 }, { rotation: 0, duration: 0.55, ease: 'sine.out', keyframes: { rotation: [-6, 5, -4, 2.5, -1, 0] } });
    }
    function rain() {
      if (rainBox && !REDUCE) {
        for (let i = 0; i < 22; i++) {
          const d = document.createElement('span'); d.className = 'drop';
          d.style.left = (22 + Math.random() * 56) + '%';
          rainBox.appendChild(d);
          gsap.fromTo(d, { y: -10, opacity: 0 },
            { y: 150 + Math.random() * 40, opacity: 1, duration: 0.6 + Math.random() * 0.35, ease: 'power1.in', delay: Math.random() * 0.6,
              onComplete: () => gsap.to(d, { opacity: 0, duration: 0.15, onComplete: () => d.remove() }) });
        }
      }
      // watering grows the tree one stage and keeps it (a floor scroll can't shrink below)
      waterFloor = Math.min(3, Math.round(curF) + 1);
      applyGrow();
      pop();
      if (!REDUCE) gsap.delayedCall(0.35, burst);
    }

    // species switcher
    if (speciesBox) {
      SPECIES.forEach((s, i) => {
        const b = document.createElement('button');
        b.className = 'sp-pick' + (i === 0 ? ' is-active' : '');
        b.type = 'button'; b.title = s.name;
        b.innerHTML = `<img src="assets/${s.id}_stage4.svg" alt="${s.name}" loading="lazy"/>`;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (i === sp) return;
          speciesBox.querySelectorAll('.sp-pick').forEach((x) => x.classList.remove('is-active'));
          b.classList.add('is-active');
          sp = i; applySpecies(); pop();
        });
        speciesBox.appendChild(b);
      });
    }

    gsap.set(layers, { opacity: 0 });
    applySpecies();
    applyInstant();                           // start small

    // water → gentle rain → grow one stage
    if (nurture) nurture.addEventListener('click', (e) => { e.stopPropagation(); rain(); });

    // drag to rotate (fine pointers) · tap to shake (all)
    let dragging = false, startX = 0, moved = 0;
    island.addEventListener('pointerdown', (e) => {
      dragging = true; startX = e.clientX; moved = 0;
      island.classList.add('is-grabbing');
      if (FINE) { try { island.setPointerCapture(e.pointerId); } catch (_) { } }
    });
    island.addEventListener('pointermove', (e) => {
      if (!dragging || !FINE) return;
      const dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
      gsap.set(treeWrap, { rotationY: gsap.utils.clamp(-65, 65, dx * 0.5), transformPerspective: 900 });
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false; island.classList.remove('is-grabbing');
      if (moved < 6) shake();
      else if (FINE && !REDUCE) gsap.to(treeWrap, { rotationY: 0, duration: 1.1, ease: 'elastic.out(1,0.4)' });
    };
    island.addEventListener('pointerup', endDrag);
    island.addEventListener('pointercancel', endDrag);
    island.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shake(); } });

    // GROWTH driven by scroll — fully reversible (scroll up ⇒ smaller).
    // Desktop/tablet: PIN the hero (hold the screen) and scrub the growth.
    // Phone: non-pinned scroll-scrub so the tree still grows/shrinks naturally.
    const hero = $('[data-hero]');
    const mm = gsap.matchMedia();
    mm.add('(min-width: 961px)', () => {            // desktop: tree sits beside the text → safe to pin
      const st = ScrollTrigger.create({
        trigger: hero, start: 'top top', end: '+=135%',
        pin: true, pinSpacing: true, scrub: 0.6, anticipatePin: 1,
        onUpdate: (self) => { fScroll = self.progress * 3; applyInstant(); },
      });
      fScroll = 0; applyInstant();
      return () => st.kill();
    });
    mm.add('(max-width: 960px)', () => {            // tablet/phone: tree stacks below → scrub without pinning
      const onScroll = () => {
        const r = stageEl.getBoundingClientRect();
        const h = window.innerHeight || 1;
        const p = gsap.utils.clamp(0, 1, (-r.top + h * 0.12) / (h * 0.8));
        fScroll = p * 3; applyInstant();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener('scroll', onScroll);
    });
  }

  /* ============================================================
     REVEAL GARDEN — cursor spotlight reveals the lush garden
     over the barren one (soft circular CSS mask, lerped).
     ============================================================ */
  function initRevealGarden() {
    const root = $('[data-reveal-garden]');
    if (!root) return;
    const lush = $('[data-reveal-lush]', root);
    // touch / reduced-motion: just reveal the whole lush garden
    if (!FINE || REDUCE) { root.classList.add('is-full', 'is-active'); return; }

    let tx = 0, ty = 0, cx = 0, cy = 0, running = false, raf = 0;
    const setVars = () => { lush.style.setProperty('--mx', cx + 'px'); lush.style.setProperty('--my', cy + 'px'); };
    const center = () => { const b = root.getBoundingClientRect(); cx = tx = b.width / 2; cy = ty = b.height * 0.5; setVars(); };
    const loop = () => { cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16; setVars(); raf = requestAnimationFrame(loop); };
    const start = () => { if (!running) { running = true; loop(); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    center();
    root.addEventListener('pointerenter', start);
    root.addEventListener('pointermove', (e) => {
      const b = root.getBoundingClientRect();
      tx = e.clientX - b.left; ty = e.clientY - b.top;
      root.classList.add('is-active');
      start();
    });
    root.addEventListener('pointerleave', stop);
    window.addEventListener('resize', center);
  }

  /* ============================================================
     CINEMATIC FILM — scrub the intro video with scroll
     ============================================================ */
  function initFilm() {
    const section = $('[data-film]');
    if (!section) return;
    const video = $('[data-film-video]', section);
    const lines = $$('[data-film-line]', section);
    const cue = $('[data-film-cue]', section);
    let duration = 0;
    const setDur = () => { duration = video.duration || 0; };
    if (video.readyState >= 1) setDur();
    video.addEventListener('loadedmetadata', setDur);
    // defer full buffering until after first paint (keeps initial load light)
    window.addEventListener('load', () => { try { video.preload = 'auto'; } catch (e) { } });

    // iOS/Safari: a muted play→pause unlocks frame-accurate seeking
    const unlock = () => { const p = video.play(); if (p && p.then) p.then(() => video.pause()).catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });

    if (REDUCE) {
      video.loop = true;
      const p = video.play(); if (p && p.catch) p.catch(() => {});
      if (lines[0]) lines[0].classList.add('is-on');
      return;
    }

    const ranges = [[0.05, 0.40], [0.40, 0.72], [0.72, 0.97]];
    const updateLines = (p) => {
      lines.forEach((l, i) => l.classList.toggle('is-on', p >= ranges[i][0] && p < ranges[i][1]));
      if (cue) cue.classList.toggle('is-hidden', p > 0.04);
    };

    let targetT = 0, seeking = false;
    video.addEventListener('seeked', () => { seeking = false; });
    ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.4,
      onUpdate: (self) => { targetT = self.progress * (duration || 10); updateLines(self.progress); },
    });
    // apply the target time without piling up seeks
    (function loop() {
      if (duration && video.readyState >= 2 && !seeking && Math.abs(video.currentTime - targetT) > 0.033) {
        seeking = true; try { video.currentTime = targetT; } catch (e) { seeking = false; }
      }
      requestAnimationFrame(loop);
    })();
    updateLines(0);
  }

  /* ============================================================
     PROBLEM — horizontal pin (desktop)
     ============================================================ */
  function initProblem() {
    const track = $('[data-track]');
    const section = $('[data-problem]');
    if (!track || !section) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 761px)', () => {
      const getScroll = () => track.scrollWidth - window.innerWidth + 80;
      const tween = gsap.to(track, {
        x: () => -getScroll(), ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top',
          end: () => '+=' + getScroll(),
          pin: true, scrub: 1, invalidateOnRefresh: true,
        },
      });
      return () => tween.scrollTrigger.kill();
    });
  }

  /* ============================================================
     COUNTERS
     ============================================================ */
  function initCounters() {
    $$('[data-counter]').forEach((el) => {
      const target = +el.dataset.counter;
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => {
          if (REDUCE) { el.textContent = target; return; }
          const o = { v: 0 };
          gsap.to(o, { v: target, duration: 1.4, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
        },
      });
    });
  }

  /* ============================================================
     WITHER SLIDER
     ============================================================ */
  function initWither() {
    const range = $('[data-wither-range]');
    if (!range) return;
    const fill = $('[data-wither-fill]');
    const knob = $('[data-wither-knob]');
    const alive = $('[data-wither-alive]');
    const dead = $('[data-wither-dead]');
    const state = $('[data-wither-state]');
    const track = $('[data-witherer]');
    const update = () => {
      const v = +range.value / 100;
      fill.style.width = (v * 100) + '%';
      const tw = track.clientWidth - 40;
      knob.style.left = (6 + v * tw) + 'px';
      alive.style.opacity = String(1 - v * 0.92);
      alive.style.filter = `grayscale(${v * 0.75}) brightness(${1 - v * 0.25})`;
      dead.style.opacity = String(v);
      state.textContent = v > 0.82 ? 'Cây đã chết' : v > 0.4 ? 'Đang héo dần' : 'Khỏe mạnh';
    };
    range.addEventListener('input', update);
    update();
  }

  /* ============================================================
     POMODORO + TORNADO mini-game (giám sát tương tác)
     Set a session → study → 5-min break → catch the tornado in time
     or the tree is harmed and the studied minutes don't count.
     ============================================================ */
  function initSaveDemo() {
    const root = $('[data-save]');
    if (!root) return;
    const playBtn = $('[data-play-session]', root);
    const clock = $('[data-pomo-clock]', root);
    const bar = $('[data-pomo-bar]', root);
    const barFill = bar ? bar.querySelector('i') : null;
    const tornado = $('[data-tornado]', root);
    const ring = $('[data-tornado-ring]', root);
    const tree = $('[data-demo-tree]', root);
    const leavesBox = $('[data-leaves]', root);
    const result = $('[data-demo-result]', root);
    const status = $('[data-demo-status]', root);
    const pills = $$('.pomo-pill', root);
    const RING = 2 * Math.PI * 42;
    let minutes = 25, running = false, broke = false, timer = null;

    if (ring) ring.style.strokeDasharray = RING;
    const setStatus = (t) => { status.textContent = t; };
    const fmt = (m) => { const mm = Math.max(0, Math.floor(m)); const ss = Math.max(0, Math.round((m - mm) * 60)); return String(mm).padStart(2, '0') + ':' + String(ss === 60 ? 0 : ss).padStart(2, '0'); };

    pills.forEach((p) => p.addEventListener('click', () => {
      if (running) return;
      pills.forEach((x) => x.classList.remove('is-active'));
      p.classList.add('is-active');
      minutes = +p.dataset.min;
      clock.textContent = String(minutes).padStart(2, '0') + ':00';
      setStatus('Sẵn sàng · ' + minutes + '′');
    }));

    function spawnLeaves() {
      leavesBox.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const leaf = document.createElement('span');
        leaf.className = 'leaf';
        leaf.style.left = (25 + Math.random() * 50) + '%';
        leaf.style.top = (10 + Math.random() * 35) + '%';
        leaf.style.background = Math.random() > 0.5 ? '#56a23c' : '#7c9a3a';
        leavesBox.appendChild(leaf);
        gsap.fromTo(leaf, { opacity: 1, y: 0, x: 0, rotation: 0 },
          { opacity: 0, y: 120 + Math.random() * 60, x: (Math.random() - 0.5) * 80, rotation: (Math.random() - 0.5) * 360, duration: 1.8 + Math.random(), ease: 'power1.in', delay: i * 0.04 });
      }
    }
    function showResult(ok, text) { result.textContent = text; result.className = 'demo-result ' + (ok ? 'ok' : 'bad') + ' is-show'; }

    function endBreak(saved) {
      if (!broke) return;
      broke = false; running = false;
      gsap.killTweensOf(ring);
      clearTimeout(timer);
      tornado.classList.remove('is-active');
      if (saved) {
        gsap.fromTo(tree, { scale: 1 }, { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });
        showResult(true, '✓ Bấm kịp! Cây an toàn — phiên ' + minutes + '′ được ghi nhận.');
        setStatus('Hoàn thành');
      } else {
        tree.classList.add('is-hurt');
        spawnLeaves();
        showResult(false, '✕ Lốc xoáy cuốn mất — cây tổn hại, ' + minutes + '′ vừa học KHÔNG được tính.');
        setStatus('Bỏ lỡ');
      }
    }

    function startBreak() {
      broke = true;
      clock.textContent = '05:00';
      setStatus('Giờ nghỉ — bấm vào lốc xoáy!');
      tornado.classList.add('is-active');
      if (!REDUCE) gsap.fromTo(ring, { strokeDashoffset: 0 }, { strokeDashoffset: RING, duration: 5, ease: 'none' });
      timer = setTimeout(() => endBreak(false), 5000);   // 5 phút nghỉ ↔ 5s trong demo
    }

    function play() {
      if (running) return;
      running = true; broke = false;
      result.classList.remove('is-show');
      tree.classList.remove('is-hurt');
      leavesBox.innerHTML = '';
      tornado.classList.remove('is-active');
      setStatus('Đang học…');
      const dur = REDUCE ? 0.1 : 2.4;
      if (bar) bar.classList.add('show');
      if (barFill) gsap.fromTo(barFill, { width: '0%' }, { width: '100%', duration: dur, ease: 'none' });
      const o = { v: minutes };
      gsap.to(o, {
        v: 0, duration: dur, ease: 'none',
        onUpdate: () => { clock.textContent = fmt(o.v); },
        onComplete: () => { if (bar) bar.classList.remove('show'); startBreak(); },
      });
    }

    playBtn.addEventListener('click', play);
    tornado.addEventListener('click', (e) => { e.stopPropagation(); endBreak(true); });
  }

  /* ============================================================
     LEADERBOARD bars
     ============================================================ */
  function fillLadder(ladder) {
    if (!ladder) return;
    $$('.ladder__row', ladder).forEach((row, i) => {
      row.classList.remove('is-in');
      const valEl = $('.val', row);
      if (valEl && valEl.dataset.target === undefined) valEl.dataset.target = valEl.textContent.trim();
      gsap.delayedCall(0.07 * i + 0.05, () => {
        row.classList.add('is-in');
        if (!valEl) return;
        const target = +valEl.dataset.target || 0;
        if (REDUCE) { valEl.textContent = target; return; }
        const o = { v: 0 };
        gsap.to(o, { v: target, duration: 1.1, ease: 'power2.out', onUpdate: () => { valEl.textContent = Math.round(o.v); } });
      });
    });
  }
  function initBoard() {
    const active = $('.ladder.is-active') || $('[data-ladder="pair"]');
    if (!active) return;
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => { if (e.isIntersecting) { fillLadder(active); obs.disconnect(); } });
    }, { threshold: 0.2 });
    io.observe(active);
  }
  function initLeaderboardTabs() {
    const tabs = $('[data-board-tabs]');
    if (!tabs) return;
    const btns = $$('[data-board-tab]', tabs);
    const ladders = $$('[data-ladder]');
    btns.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        btns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        tabs.setAttribute('data-pos', i);
        const key = btn.dataset.boardTab;
        ladders.forEach((l) => {
          const on = l.dataset.ladder === key;
          l.hidden = !on;
          l.classList.toggle('is-active', on);
          if (on) fillLadder(l);
        });
      });
    });
  }

  /* ============================================================
     COLLECTION tier filter
     ============================================================ */
  function initTiers() {
    const pills = $$('.tier-pill');
    const plants = $$('.plant');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        const t = pill.dataset.tier;
        plants.forEach((pl) => {
          const match = t === 'all' || pl.dataset.tier === t;
          pl.classList.toggle('is-dim', !match);
        });
      });
    });
  }

  /* ============================================================
     MARQUEE
     ============================================================ */
  function initMarquee() {
    if (REDUCE) return;
    const row = $('.marquee__row');
    if (row) gsap.to(row, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
  }

  /* ============================================================
     NAV
     ============================================================ */
  function initNav() {
    const nav = $('[data-nav]');
    const burger = $('[data-burger]');
    const progress = $('[data-progress]');
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 40);
      if (!nav.classList.contains('is-open')) {
        nav.classList.toggle('is-hidden', y > last && y > 400);
      }
      last = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    burger && burger.addEventListener('click', () => nav.classList.toggle('is-open'));

    // in-page anchors
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const target = $(id);
        if (!target) return;
        e.preventDefault();
        nav.classList.remove('is-open');
        scrollTo(target);
      });
    });
  }

  /* ============================================================
     CUSTOM CURSOR + MAGNETIC + TILT
     ============================================================ */
  function initCursor() {
    if (!FINE || REDUCE) return;
    html.classList.add('has-cursor');
    const cur = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    const hov = $$('a, button, [data-magnetic], [data-tilt], input, .tier-pill');
    hov.forEach((el) => {
      el.addEventListener('pointerenter', () => cur.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cur.classList.remove('is-hover'));
    });
    window.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    window.addEventListener('pointerup', () => cur.classList.remove('is-down'));
  }

  function initMagnetic() {
    if (!FINE || REDUCE) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.3;
        const y = (e.clientY - r.top - r.height / 2) * 0.4;
        gsap.to(el, { x, y, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' }));
    });
  }

  function initTilt() {
    if (!FINE || REDUCE) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(el, { rotateY: px * 9, rotateX: -py * 9, transformPerspective: 900, transformOrigin: 'center', duration: 0.5, ease: 'power2.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3.out' }));
      // bento spotlight follow
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
    // spotlight for all bento cells (even without tilt move)
    $$('.bento__cell').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function initSite() {
    initLenis();
    heroIntro();
    initReveals();
    initTree();
    initFilm();
    initRevealGarden();
    initProblem();
    initCounters();
    initWither();
    initSaveDemo();
    initBoard();
    initLeaderboardTabs();
    initTiers();
    initMarquee();
    initNav();
    initCursor();
    initMagnetic();
    initTilt();

    requestAnimationFrame(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
    // refresh once webfonts settle
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  window.addEventListener('DOMContentLoaded', () => runPreloader(initSite));
})();
