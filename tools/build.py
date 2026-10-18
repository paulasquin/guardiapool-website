#!/usr/bin/env python3
"""Generate the static pages of guardiapool.com.

Page content lives in the Python structures below, in French and English —
they are the source of truth. The build writes:

- index.html, with the French text tagged data-i18n (French is the default
  language of the HTML, as on paulasquin.com and aidiligence.eu);
- assets/js/strings.js, the English of every tagged element, applied in the
  browser by assets/js/i18n.js when the visitor's language is English;
- mentions-legales/index.html, 404.html, and redirects from the former pages
  (videos/, a-propos/, contact/, conditions générales) to the matching anchors.

Internal links are relative, so the site works both at a domain root and under
a sub-path. Exception: 404.html uses absolute paths, since it is served from an
arbitrary URL.

Usage: python3 tools/build.py
"""

import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SITE = "Guardia"
URL = "https://guardiapool.com/"
EMAIL = "contact.guardiapool@gmail.com"
MAILTO = f"mailto:{EMAIL}"
PRESS = ("https://tribunedelyon.fr/sciences-innovation/"
         "lobjet-de-la-semaine-guardia-la-camera-de-piscine-anti-noyade/")

# Publisher of the site (mentions légales). Paul does not want the registered office,
# its city or his phone number on this site: the SIREN number identifies the company.
PUBLISHER = {
    "name": "Guardia",
    "form": "société par actions simplifiée (SAS) au capital de 1 000 €",
    "siren": "910 991 140",
    "ape": "6201Z",
    "vat": "FR81910991140",
    "director": "Paul Asquin, Président",
    "email": EMAIL,
}

# Language picked before first paint: ?lang=, then the visitor's saved choice,
# then the browser languages (same script as paulasquin.com).
LANG_SCRIPT = """<script>
    (function () {
      var ok = ['fr', 'en'], lang = null;
      try {
        var q = new URLSearchParams(location.search).get('lang');
        if (ok.indexOf(q) >= 0) { lang = q; localStorage.setItem('lang', q); }
        else if (ok.indexOf(localStorage.getItem('lang')) >= 0) lang = localStorage.getItem('lang');
      } catch (e) {}
      if (!lang) {
        var ls = navigator.languages || [navigator.language || ''];
        for (var i = 0; i < ls.length && !lang; i++) { var b = String(ls[i]).slice(0, 2).toLowerCase(); if (ok.indexOf(b) >= 0) lang = b; }
      }
      document.documentElement.lang = lang || 'en';
    })();
  </script>"""

FONTS = ('<link rel="preload" as="font" type="font/woff2" href="assets/fonts/unbounded-latin.woff2" crossorigin>\n'
         '  <link rel="preload" as="font" type="font/woff2" href="assets/fonts/inter-latin.woff2" crossorigin>')

# --------------------------------------------------------------------------- #
# The lighthouse of the logo, redrawn as a vector mark
# --------------------------------------------------------------------------- #

RAY_ANGLES = [200, 178, 155, 132, 110, 90, 70, 48, 25, 2, -20]  # degrees, as in the logo


def lighthouse_svg(cls="brand-mark", bg=False):
    """The Guardia lighthouse in a 64×64 box: rays, lantern, gallery, striped tower.

    The stripes are cut out of the tower (even-odd), so the mark works on any
    dark background; `bg` adds a rounded square for the favicon.
    """
    import math
    cx, cy = 32, 16.5
    rays = "".join(
        f'<line class="lh-ray" style="--i:{i}" x1="{cx + 12.2 * math.cos(math.radians(a)):.2f}" '
        f'y1="{cy - 12.2 * math.sin(math.radians(a)):.2f}" x2="{cx + 17.6 * math.cos(math.radians(a)):.2f}" '
        f'y2="{cy - 17.6 * math.sin(math.radians(a)):.2f}"/>'
        for i, a in enumerate(RAY_ANGLES))
    back = '<rect width="64" height="64" rx="14" fill="#070a1a"/>' if bg else ""
    return (f'<svg class="{cls}" viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">{back}'
            '<defs><linearGradient id="lh-g" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#6fd6ff"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs>'
            f'<g stroke="#6fd6ff" stroke-width="2.4" stroke-linecap="round">{rays}</g>'
            '<g fill="url(#lh-g)">'
            '<path d="M25.2 12.2L32 5.6l6.8 6.6z"/>'
            '<path fill-rule="evenodd" d="M27.4 12.2h9.2v7.2h-9.2zM30 13.8v4h4v-4z"/>'
            '<rect x="24.4" y="19.4" width="15.2" height="2.7" rx="1"/>'
            '<path fill-rule="evenodd" d="M27.6 22.1h8.8l4.6 37H23z'
            'M26.06 34.5L37.2 28.5l.74 6-12.63 6zM24.32 48.5L38.87 42l.75 6-16.05 6.5z"/>'
            '</g><rect class="lh-lamp" x="30" y="13.8" width="4" height="4" fill="#fff3d6"/></svg>')


