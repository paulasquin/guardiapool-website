# guardiapool.com

Site vitrine statique de Guardia.

HTML et CSS purs, sans dépendance ni framework.

## Générer les pages

```bash
python3 tools/build.py
```

La bibliothèque standard de Python 3 suffit. Le contenu des pages est défini dans
`tools/build.py`.

## Prévisualiser

```bash
python3 -m http.server 8766 --directory .
```

Puis <http://localhost:8766>.

## Déploiement

GitHub Pages, branche `main`, racine du dépôt. Le domaine est déclaré par le
fichier `CNAME`.
