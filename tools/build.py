#!/usr/bin/env python3
"""Génère les pages statiques de guardiapool.com.

Le contenu éditorial est défini plus bas en structures Python : c'est la source
de vérité, les fichiers HTML sont produits à partir d'elles.

Les liens internes sont relatifs (préfixe `../` selon la profondeur), pour que le
site fonctionne à la racine d'un domaine comme sous un sous-chemin. Seule
exception : 404.html, servi depuis une URL arbitraire, utilise des chemins absolus.

Usage : python3 tools/build.py
"""

import html
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SITE = "Guardiapool"
SLOGAN = "Alarme de piscine intelligente"
EMAIL = "contact.guardiapool@gmail.com"
MAILTO = f"mailto:{EMAIL}"

# (slug relatif à la racine du site, libellé)
NAV = [
    ("", "Accueil"),
    ("videos/", "Vidéos"),
    ("a-propos/", "À propos"),
    ("contact/", "Contact"),
]

PIED = [
    ("mentions-legales/", "Mentions légales"),
]

# Anciennes URL conservées en redirection, pour ne pas casser les liens entrants.
REDIRECTIONS = {
    "conditions-generales-dutilisation/": "mentions-legales/",
    "conditions-generales-de-vente/": "mentions-legales/",
}

PARTENAIRES = [
    ("BPI-France.webp", "BPI France"),
    ("Logo-french-tech.webp", "French Tech"),
    ("Logo_FT_SaintEtienne-Lyon_Couleur__1_.png", "French Tech Saint-Étienne — Lyon"),
    ("Macaron-labellise-LSU.webp", "Labellisé Lyon Start Up"),
    ("Logo-manufactpry.webp", "Manufactory"),
]


# --------------------------------------------------------------------------- #
# Gabarit
# --------------------------------------------------------------------------- #

def page(slug, titre, corps_fn, description, prefixe=None):
    """Assemble une page complète.

    `slug`     : chemin du fichier relatif à la racine du site ('' pour l'accueil)
    `corps_fn` : callable(p) -> HTML du <main>, où p est le préfixe de liens
    """
    if prefixe is None:
        profondeur = slug.count("/")
        prefixe = "../" * profondeur
    p = prefixe

    nav = "\n".join(
        f'        <a href="{p}{url}"{" aria-current=\"page\"" if url == slug else ""}>'
        f"{html.escape(nom)}</a>"
        for url, nom in NAV
    )
    liens_pied = "\n".join(
        f'        <a href="{p}{url}">{html.escape(nom)}</a>' for url, nom in PIED
    )
    corps = corps_fn(p)

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(titre)}</title>
<meta name="description" content="{html.escape(description)}">
<link rel="icon" type="image/webp" href="{p}assets/img/Lighthouse.webp">
<link rel="stylesheet" href="{p}assets/css/style.css">
<meta property="og:title" content="{html.escape(titre)}">
<meta property="og:description" content="{html.escape(description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="https://guardiapool.com/assets/img/Piscine-surveillee-par-Guardiapool-3.webp">
</head>
<body>

<header class="site-entete">
  <div class="contenu">
    <a class="logo" href="{p or './'}">
      <img src="{p}assets/img/cropped-Logo-GUARDIA.webp" alt="Guardiapool" height="42">
    </a>
    <nav class="nav">
{nav}
    </nav>
  </div>
</header>

<main>
{corps}
</main>

<footer class="site-pied">
  <div class="contenu">
    <p class="mention">
      <strong>Guardia</strong> — {html.escape(SLOGAN)}<br>
      <a href="{MAILTO}">{EMAIL}</a>
    </p>
    <nav>
{liens_pied}
    </nav>
  </div>
</footer>