def brand():
    return f'{lighthouse_svg()}<span class="brand-text">Guardia</span>'


# Line-art icons, drawn with primitives so they stay crisp at any size.
ICONS = {
    "perimeter": '<rect x="3.5" y="5.5" width="17" height="13" rx="4" stroke-dasharray="2.6 2.4"/><rect x="8.2" y="9.6" width="7.6" height="4.8" rx="1.2"/>',
    "bell": '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10.2 20.2a2 2 0 0 0 3.6 0"/>',
    "detect": ('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16'
               'M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="9" r="2"/><path d="M8.5 17c.4-2.3 1.8-3.6 3.5-3.6s3.1 1.3 3.5 3.6"/>'),
    "home": '<path d="M4 11l8-6.5 8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><rect x="9.5" y="12.8" width="5" height="4.4" rx=".8"/><path d="M10.6 12.8v-1.1a1.4 1.4 0 0 1 2.8 0v1.1"/>',
    "auto": '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4.5V8H16"/><path d="M9.2 12.2l1.9 1.9 3.7-3.8"/>',
    "mount": '<path d="M7 20V10"/><rect x="5.5" y="5.5" width="12" height="5" rx="1.4"/><circle cx="14.5" cy="8" r="1"/><path d="M4.5 20h5"/>',
}


def icon(name):
    return f'<svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


# --------------------------------------------------------------------------- #
# Translation
# --------------------------------------------------------------------------- #

EN = {}  # data-i18n key -> English, filled while the page is rendered


def tr(key, fr, en):
    """Register the English of `key` and return the French (both are HTML)."""
    EN[key] = en
    return fr


def t(tag, key, fr, en, attrs=""):
    return f'<{tag}{attrs} data-i18n="{key}">{tr(key, fr, en)}</{tag}>'


# --------------------------------------------------------------------------- #
# Content (French, English)
# --------------------------------------------------------------------------- #

META_TITLE = ("Guardia — Alarme de piscine périmétrique intelligente",
              "Guardia — Smart perimeter pool alarm")
META_DESC = ("Alarme de piscine périmétrique intelligente : une caméra autonome à IA embarquée "
             "qui prévient si un enfant s'approche seul du bassin. Aucune image ne sort de chez vous.",
             "Smart perimeter pool alarm: an autonomous camera with on-device AI that warns you when "
             "a child nears the pool alone. No image ever leaves your home.")

HERO_LINES = [
    ("Prévient si un enfant s'approche seul du bassin", "Warns you when a child nears the pool alone"),
    ("Reconnaît enfants, adultes et animaux", "Tells children, adults and animals apart"),
    ("Aucune image ne sort de chez vous", "No image ever leaves your home"),
]

# Santé publique France, drowning surveys — figures as on the former site.
KPIS = [
    ("75", " %", ("des victimes de noyade en piscine privée ont moins de 6 ans",
                  "of drowning victims in private pools are under 6")),
    ("×2", "", ("de noyades chez les moins de 6 ans entre 2015 et 2018",
                "drownings among under-6s between 2015 and 2018")),
    ("2", " min", ("suffisent à un enfant pour se noyer dans 20 cm d'eau",
                   "are enough for a child to drown in 20 cm of water")),
    ("68", " %", ("des noyades : un dispositif de sécurité était présent mais n'a pas rempli sa fonction",
                  "of drownings: a safety device was there but did not do its job")),
]

STEPS = [
    (("Surveiller", "Watch"),
     ("Fixée à un mur, un arbre ou un poteau, la caméra surveille une large zone autour de la "
      "piscine.",
      "Mounted on a wall, a tree or a post, the camera watches a wide area around the pool."),
     ("Zone surveillée", "Watched zone")),
    (("Reconnaître", "Recognise"),
     ("Un enfant accompagné d'un adulte : tout va bien, l'alarme reste silencieuse. Plus besoin de "
      "la désactiver avant la baignade.",
      "A child with an adult: all is well, the alarm stays silent. No need to switch it off before "
      "a swim."),
     ("Enfant accompagné · aucune alerte", "Child accompanied · no alert")),
    (("Alerter", "Alert"),
     ("L'adulte s'éloigne, l'enfant s'approche seul de l'eau : une puissante alarme retentit avant "
      "l'accident et vous laisse le temps d'intervenir.",
      "The adult walks away, the child heads for the water alone: a powerful alarm sounds before "
      "the accident and leaves you time to step in."),
     ("Enfant seul près de l'eau · alarme", "Child alone near the water · alarm")),
]

