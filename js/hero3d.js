// ============================================================
// PacePal — hero firefly / spore field (Three.js, custom shader)
// Warm motes drifting up through a twilight forest.
// ============================================================
import * as THREE from 'three';

const canvas = document.querySelector('[data-three]');
const hero = document.querySelector('[data-hero]');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canvas && hero) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // ---- particle field ----------------------------------------------------
  const isMobile = window.innerWidth < 760;
  const COUNT = isMobile ? 240 : 620;
  const SPREAD_X = 14, SPREAD_Y = 12, SPREAD_Z = 9;

  const palette = [
    [0.93, 0.73, 0.36], // amber (dominant)
    [0.93, 0.73, 0.36],
    [0.96, 0.82, 0.55], // pale gold
    [0.55, 0.80, 0.43], // growth green
    [0.78, 0.48, 1.00], // rare violet
  ];

  const offset = new Float32Array(COUNT * 3);
  const aScale = new Float32Array(COUNT);
  const aSpeed = new Float32Array(COUNT);
  const aPhase = new Float32Array(COUNT);
  const aColor = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    offset[i * 3]     = (Math.random() - 0.5) * SPREAD_X;
    offset[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y;
    offset[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z - 2.0;
    aScale[i] = Math.random() * 18 + 6;
    aSpeed[i] = Math.random() * 0.5 + 0.18;
    aPhase[i] = Math.random() * Math.PI * 2;
    const c = palette[(Math.random() * palette.length) | 0];
    aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(offset, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(aScale, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));

  const uniforms = {
    uTime:   { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uSpreadY: { value: SPREAD_Y },
    uScroll: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime, uPixelRatio, uSpreadY, uScroll;
      attribute float aScale, aSpeed, aPhase;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vFlick;
      void main(){
        vec3 p = position;
        // rise & wrap vertically
        float y = mod(p.y + uTime * aSpeed - uScroll * 3.0 + uSpreadY*0.5, uSpreadY) - uSpreadY*0.5;
        p.y = y;
        // gentle horizontal sway
        p.x += sin(uTime * 0.32 + aPhase) * 0.5;
        p.z += cos(uTime * 0.22 + aPhase) * 0.35;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * uPixelRatio * (1.0 / -mv.z) * 1.3;

        vColor = aColor;
        vFlick = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * aSpeed * 3.5 + aPhase));
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vFlick;
      void main(){
        float d = distance(gl_PointCoord, vec2(0.5));
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        float glow = pow(core, 2.4);
        float alpha = glow * vFlick;
        if(alpha < 0.01) discard;
        gl_FragColor = vec4(vColor * (0.6 + 0.8*glow), alpha);
      }
    `,
  });

  const points = new THREE.Points(geo, material);
  scene.add(points);

  // ---- interaction --------------------------------------------------------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5);
    mouse.ty = (e.clientY / window.innerHeight - 0.5);
  });

  let scrollN = 0;
  const onScroll = () => {
    const r = hero.getBoundingClientRect();
    scrollN = Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- resize -------------------------------------------------------------
  function resize() {
    const w = hero.clientWidth || window.innerWidth;
    const h = hero.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;            // skip bogus zero-size measurements
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduce) renderer.render(scene, camera);
  }
  resize();
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  window.addEventListener('load', resize);

  // ---- pause rendering when the hero scrolls off-screen (perf) -------------
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { rootMargin: '120px' }).observe(hero);
  }

  // ---- loop ---------------------------------------------------------------
  const clock = new THREE.Clock();
  function tick() {
    if (!visible) { requestAnimationFrame(tick); return; }   // skip GPU work off-screen
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uScroll.value += (scrollN - uniforms.uScroll.value) * 0.05;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    camera.position.x = mouse.x * 1.6;
    camera.position.y = -mouse.y * 1.0 - scrollN * 1.2;
    camera.lookAt(0, 0, 0);

    points.rotation.z = mouse.x * 0.05;
    renderer.render(scene, camera);
    if (!reduce) requestAnimationFrame(tick);
  }

  if (reduce) {
    // single static frame
    uniforms.uTime.value = 2.0;
    renderer.render(scene, camera);
  } else {
    tick();
  }
}