</body>
</html>
"""


def ecrire(chemin_rel, contenu):
    dest = os.path.join(RACINE, chemin_rel)
    os.makedirs(os.path.dirname(dest) or RACINE, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(contenu)
    print(f"  écrit  {chemin_rel:52} {len(contenu):>7} o")


# --------------------------------------------------------------------------- #
# Blocs réutilisables
# --------------------------------------------------------------------------- #

def bandeau_contact(titre="Une question sur l'alarme Guardia ?",
                    texte="Écrivez-nous, nous répondons directement."):
    return f"""  <section class="section">
    <div class="contenu">
      <div class="bandeau">
        <h2>{html.escape(titre)}</h2>
        <p>{html.escape(texte)}</p>
        <a class="bouton" href="{MAILTO}">Nous contacter</a>
      </div>
    </div>
  </section>"""


def bloc_partenaires(p, titre="Nos partenaires"):
    logos = "\n".join(
        f'        <img src="{p}assets/img/{f}" alt="{html.escape(alt)}" loading="lazy">'
        for f, alt in PARTENAIRES
    )
    return f"""  <section class="section">
    <div class="contenu">
      <h2>{html.escape(titre)}</h2>
      <div class="partenaires">
{logos}
      </div>
    </div>
  </section>"""


VIDEOS = [
    ("Danger-detecte.mp4", "Un enfant non accompagné est détecté. L'alarme est déclenchée !"),
    ("Adulte-detecte.mp4", "L'alarme détecte que l'enfant est accompagné. Aucun danger à signaler."),
]


def bloc_videos(p, titre="Guardia en vidéos"):
    items = "\n".join(f"""        <div class="video">
          <figure>
            <video controls preload="metadata" playsinline>
              <source src="{p}assets/video/{f}" type="video/mp4">
              Votre navigateur ne peut pas lire cette vidéo.
            </video>
            <figcaption>{html.escape(legende)}</figcaption>
          </figure>
        </div>""" for f, legende in VIDEOS)
    return f"""  <section class="section">
    <div class="contenu">
      <h2>{html.escape(titre)}</h2>
      <div class="videos">
{items}
      </div>
    </div>
  </section>"""


def cartes(items):
    return "\n".join(f"""        <div class="carte">
          <h3>{html.escape(t)}</h3>
          <p>{html.escape(d)}</p>
        </div>""" for t, d in items)


# --------------------------------------------------------------------------- #
# Contenu éditorial
# --------------------------------------------------------------------------- #

FONCTIONNALITES = [
    ("Alarme périmétrique",
     "La caméra surveille une large zone autour de la piscine et détecte si votre "
     "enfant s'en approche sans être accompagné d'un adulte."),
    ("Anticipation précieuse",
     "Une puissante alarme prévient avant qu'un accident ne survienne et vous permet "
     "un gain de temps décisif pour intervenir."),
    ("Détection intelligente",
     "Notre intelligence artificielle embarquée reconnaît enfants, adultes et animaux. "
     "L'alarme évite les fausses alertes (vent, ballons, bouées…)."),
    ("Respecte votre vie privée",
     "Aucune donnée ne sort de chez vous. Le respect de votre vie privée est primordial."),
    ("Fonctionnement autonome",
     "Développée avec nos utilisateurs, l'alarme est intelligente et autonome. "
     "Plus besoin de la désactiver avant la baignade."),
    ("Facile à installer",
     "La caméra est très facile à installer (mur, arbre, poteau) et ne nécessite pas "
     "de travaux autour de votre piscine."),
]

SECURITE = [
    ("La sécurité, une obligation légale",
     "Depuis 2004, les propriétaires de piscine enterrée ont l'obligation légale "
     "d'installer un dispositif de sécurité. Notre solution vient compléter les moyens "
     "de protection, comme les bâches et les couvertures, qui sont efficaces pendant "
     "la nuit mais restent ouvertes pendant la journée."),
    ("Être en conformité avec la législation ne suffit pas",
     "Selon les enquêtes de Santé Publique France, plusieurs centaines de noyades sont "
     "à déplorer chaque année. Le nombre de victimes chez les moins de 6 ans a doublé "
     "entre 2015 et 2018. Pourtant, dans 68 % des cas de noyades, un système de sécurité "
     "était présent mais n'a pas rempli sa fonction."),
    ("Les systèmes actuels ne sont pas adaptés aux usages",
     "Barrières, volets et couvertures de protection sont souvent laissés ouverts pendant "
     "la journée. Les alarmes d'immersion ne parviennent pas toujours à détecter la chute "
     "des enfants, ou sont désactivées en raison de leur fonctionnement intempestif. "
     "Un système de sécurité efficace doit se fondre dans les habitudes et s'intégrer au "
     "mode de vie de ses utilisateurs."),
    ("Le risque des périodes « floues »",
     "Les accidents surviennent le plus fréquemment dans les périodes dites « floues », "
     "lorsque les adultes s'éloignent du bassin (repas, jardinage…) et que les enfants ne "
     "sont plus sous leur surveillance étroite. Les enfants échappent à l'attention des "
     "adultes quelques minutes, malheureusement suffisantes pour qu'un drame ne survienne."),
    ("Installer un système complémentaire réduit considérablement les risques",
     "L'installation de notre alarme de piscine périmétrique offre une seconde ligne de "
     "protection et réduit considérablement les risques de noyade. Notre système a été "
     "conçu en collaboration avec des familles pour s'adapter parfaitement à vos habitudes "
     "et assurer une protection qui prend en compte la réalité du quotidien."),
]

CHIFFRES = [
    "Les enfants de moins de 6 ans représentent 75 % des victimes de noyade en piscines privées.",
    "Le nombre de noyades chez les moins de 6 ans a doublé entre 2015 et 2018.",
    "Un enfant peut se noyer en moins de 2 minutes dans 20 cm d'eau.",
]


def corps_accueil(p):
    chiffres = "\n".join(
        f'        <p class="chiffre">{html.escape(c)}</p>' for c in CHIFFRES)
    return f"""  <section class="hero">
    <div class="contenu">
      <h1>Alarme de piscine périmétrique <br> intelligente et innovante</h1>
      <p class="accroche">Notre alarme de piscine périmétrique est intelligente et prévient
        si votre enfant s'approche seul de la piscine.</p>
      <p class="accroche">Facile à installer, discrète et autonome, notre caméra intelligente
        Guardia analyse la situation et évite les fausses alertes (vent, objets…).</p>
      <div class="actions">
        <a class="bouton" href="{MAILTO}">Nous contacter</a>
        <a class="bouton secondaire" href="{p}videos/">Voir l'alarme en action</a>
      </div>
      <div class="hero-visuel">
        <img src="{p}assets/img/Piscine-surveillee-par-Guardiapool-3.webp"
             alt="Piscine surveillée par la caméra Guardiapool" width="1024" height="1024">
      </div>
    </div>
  </section>