DETECTION = [  # what the alarm recognises, not how: Paul does not want the technology detailed
    (("Enfant ou adulte", "Child or adult"),
     ("L'alarme distingue un enfant d'un adulte, et sait si l'enfant est accompagné.",
      "The alarm tells a child from an adult, and knows whether the child is accompanied.")),
    (("Animaux", "Animals"),
     ("Les animaux sont reconnus comme tels : ils ne sont pas pris pour un enfant.",
      "Animals are recognised as such: they are not mistaken for a child.")),
    (("Objets", "Objects"),
     ("Le vent, un ballon ou une bouée qui dérive ne déclenchent pas l'alarme.",
      "Wind, a ball or a drifting pool float do not set the alarm off.")),
]

FEATURES = [
    ("perimeter", "#6fd6ff", ("Alarme périmétrique", "Perimeter alarm"),
     ("La caméra surveille une large zone autour de la piscine et détecte si votre enfant s'en "
      "approche sans être accompagné d'un adulte.",
      "The camera watches a wide area around the pool and detects when your child approaches it "
      "without an adult.")),
    ("bell", "#ff8a6b", ("Anticipation précieuse", "Precious anticipation"),
     ("Une puissante alarme prévient avant qu'un accident ne survienne et vous laisse un temps "
      "décisif pour intervenir.",
      "A powerful alarm warns you before an accident happens and gives you decisive time to step "
      "in.")),
    ("detect", "#4fe0c0", ("Détection intelligente", "Smart detection"),
     ("Notre intelligence artificielle embarquée reconnaît enfants, adultes et animaux, et évite "
      "les fausses alertes (vent, ballons, bouées…).",
      "Our on-device artificial intelligence recognises children, adults and animals, and avoids "
      "false alarms (wind, balls, pool floats…).")),
    ("home", "#a78bff", ("Respecte votre vie privée", "Respects your privacy"),
     ("Aucune donnée ne sort de chez vous. Le respect de votre vie privée est primordial.",
      "No data leaves your home. Respecting your privacy comes first.")),
    ("auto", "#6fd6ff", ("Fonctionnement autonome", "Runs on its own"),
     ("Développée avec nos utilisateurs, l'alarme est intelligente et autonome. Plus besoin de la "
      "désactiver avant la baignade.",
      "Developed with our users, the alarm is smart and autonomous. No need to switch it off before "
      "a swim.")),
    ("mount", "#ffb37a", ("Facile à installer", "Easy to install"),
     ("La caméra s'installe facilement (mur, arbre, poteau) et ne nécessite aucuns travaux autour "
      "de votre piscine.",
      "The camera is easy to install (wall, tree, post) and needs no building work around your "
      "pool.")),
]

BOX = [
    ("Caméra Guardia équipée d'une alarme sonore", "Guardia camera with a built-in siren"),
    ("Cordon de raccordement électrique", "Power cord"),
    ("Manuel d'utilisation", "User manual"),
]

VIDEOS = [
    ("Danger-detecte", "alarm", ("Danger détecté", "Danger detected"),
     ("Un enfant non accompagné est détecté : l'alarme se déclenche.",
      "An unaccompanied child is detected: the alarm goes off.")),
    ("Adulte-detecte", "safe", ("Enfant accompagné", "Child accompanied"),
     ("L'alarme détecte que l'enfant est accompagné : aucun danger à signaler.",
      "The alarm sees that the child is accompanied: no danger to report.")),
]

SECURITY = [
    (("La sécurité, une obligation légale", "Safety, a legal obligation"),
     ("Depuis 2004, les propriétaires de piscine enterrée doivent installer un dispositif de "
      "sécurité. Notre solution complète les protections comme les bâches et les couvertures, "
      "efficaces la nuit mais ouvertes pendant la journée.",
      "Since 2004, owners of in-ground pools in France must install a safety device. Our solution "
      "complements protections such as covers, effective at night but left open during the day.")),
    (("Être en règle ne suffit pas", "Being compliant is not enough"),
     ("Selon les enquêtes de Santé publique France, plusieurs centaines de noyades sont à déplorer "
      "chaque année, et dans 68 % des cas un système de sécurité était présent mais n'a pas rempli "
      "sa fonction.",
      "According to Santé publique France surveys, several hundred drownings occur every year, and "
      "in 68% of cases a safety system was there but did not do its job.")),
    (("Des systèmes inadaptés aux usages", "Systems that do not fit daily life"),
     ("Barrières, volets et couvertures restent souvent ouverts la journée. Les alarmes "
      "d'immersion ne détectent pas toujours la chute d'un enfant, ou sont désactivées à cause de "
      "leurs déclenchements intempestifs.",
      "Barriers, shutters and covers are often left open during the day. Immersion alarms do not "
      "always detect a child's fall, or get switched off because of their untimely alerts.")),
    (("Une seconde ligne de protection", "A second line of protection"),
     ("Notre alarme périmétrique réduit considérablement les risques de noyade. Conçue avec des "
      "familles, elle s'adapte à vos habitudes et protège dans la réalité du quotidien.",
      "Our perimeter alarm considerably reduces the risk of drowning. Designed with families, it "
      "fits your habits and protects in the reality of everyday life.")),
]

