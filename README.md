# guardiapool.com

Site of Guardia, the smart perimeter pool alarm: a camera with on-device AI that warns when a
child nears the pool alone. One page — the facts, how it works, detection, features, the camera,
videos, pool safety, about, contact — plus the legal notice. French and English, language
picked automatically.

Same visual language as [paulasquin.com](https://www.paulasquin.com) and
[aidiligence.eu](https://aidiligence.eu): dark stage, a three.js particle field that changes
shape from section to section, GSAP (ScrollTrigger) reveals and Lenis smooth scrolling.

No external request at runtime — the legal notice says so, keep it true. Everything is served
from this repository:

- `assets/vendor/` — three.js 0.186.1 (`three.module.js` + `three.core.js`), GSAP 3.15.0 +
  ScrollTrigger, Lenis 1.3.27, the same pinned builds as aidiligence.eu.
- `assets/fonts/` — Unbounded, Inter and JetBrains Mono, latin subset (SIL Open Font License).

## Build

```bash
python3 tools/build.py
```

The Python 3 standard library is enough. All page content lives in `tools/build.py`, as
(French, English) pairs. The build writes `index.html` (French, tagged `data-i18n`),
`assets/js/strings.js` (the English, generated — do not edit by hand), `mentions-legales/`,
`404.html`, `assets/img/favicon.svg` (the lighthouse mark, drawn in `lighthouse_svg`), and
redirects from the former pages (`videos/`, `a-propos/`, `contact/`, `conditions-generales-*`)
to the matching anchors. Edit `tools/build.py`, run the build, commit the generated files.

## Preview

```bash
python3 -m http.server 8797 --bind 127.0.0.1
```

Then <http://127.0.0.1:8797/> — `?lang=en` / `?lang=fr` force a language, `?debug` exposes
`window.__field`.

## Structure

- `assets/css/style.css` — styles (shared conventions with paulasquin.com).
- `assets/js/main.js` — smooth scroll, reveals, counters, the scenario, videos, nav, boot.
- `assets/js/i18n.js` — language handling (from `paulasquin/showcase-kit`).
- `assets/js/field.js` — the particle field, adapted from paulasquin.com. Each section names a
  shape (`data-shape`) and the side of the screen it sits on (`data-side`: -1, 0, 1):
  - `beacon` — the lighthouse of the logo, its rays, its beam sweeping the sea (hero, about);
  - `ripple` — a drop, the rings it spreads, a two-minute countdown (the facts);
  - `watch` — the scenario: a garden from above, the pool, the watched zone, the camera and
    its sweep, an adult and a child. `#fonctionnement` is three screens tall with a sticky
    stage; its scroll progress drives `Field.story(p)`: the two walk in together, along the
    pool (zone turns mint), then the adult leaves and the child heads for the water alone —
    the zone and the child turn red and the siren rings spread from the camera. Waypoints in
    `KEYS`; step thresholds (0.33, 0.66, alarm at 0.8) are mirrored in `main.js`;
  - `pose` — an adult and a child as the network sees them: keypoints, bones, boxes, labels
    drawn from text (`textPoints`, in the page language), a height ruler, an ignored ball;
  - `camera` — the camera box, its stereo pair, the processor and its traces;
  - `fence` — pool, barrier with its gate left open, rolled cover, and the watched perimeter;
  - `water` — a horizon of water and caustics under centred sections.
  Every shape must fill exactly `n` particles.
- `assets/video/` — the two demonstration clips; `assets/img/poster-*.webp` are their posters.
- `assets/og.jpg` — capture of the hero at 1200×630; `assets/img/icon-256.png` — the mark.

## Legal notice

`mentions-legales/` names the publisher by its SIREN number and its president. By choice, it
gives neither the registered office nor a phone number: keep it that way.

## Deployment

GitHub Pages, `main` branch, repository root. The domain is declared by the `CNAME` file.

Releases are tagged on `main`: `v1.0.0` is the former light-themed site, `v2.0.0` the redesign.
To roll back, revert `main` to a tag (`git revert --no-edit v1.0.0..main` then push) — Pages
redeploys in a minute or two, and serves `.js`/`.css` with a 10-minute cache.