{bloc_videos(p, "L'alarme en situation")}

  <section class="section">
    <div class="contenu">
      <h2>Concrètement, comment fonctionne notre alarme intelligente ?</h2>
      <p class="intro">Une caméra autonome, une IA embarquée, aucune donnée qui sort de chez vous.</p>
      <div class="grille">
{cartes(FONCTIONNALITES)}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>La caméra intelligente Guardia</h2>
      <p class="intro">Contient : caméra intelligente Guardia équipée d'une alarme sonore,
        cordon de raccordement électrique, manuel d'utilisation.</p>
      <div class="hero-visuel">
        <img src="{p}assets/img/Camera-Luxonis.webp" alt="Caméra intelligente Guardia"
             loading="lazy">
      </div>
    </div>
  </section>

{bloc_partenaires(p)}

  <section class="section">
    <div class="contenu">
      <h2>L'importance de bien sécuriser sa piscine</h2>
      <div class="grille">
{cartes(SECURITE)}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>Chiffres clés</h2>
      <div class="chiffres">
{chiffres}
      </div>
    </div>
  </section>

{bandeau_contact()}
"""


def corps_a_propos(p):
    return f"""  <section class="hero">
    <div class="contenu">
      <h1>À propos</h1>
      <div class="hero-visuel">
        <img src="{p}assets/img/pexels-kindel-media-9044048.webp"
             alt="Illustration d'un enfant en sécurité dans la piscine." loading="lazy">
      </div>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>Notre mission</h2>
      <p>De nombreux accidents surviennent encore chaque année malgré les systèmes de
        sécurité en place (alarmes qui dysfonctionnent, couvertures et bâches laissées
        ouvertes…). La mission de Guardia est de tout mettre en œuvre pour éviter les
        noyades dans les piscines.</p>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>Notre expertise</h2>
      <p>Grâce à notre expertise en intelligence artificielle, nous avons conçu une alarme
        innovante qui se fond dans les habitudes de ses utilisateurs.</p>
      <p>Le cœur de notre expertise est notre technologie de détection sophistiquée qui
        utilise des capteurs et des algorithmes d'intelligence artificielle avancés pour
        surveiller en permanence les mouvements et les activités autour de la piscine.
        En cas de détection d'une situation potentiellement dangereuse, notre système
        déclenche immédiatement une alerte sonore pour avertir les adultes de la présence
        d'un danger.</p>
      <div class="hero-visuel">
        <img src="{p}assets/img/pexels-perfecto-capucine-1247527.webp"
             alt="Une personne se détend au bord d'une piscine." loading="lazy">
      </div>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>Guardia, une startup lyonnaise</h2>
      <p>Guardia est une startup lyonnaise, accompagnée par la French Tech
        Saint-Étienne — Lyon et BPI France, et labellisée Lyon Start Up.</p>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>Ils parlent de nous</h2>
      <p class="intro">Tribune de Lyon</p>
      <div class="hero-visuel">
        <img src="{p}assets/img/Capture-decran-2023-04-04-155457.webp"
             alt="Article de la Tribune de Lyon consacré à Guardia." loading="lazy">
      </div>
    </div>
  </section>