PARTNERS = [
    ("BPI-France.webp", "Bpifrance"),
    ("Logo-french-tech.webp", "French Tech"),
    ("Logo_FT_SaintEtienne-Lyon_Couleur__1_.png", "French Tech Saint-Étienne — Lyon"),
    ("Macaron-labellise-LSU.webp", "Labellisé Lyon Start Up"),
    ("Logo-manufactpry.webp", "Manufactory"),
]

# --------------------------------------------------------------------------- #
# Page
# --------------------------------------------------------------------------- #


def mail_button(key, fr, en, cls="btn btn-primary magnetic"):
    return f'<a class="{cls}" href="{MAILTO}">{t("span", key, fr, en)}<span class="arrow">↗</span></a>'


def body_home():
    lines = "\n".join(
        f'            <li><span class="sl-num">0{i}</span>{t("span", f"hero.l{i}", fr, en)}</li>'
        for i, (fr, en) in enumerate(HERO_LINES, 1))
    kpis = "\n".join(
        f'            <div><dt>{t("span", f"kp{i}", *label)}</dt><dd>'
        + (f'<span data-count="{v}">{v}</span>' if v.isdigit() else v)
        + (f"<small>{unit}</small>" if unit else "") + "</dd></div>"
        for i, (v, unit, label) in enumerate(KPIS, 1))
    steps = "\n".join(f"""            <li class="story-step" data-step="{i - 1}">
              <span class="step-num">0{i}</span>
              {t("h3", f"st{i}.t", *title)}
              {t("p", f"st{i}.p", *text)}
            </li>""" for i, (title, text, _) in enumerate(STEPS, 1))
    states = "".join(t("span", f"st{i}.s", *state, f' class="story-state" data-state="{i - 1}"')
                     for i, (_, _, state) in enumerate(STEPS, 1))
    detection = "\n".join(f"""            <div class="service">
              <span class="svc-num">0{i}</span>
              {t("h3", f"dt{i}.t", *title)}
              {t("p", f"dt{i}.p", *text)}
            </div>""" for i, (title, text) in enumerate(DETECTION, 1))
    features = "\n".join(f"""          <article class="tile feature reveal" style="--accent:{colour}">
            <span class="pillar-icon">{icon(ic)}</span>
            {t("h3", f"ft{i}.t", *title)}
            {t("p", f"ft{i}.p", *text)}
          </article>""" for i, (ic, colour, title, text) in enumerate(FEATURES, 1))
    box = "".join(t("li", f"box{i}", fr, en) for i, (fr, en) in enumerate(BOX, 1))
    videos = "\n".join(f"""          <figure class="clip clip-{kind} reveal">
            <div class="clip-frame">
              <video muted loop playsinline controls preload="none" poster="assets/img/poster-{name}.webp" width="1920" height="1080">
                <source src="assets/video/{name}.mp4" type="video/mp4">
              </video>
              <span class="hud hud-rec" aria-hidden="true"><i></i>CAM 0{i}</span>
            </div>
            <figcaption>{t("span", f"vd{i}.s", *status, ' class="clip-status"')}{t("span", f"vd{i}.c", *caption)}</figcaption>
          </figure>""" for i, (name, kind, status, caption) in enumerate(VIDEOS, 1))
    security = "\n".join(f"""            <div class="focus-item">
              <span class="fi-num">0{i}</span>
              {t("h3", f"sc{i}.t", *title)}
              {t("p", f"sc{i}.p", *text)}
            </div>""" for i, (title, text) in enumerate(SECURITY, 1))
    partners = "\n".join(f'              <li><img src="assets/img/{f}" alt="{html.escape(alt)}" loading="lazy"></li>'
                         for f, alt in PARTNERS)

    return f"""    <!-- Hero -->
    <section id="top" class="scene hero" data-shape="beacon" data-side="1">
      <div class="wrap">
        <div class="hero-content">
          <p class="eyebrow"><span class="pulse-dot"></span>{t("span", "hero.eyebrow", "Alarme de piscine périmétrique · IA embarquée", "Perimeter pool alarm · On-device AI")}</p>
          <h1 class="hero-title">
            <span class="ht-line"><span class="ht-word">{t("span", "hero.t1", "Veille sur", "Watching over")}</span></span>
            <span class="ht-line"><span class="ht-word ht-glow">{t("span", "hero.t2", "vos enfants", "your children")}</span></span>
          </h1>
          <ul class="service-lines">
{lines}
          </ul>
          {t("p", "hero.sub", "Facile à installer, discrète et autonome, la caméra intelligente Guardia analyse la situation autour de votre piscine et évite les fausses alertes (vent, ballons, bouées…).", "Easy to install, discreet and autonomous, the Guardia smart camera analyses what happens around your pool and avoids false alarms (wind, balls, pool floats…).", ' class="hero-sub"')}
          <div class="hero-cta">
            <a href="#fonctionnement" class="btn btn-primary magnetic">{t("span", "hero.cta1", "Voir l'alarme en action", "See the alarm in action")}<span class="arrow">↓</span></a>
            {mail_button("hero.cta2", "Nous contacter", "Contact us", "btn btn-ghost magnetic")}
          </div>
        </div>
      </div>
      <div class="scroll-cue" aria-hidden="true"><span></span>{t("i", "hero.scroll", "Défiler", "Scroll")}</div>
    </section>

    <!-- The facts -->
    <section id="constat" class="scene" data-shape="ripple" data-side="-1">
      <div class="wrap wrap-right">
        <div class="card reveal" style="--accent:#ff8a6b;--accent2:#ffb37a">
          {t("p", "kp.k", "Le constat", "The facts", ' class="kicker"')}
          {t("h2", "kp.t", "Quelques minutes <em>d'inattention</em>", "A few minutes <em>of inattention</em>", ' class="title"')}
          {t("p", "kp.p", "Les accidents surviennent le plus souvent pendant les périodes « floues », lorsque les adultes s'éloignent du bassin (repas, jardinage…). Les enfants échappent à leur attention quelques minutes, malheureusement suffisantes pour qu'un drame survienne.", "Accidents happen most often during “blurred” moments, when the adults step away from the pool (a meal, some gardening…). Children slip out of their attention for a few minutes — sadly, enough for a tragedy.", ' class="lede"')}
          <dl class="kpis">
{kpis}
          </dl>
          {t("p", "kp.src", "Source : enquêtes Noyades de Santé publique France.", "Source: Santé publique France drowning surveys.", ' class="source"')}
        </div>
      </div>
    </section>

    <!-- How it works: the scenario plays as the page scrolls -->
    <section id="fonctionnement" class="scene story" data-shape="watch" data-side="1">
      <div class="story-stage">
        <div class="wrap">
          <div class="card story-card reveal">
            {t("p", "st.k", "Le principe · en trois temps", "How it works · in three steps", ' class="kicker"')}
            {t("h2", "st.t", "Une seconde ligne <em>de protection</em>", "A second line <em>of protection</em>", ' class="title"')}
            <p class="story-status" aria-live="polite"><span class="status-dot"></span>{states}</p>
            <ol class="story-steps">
{steps}
            </ol>
            <div class="story-rail" aria-hidden="true"><span></span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Detection -->
    <section id="detection" class="scene" data-shape="pose" data-side="-1">
      <div class="wrap wrap-right">
        <div class="card reveal" style="--accent:#4fe0c0;--accent2:#6fd6ff">
          {t("p", "dt.k", "Détection intelligente", "Smart detection", ' class="kicker"')}
          {t("h2", "dt.t", "Elle reconnaît <em>qui s'approche</em>", "It knows <em>who is coming</em>", ' class="title"')}
          {t("p", "dt.p", "Notre intelligence artificielle embarquée reconnaît enfants, adultes et animaux. L'alarme évite ainsi les fausses alertes dues au vent, aux ballons ou aux bouées.", "Our on-device artificial intelligence recognises children, adults and animals. The alarm thus avoids false alerts caused by wind, balls or pool floats.", ' class="lede"')}
          <div class="services">
{detection}
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="fonctionnalites" class="scene scene-short" data-shape="water" data-side="0">
      <div class="wrap">
        <div class="intro reveal">
          {t("p", "ft.k", "Fonctionnalités", "Features", ' class="kicker"')}
          {t("h2", "ft.t", "Concrètement, <em>comment ça marche ?</em>", "In practice, <em>how does it work?</em>", ' class="title title-xl"')}
          {t("p", "ft.p", "Une caméra autonome, une IA embarquée, aucune donnée qui sort de chez vous.", "An autonomous camera, on-device AI, and no data leaving your home.", ' class="lede center"')}
        </div>
        <div class="tiles features">
{features}
        </div>
      </div>
    </section>

    <!-- The camera -->
    <section id="camera" class="scene" data-shape="camera" data-side="1">
      <div class="wrap">
        <div class="card card-wide product reveal">
          <div class="product-shot"><img src="assets/img/Camera-Luxonis.webp" alt="{tr("cam.alt", "Caméra intelligente Guardia", "The Guardia smart camera")}" data-i18n-alt="cam.alt" width="500" height="500" loading="lazy"></div>
          <div>
            {t("p", "cam.k", "Le produit", "The product", ' class="kicker"')}
            {t("h2", "cam.t", "La caméra <em>intelligente Guardia</em>", "The Guardia <em>smart camera</em>", ' class="title"')}
            {t("p", "cam.p", "Une alarme sonore intégrée et un processeur d'intelligence artificielle : les images sont analysées par la caméra elle-même, au bord de votre piscine. Rien n'est envoyé sur internet.", "A built-in siren and an artificial intelligence processor: images are analysed by the camera itself, by your pool. Nothing is sent over the internet.", ' class="lede"')}
            <dl class="kpis kpis-2">
              <div><dt>{t("span", "cam.k1", "image envoyée dans le cloud", "image sent to the cloud")}</dt><dd><span data-count="0">0</span></dd></div>
              <div><dt>{t("span", "cam.k2", "travaux autour de la piscine", "building work around the pool")}</dt><dd><span data-count="0">0</span></dd></div>
            </dl>
            {t("p", "cam.box", "Dans la boîte", "In the box", ' class="kicker small"')}
            <ul class="chips">{box}</ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Videos -->
    <section id="videos" class="scene scene-short" data-shape="water" data-side="0">
      <div class="wrap">
        <div class="intro reveal">
          {t("p", "vd.k", "Vidéos", "Videos", ' class="kicker"')}
          {t("h2", "vd.t", "L'alarme <em>en situation</em>", "The alarm <em>in action</em>", ' class="title title-xl"')}
          {t("p", "vd.p", "Deux situations filmées, telles que la caméra les analyse.", "Two filmed situations, as the camera analyses them.", ' class="lede center"')}
        </div>
        <div class="clips">
{videos}
        </div>
      </div>
    </section>

    <!-- Security -->
    <section id="securite" class="scene" data-shape="fence" data-side="1">
      <div class="wrap">
        <div class="card card-wide reveal">
          {t("p", "sc.k", "Sécuriser sa piscine", "Making a pool safe", ' class="kicker"')}
          {t("h2", "sc.t", "Les protections existantes <em>ne suffisent pas</em>", "Existing protections <em>are not enough</em>", ' class="title"')}
          {t("p", "sc.p", "Barrière, couverture, alarme d'immersion : chacune a ses moments d'absence. Guardia veille sur toute la zone, sans rien changer à vos habitudes.", "Barrier, cover, immersion alarm: each has its moments of absence. Guardia watches the whole area, without changing your habits.", ' class="lede"')}
          <div class="focus">
{security}
          </div>
        </div>
      </div>
    </section>

    <!-- About -->
    <section id="a-propos" class="scene" data-shape="beacon" data-side="-1">
      <div class="wrap wrap-right">
        <div class="card reveal">
          {t("p", "ab.k", "À propos", "About", ' class="kicker"')}
          {t("h2", "ab.t", "Notre mission : <em>éviter les noyades</em>", "Our mission: <em>preventing drownings</em>", ' class="title"')}
          {t("p", "ab.p1", "De nombreux accidents surviennent encore chaque année malgré les systèmes de sécurité en place : alarmes qui dysfonctionnent, couvertures et bâches laissées ouvertes… La mission de Guardia est de tout mettre en œuvre pour éviter les noyades dans les piscines.", "Many accidents still happen every year despite the safety systems in place: alarms that malfunction, covers left open… Guardia's mission is to do everything possible to prevent drownings in pools.")}
          {t("p", "ab.p2", "Grâce à notre expertise en intelligence artificielle, nous avons conçu une alarme qui surveille en permanence les abords de la piscine et se fond dans les habitudes de ses utilisateurs.", "Drawing on our expertise in artificial intelligence, we designed an alarm that constantly watches the pool surroundings and blends into its users' habits.")}
          {t("p", "ab.p3", "Guardia est née à Lyon, où elle a été accompagnée par la French Tech Saint-Étienne — Lyon et Bpifrance, et labellisée Lyon Start Up.", "Guardia was born in Lyon, where it was supported by French Tech Saint-Étienne — Lyon and Bpifrance, and labelled Lyon Start Up.")}
          {t("p", "ab.pk", "Ils nous accompagnent", "They support us", ' class="kicker small"')}
          <ul class="partners">
{partners}
          </ul>
          <a class="press" href="{PRESS}" target="_blank" rel="noopener">
            <img src="assets/img/Capture-decran-2023-04-04-155457.webp" alt="" width="538" height="565" loading="lazy">
            <span>{t("span", "ab.press.k", "Ils parlent de nous · Tribune de Lyon", "In the press · Tribune de Lyon", ' class="press-k"')}{t("span", "ab.press.t", "« Guardia, la caméra de piscine anti-noyade »", "“Guardia, the anti-drowning pool camera”", ' class="press-t"')}</span>
            <span class="arrow">↗</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="scene contact" data-shape="water" data-side="0">
      <div class="wrap">
        <div class="intro reveal">
          {t("p", "ct.k", "Contact", "Contact", ' class="kicker"')}
          {t("h2", "ct.t", "Une question sur <em>l'alarme Guardia ?</em>", "A question about <em>the Guardia alarm?</em>", ' class="title title-xl"')}
          {t("p", "ct.p", "L'alarme, l'installation, le projet ou une demande presse : écrivez-nous, nous répondons directement.", "The alarm, its installation, the project or a press enquiry: write to us, we answer directly.", ' class="lede center"')}
          <div class="hero-cta center">
            <a class="btn btn-primary magnetic" href="{MAILTO}">{EMAIL}<span class="arrow">↗</span></a>
          </div>
        </div>
      </div>
      <footer class="footer">
        <span>© Guardia SAS — {t("span", "ftr.tag", "Alarme de piscine intelligente", "Smart pool alarm")}</span>
        <span><a href="{MAILTO}">{EMAIL}</a> · {t("a", "ftr.legal", "Mentions légales", "Legal notice", ' href="mentions-legales/"')}</span>
      </footer>
    </section>"""


