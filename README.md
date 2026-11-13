# rapport-g-n-ral

Application web progressive (PWA) pour rédiger des **rapports composés de texte et de photos**, où chaque entrée est **automatiquement horodatée** et classée par **ordre chronologique**.

## Fonctionnalités

- **Rapports** : créer, renommer, supprimer des rapports.
- **Entrées chronologiques** : chaque entrée reçoit automatiquement la date et l'heure courantes ; la date reste modifiable (l'ordre se recalcule tout seul).
- **Texte + photos** : plusieurs photos par entrée, prises avec l'appareil photo du téléphone (`capture="environment"`) ou importées depuis la galerie. Les photos sont recompressées automatiquement (max 1600 px, JPEG) pour rester légères.
- **Vue chronologique** : entrées regroupées par jour, du plus ancien au plus récent.
- **Export** : téléchargement d'un fichier **HTML autonome** (photos intégrées) et impression / **enregistrement en PDF** via la boîte de dialogue d'impression du navigateur.
- **Sauvegarde** : export/import de toutes les données en **JSON** (avec les photos en base64).
- **PWA installable** : une fois ouverte dans le navigateur du téléphone, « Ajouter à l'écran d'accueil » crée une **icône** ; l'appli fonctionne ensuite **hors ligne** (service worker + stockage local IndexedDB). Aucune donnée ne quitte l'appareil.

## Lancer en local (test)

```bash
cd rapport-chronologique
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000> dans un navigateur.

## Installer sur le téléphone

Une PWA s'installe uniquement depuis une page servie en **HTTPS** (ou `localhost`). Déposez simplement les fichiers de ce dossier sur un hébergement HTTPS de votre choix (par exemple GitHub Pages, votre propre serveur, etc.), ouvrez l'URL dans le navigateur du téléphone, puis :

- **Android (Chrome)** : menu ⋮ → « Ajouter à l'écran d'accueil » / « Installer l'application ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

## Exporter un rapport en PDF

Dans un rapport : bouton **🖨 PDF** → choisissez « Enregistrer au format PDF » dans la boîte d'impression. Le bouton **⬇ HTML** télécharge un fichier `.html` autonome ouvrable partout.

## Structure

```
index.html               page unique
styles.css               styles (écran + impression)
db.js                    stockage IndexedDB + utilitaires (dates, tri chronologique)
export.js                export HTML autonome / impression PDF
app.js                   interface et logique (routes, entrées, photos, sauvegarde JSON)
manifest.webmanifest     manifeste PWA (nom, icônes, mode « standalone »)
sw.js                    service worker (fonctionnement hors ligne)
icons/                   icônes de l'appli (générées par tools/make_icons.py)
tools/make_icons.py      régénère les icônes : python3 tools/make_icons.py
```

## Données

Tout est stocké localement dans le navigateur (IndexedDB), rien n'est envoyé sur Internet. Utilisez « Exporter en JSON » pour faire une sauvegarde externe.