{bloc_partenaires(p)}

{bandeau_contact("Envie d'en savoir plus sur le projet ?", "Nous sommes joignables par email.")}
"""


def corps_videos(p):
    return f"""  <section class="hero">
    <div class="contenu">
      <h1>Guardia en vidéos</h1>
      <p class="accroche">Deux situations filmées, telles que la caméra les analyse.</p>
    </div>
  </section>

{bloc_videos(p, "Détection en conditions réelles")}

{bandeau_contact()}
"""


def corps_contact(p):
    return f"""  <section class="hero">
    <div class="contenu">
      <h1>Contactez-nous</h1>
      <p class="accroche">Une question sur l'alarme, le projet ou une demande presse&nbsp;?
        Écrivez-nous, nous répondons directement.</p>
      <div class="actions">
        <a class="bouton" href="{MAILTO}">{EMAIL}</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="contenu">
      <h2>Guardia</h2>
      <p>SAS Guardia — France</p>
      <p><a href="{MAILTO}">{EMAIL}</a></p>
    </div>
  </section>
"""


def corps_404(p):
    return f"""  <section class="hero">
    <div class="contenu">
      <h1>Page introuvable</h1>
      <p class="accroche">Cette adresse n'existe pas ou n'existe plus.</p>
      <div class="actions">
        <a class="bouton" href="/">Retour à l'accueil</a>
      </div>
    </div>
  </section>