def page_home():
    title = tr("meta.title", *META_TITLE)
    desc = tr("meta.description", *META_DESC)
    body = body_home()
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta name="theme-color" content="#04050c">
  <link rel="canonical" href="{URL}">
  <link rel="alternate" hreflang="fr" href="{URL}?lang=fr">
  <link rel="alternate" hreflang="en" href="{URL}?lang=en">
  <link rel="alternate" hreflang="x-default" href="{URL}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{URL}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:image" content="{URL}assets/og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  {LANG_SCRIPT}
  <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
  <link rel="apple-touch-icon" href="assets/img/icon-256.png">
  {FONTS}
  <link href="assets/css/style.css" rel="stylesheet">
  <script type="importmap">
  {{
    "imports": {{
      "three": "./assets/vendor/three.module.js"
    }}
  }}
  </script>
</head>
<body class="is-loading">
  <canvas id="field" class="field" aria-hidden="true"></canvas>
  <div class="veil" aria-hidden="true"></div>
  <div class="scroll-progress" aria-hidden="true"><span></span></div>

  <nav class="topnav" aria-label="{tr("nav.aria", "Navigation principale", "Main navigation")}" data-i18n-aria="nav.aria">
    <a href="#top" class="brand" aria-label="Guardia">{brand()}</a>
    <div class="nav-links">
      {t("a", "nav.how", "Le principe", "How it works", ' href="#fonctionnement"')}
      {t("a", "nav.detect", "Détection", "Detection", ' href="#detection"')}
      {t("a", "nav.cam", "La caméra", "The camera", ' href="#camera"')}
      {t("a", "nav.videos", "Vidéos", "Videos", ' href="#videos"')}
      {t("a", "nav.about", "À propos", "About", ' href="#a-propos"')}
      <a href="#contact">Contact</a>
    </div>
    <div class="lang-switch" role="group" aria-label="{tr("nav.lang", "Langue", "Language")}" data-i18n-aria="nav.lang">
      <button type="button" data-lang="fr">FR</button><button type="button" data-lang="en">EN</button>
    </div>
  </nav>

  <main>
{body}
  </main>

  <script src="assets/vendor/gsap.min.js"></script>
  <script src="assets/vendor/ScrollTrigger.min.js"></script>
  <script src="assets/vendor/lenis.min.js"></script>
  <script type="module" src="assets/js/main.js"></script>
