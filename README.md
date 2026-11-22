# Sabri Style

App web pour trouver son style de coiffure et de barbe en testant sur un avatar 3D stylisé.

- `public/index.html`, `style.css`, `app.js` : app statique (Three.js via CDN), aucune étape de build.
- Réglages : coiffure, longueur du dessus, côtés (dégradé), texture, forme et longueur de barbe, moustache, contour des joues.
- Looks rapides, favoris (stockés dans le navigateur), texte « à dire au barbier ».
- Modèle personnel : `public/models/sabri-head-source.glb` chargé par `public/avatar.js` (filtres barbe, moustache, longueur cheveux, dégradé appliqués en temps réel sur le mesh).

Aucune photo personnelle n'est publiée dans ce dépôt.

Déploiement : Vercel, branche `main`, dossier de sortie `public`.
