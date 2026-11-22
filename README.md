# Sabri Style

App web pour trouver son style de coiffure et de barbe en testant sur un avatar 3D stylisé.

- `public/index.html`, `style.css`, `app.js` : app statique (Three.js via CDN), aucune étape de build.
- Réglages : coiffure, longueur du dessus, côtés (dégradé), texture, forme et longueur de barbe, moustache, contour des joues.
- Looks rapides, favoris (stockés dans le navigateur), texte « à dire au barbier ».
- Modèle personnel : déposer `public/models/sabri-head.glb` et il remplace l'avatar générique au chargement.

Aucune photo personnelle n'est publiée dans ce dépôt.

Déploiement : Vercel, branche `main`, dossier de sortie `public`.