</body>
</html>
"""


def strings_js():
    lines = "\n".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}," for k, v in EN.items())
    return ("// Generated by tools/build.py — do not edit by hand.\n"
            "// English for the elements of index.html tagged data-i18n / data-i18n-aria / data-i18n-alt.\n"
            f"export const STATIC_EN = {{\n{lines}\n}};\n")


def subpage(p, title, desc, body, robots=""):
    """A page without the particle field: 404 and legal notice."""
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}">{robots}
  <meta name="theme-color" content="#04050c">
  <link rel="icon" type="image/svg+xml" href="{p}assets/img/favicon.svg">
  <link href="{p}assets/css/style.css" rel="stylesheet">
</head>
<body class="subpage">
  <nav class="topnav scrolled">
    <a href="{p or './'}" class="brand" aria-label="Guardia">{brand()}</a>
  </nav>
  <main>
{body}
  </main>
</body>
</html>
"""


def page_404():
    return subpage("/", f"Page introuvable · Page not found — {SITE}", "Page not found.", """    <section class="scene contact">
      <div class="wrap">
        <div class="intro">
          <p class="kicker">404</p>
          <h1 class="title title-xl">Page introuvable <em>· Page not found</em></h1>
          <p class="lede center">Cette adresse n'existe pas, ou plus. · This address does not exist, or no longer does.</p>
          <div class="hero-cta center"><a class="btn btn-primary" href="/">Guardia</a></div>
        </div>
      </div>
    </section>""", robots='\n  <meta name="robots" content="noindex">')


