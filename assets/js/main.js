import { nf, registerStrings, applyStatic } from './i18n.js';
import { STATIC_EN } from './strings.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('js');
registerStrings(STATIC_EN);
applyStatic();

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------------- smooth scroll ---------------- */
const lenis = reduced ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2 || !$(id)) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(id, { duration: 1.8 }) : $(id).scrollIntoView({ behavior: 'smooth' });
}));

/* ---------------- particle field ---------------- */
let field = null;

function webglOK() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

async function setupField() {
  if (!webglOK()) { document.documentElement.classList.add('no-webgl'); return; }
  await document.fonts.ready; // the detection labels are drawn with the page's font
  const { Field } = await import('./field.js');
  const small = innerWidth < 860 || (navigator.hardwareConcurrency || 8) <= 4;
  field = new Field($('#field'), { count: small ? 9000 : 22000, reduced });
  if (location.search.includes('debug')) window.__field = field;
  if (!reduced) gsap.fromTo('#field', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.out' });
  let vel = 0;
  lenis?.on('scroll', (l) => { vel = l.velocity; });
  gsap.ticker.add((time) => { if (!document.hidden) field.update(time, vel); });
  field.story(storyP);
  $$('.scene[data-shape]').forEach((sec) => ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => self.isActive && field.morphTo(sec.dataset.shape, Number(sec.dataset.side)),
  }));
}

/* ---------------- the scenario (#fonctionnement) ---------------- */
// The section is three screens tall and its stage sticks: scrolling walks the
// adult and the child through the garden (js/field.js) and lights the steps.
let storyP = 0;
function story() {
  const sec = $('#fonctionnement');
  const steps = $$('.story-step', sec), states = $$('.story-state', sec), rail = $('.story-rail span', sec);
  let last = -1;
  const set = (p) => {
    storyP = p;
    const step = p < 0.33 ? 0 : p < 0.66 ? 1 : 2, alarm = p > 0.8;
    field?.story(p);
    rail.style.transform = `scaleX(${p})`;
    sec.classList.toggle('alarm', alarm);
    if (step === last) return;
    last = step;
    steps.forEach((el, i) => el.classList.toggle('on', i === step));
    states.forEach((el, i) => el.classList.toggle('on', i === step));
    sec.dataset.step = step;
  };
  set(0);
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => set(s.progress) });
}

/* ---------------- videos: play while on screen ---------------- */
function videos() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting && !reduced) v.play().catch(() => {});
    else v.pause();
  }), { threshold: 0.5 });
  $$('.clip video').forEach((v) => io.observe(v));
}

/* ---------------- hero intro ---------------- */
function heroIntro() {
  document.body.classList.remove('is-loading');
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.fromTo('.topnav', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1.2 }, 0.2)
    .fromTo('.ht-word', { yPercent: 115, letterSpacing: '0.12em' }, { yPercent: 0, letterSpacing: '-0.045em', duration: 1.6, stagger: 0.14 }, 0.1)
    .fromTo(['.hero .eyebrow', '.service-lines li', '.hero-sub', '.hero .hero-cta', '.scroll-cue'], { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.6)
    .add(() => gsap.set(['.ht-word', '.hero .eyebrow', '.service-lines li', '.hero-sub', '.hero .hero-cta', '.scroll-cue', '.topnav'], { clearProps: 'transform' }));
  // Safety net: Android Chrome has been seen freezing intros.
  setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, 4000);
}

/* ---------------- reveals ---------------- */
function reveals() {
  if (reduced) return;
  $$('.reveal').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', clearProps: 'transform',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
    const kids = $$('.kicker, .title, .lede, .service, .kpis > div, .chips li, .focus-item, .story-status, .partners li, .press, .source, .product-shot', el);
    if (kids.length) {
      gsap.fromTo(kids, { opacity: 0, y: 18, clipPath: 'inset(0 0 100% 0)' }, {
        opacity: 1, y: 0, clipPath: 'inset(0 0 -20% 0)', duration: 1, ease: 'power3.out', stagger: 0.06,
        clearProps: 'clipPath,transform',
        scrollTrigger: { trigger: el, start: 'top 80%', once: true },
      });
    }
  });
}

function counters() {
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    el.textContent = nf(end);
    if (reduced || !end) return;
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: () => { el.textContent = nf(o.v); } }),
    });
  });
}

/* ---------------- nav + progress ---------------- */
function chrome() {
  const nav = $('.topnav'), bar = $('.scroll-progress span');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      nav.classList.toggle('scrolled', self.scroll() > 40);
      bar.style.transform = `scaleX(${self.progress})`;
    },
  });
  $$('.nav-links a[href^="#"]').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('on', s.isActive) });
  });
}

/* ---------------- pointer effects ---------------- */
function pointerFx() {
  if (!fine || reduced) return;
  $$('.card, .tile').forEach((el) => el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
  $$('.tile').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotateY: x * 7, rotateX: -y * 7, transformPerspective: 900, duration: 0.6, ease: 'power2.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }));
  });
  $$('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.25);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------------- boot ---------------- */
counters();
chrome();
pointerFx();
reveals();
story();
videos();
heroIntro();
setupField();

let y = null;
try { y = sessionStorage.getItem('scrollY'); sessionStorage.removeItem('scrollY'); } catch (e) { /* private mode */ }
if (y) requestAnimationFrame(() => (lenis ? lenis.scrollTo(Number(y), { immediate: true }) : scrollTo(0, Number(y))));