"""


# --------------------------------------------------------------------------- #
# Mentions légales
# --------------------------------------------------------------------------- #

def corps_mentions_legales(p):
    """Mentions légales au sens de la LCEN (art. 6-III)."""
    return f"""  <div class="contenu">
    <article class="prose">
      <h1>Mentions légales</h1>
      <p class="date">Site édité sans collecte de données ni cookie.</p>

      <h2>Éditeur du site</h2>
      <p>
        <strong>SAS Guardia</strong>, société par actions simplifiée au capital de 1 000 euros<br>
        Immatriculée au RCS de Lyon sous le numéro 910 991 140<br>
        Code APE : 6201Z — TVA intracommunautaire : FR81910991140
      </p>

      <h2>Contact</h2>
      <p><a href="{MAILTO}">{EMAIL}</a></p>

      <h2>Directeur de la publication</h2>
      <p>Vincent Asquin</p>

      <h2>Hébergement</h2>
      <p>
        Ce site est hébergé par <strong>GitHub, Inc.</strong><br>
        88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis<br>
        <a href="https://pages.github.com/">pages.github.com</a>
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>L'ensemble des contenus de ce site — textes, images, vidéos, marques et
        logos — est la propriété de la SAS Guardia, sauf mention contraire. Toute
        reproduction ou représentation, totale ou partielle, sans autorisation
        écrite préalable est interdite.</p>

      <h2>Données personnelles et cookies</h2>
      <p>Ce site est entièrement statique. Il ne dépose aucun cookie, n'utilise
        aucun traqueur et ne collecte aucune donnée personnelle. Aucun formulaire
        n'y est hébergé : les prises de contact se font par courrier électronique
        à l'adresse ci-dessus.</p>

      <h2>Vente en ligne</h2>
      <p>Ce site est une présentation du produit. Il ne permet ni commande ni
        paiement en ligne.</p>
    </article>
  </div>
"""


def stub_redirection(cible_relative, libelle):
    """Page minimale de redirection, pour ne pas casser les anciennes URL."""
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Redirection — {SITE}</title>
<meta http-equiv="refresh" content="0; url={cible_relative}">
<link rel="canonical" href="https://guardiapool.com/{libelle}">
<meta name="robots" content="noindex">
</head>
<body>
<p>Cette page a été remplacée. <a href="{cible_relative}">Voir les mentions légales</a>.</p>
</body>
</html>
"""


# --------------------------------------------------------------------------- #

def main():
    print("Génération du site Guardiapool :")

    ecrire("index.html", page(
        "", f"{SITE} — {SLOGAN}", corps_accueil,
        "Alarme de piscine périmétrique intelligente : une caméra autonome à IA "
        "embarquée qui prévient si un enfant s'approche seul du bassin."))

    ecrire("videos/index.html", page(
        "videos/", f"Vidéos — {SITE}", corps_videos,
        "Démonstrations vidéo de l'alarme de piscine Guardia : détection d'un enfant "
        "non accompagné et reconnaissance d'un enfant accompagné."))

    ecrire("a-propos/index.html", page(
        "a-propos/", f"À propos — {SITE}", corps_a_propos,
        "Guardia, startup lyonnaise : notre mission est d'éviter les noyades en piscine "
        "grâce à une alarme périmétrique à intelligence artificielle."))

    ecrire("contact/index.html", page(
        "contact/", f"Contact — {SITE}", corps_contact,
        f"Contacter Guardia : {EMAIL}."))

    ecrire("mentions-legales/index.html", page(
        "mentions-legales/", f"Mentions légales — {SITE}",
        corps_mentions_legales,
        "Mentions légales du site guardiapool.com : éditeur SAS Guardia, "
        "directeur de la publication, hébergeur, propriété intellectuelle."))

    for ancienne, cible in REDIRECTIONS.items():
        profondeur = ancienne.count("/")
        ecrire(ancienne + "index.html",
               stub_redirection("../" * profondeur + cible, ancienne))

    # 404 : chemins absolus, la page est servie depuis une URL arbitraire.
    ecrire("404.html", page(
        "", f"Page introuvable — {SITE}", corps_404, "Page introuvable.", prefixe="/"))

    print("Terminé.")


if __name__ == "__main__":
    main()