def page_legal():
    g = {k: html.escape(v) for k, v in PUBLISHER.items()}
    return subpage("../", f"Mentions légales — {SITE}",
                   "Mentions légales du site guardiapool.com, édité par Guardia SAS.", f"""    <section class="scene legal">
      <div class="wrap">
        <div class="card">
          <p class="kicker">Legal notice</p>
          <h1 class="title">Mentions <em>légales</em></h1>

          <h2>Éditeur</h2>
          <p>Le site guardiapool.com est édité par <strong>{g["name"]}</strong>, {g["form"]},
            SIREN {g["siren"]}, code APE {g["ape"]}, TVA intracommunautaire {g["vat"]}.<br>
            Directeur de la publication : {g["director"]}.<br>
            Contact : <a href="mailto:{g["email"]}">{g["email"]}</a>.</p>

          <h2>Hébergement</h2>
          <p>GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107,
            États-Unis — <a href="https://pages.github.com">pages.github.com</a>.</p>

          <h2>Données personnelles et cookies</h2>
          <p>Ce site est statique : il ne dépose aucun cookie, n'utilise aucun outil de mesure
            d'audience et ne collecte aucune donnée personnelle. Il ne charge aucune ressource
            externe. Aucun formulaire n'y est hébergé : les prises de contact se font par e-mail.</p>

          <h2>Vente en ligne</h2>
          <p>Ce site présente le produit. Il ne permet ni commande ni paiement en ligne.</p>

          <h2>Propriété intellectuelle</h2>
          <p>Les textes, images, vidéos, marques et logos de ce site appartiennent à {g["name"]},
            sauf mention contraire. Toute reproduction sans autorisation écrite préalable est
            interdite.</p>

          <h2>Legal notice (English)</h2>
          <p>Published by {g["name"]} SAS, SIREN {g["siren"]}, VAT {g["vat"]}.
            Publication director: Paul Asquin, President. Contact: <a href="mailto:{g["email"]}">{g["email"]}</a>.
            Hosted by GitHub, Inc. No cookies, no tracking, no personal data collected, no online
            sales.</p>
          <p><a href="../">← guardiapool.com</a></p>
        </div>
      </div>
    </section>""")


def redirect_stub(target, canonical, label):
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Redirection — {SITE}</title>
<meta http-equiv="refresh" content="0; url={target}">
<link rel="canonical" href="{URL}{canonical}">
<meta name="robots" content="noindex">
</head>
<body>
<p>Cette page a été déplacée. <a href="{target}">{label}</a>.</p>
</body>
</html>
"""


# Former pages, kept as redirects so that incoming links do not break.
REDIRECTS = {
    "videos/": ("../#videos", "#videos", "Voir les vidéos"),
    "a-propos/": ("../#a-propos", "#a-propos", "À propos de Guardia"),
    "contact/": ("../#contact", "#contact", "Nous contacter"),
    "conditions-generales-dutilisation/": ("../mentions-legales/", "mentions-legales/", "Voir les mentions légales"),
    "conditions-generales-de-vente/": ("../mentions-legales/", "mentions-legales/", "Voir les mentions légales"),
}


def write(rel, content):
    dest = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(dest) or ROOT, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  written  {rel:44} {len(content):>7} chars")


def main():
    print("Building guardiapool.com:")
    write("index.html", page_home())
    write("assets/js/strings.js", strings_js())
    write("404.html", page_404())
    write("mentions-legales/index.html", page_legal())
    for path, (target, canonical, label) in REDIRECTS.items():
        write(path + "index.html", redirect_stub(target, canonical, label))
    write("assets/img/favicon.svg", lighthouse_svg("", bg=True) + "\n")
    print("Done.")


if __name__ == "__main__":
    main()
