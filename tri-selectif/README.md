# Contrôle tri sélectif

Application web de contrôle du tri sélectif par magasin, palier, étage et type de déchet.

- **Contrôle terrain** : choix du magasin, du palier et de l'étage, puis « Bien trié », « Mal trié » (avec commentaire et photo) ou « Non applicable » pour chaque déchet, et bouton **TOUT envoyer**.
- **Historique** : filtres (période, magasin, palier, agent, statut, dates, recherche), statistiques, export CSV, export des mal triés en PDF et en Excel.
- **Tableau de bord** : courbe hebdomadaire du taux de tri de chaque palier (8 à 52 semaines), hausse ▲ ou baisse ▼ par rapport à la semaine précédente, choix des courbes à afficher (une seule, deux, trois… ou la moyenne « Tous paliers ») pour comparer, filtres par agent et par poubelle, tableau semaine par semaine et export Excel.
- **Analyse par étage** : taux de respect du tri d'une poubelle précise sur un étage précis (ex. Rolls cartons, Provence, Étage 3), sur les dates de ton choix (7 ou 30 derniers jours, mois dernier, 3 derniers mois… ou dates libres), avec sa courbe semaine par semaine ; taux de tri de chaque poubelle pour chaque étage, avec un tableau de tous les étages et le détail de l'étage choisi (barres par catégorie, derniers mal triés), plus un export Excel. Taux de tri = bien triés ÷ (bien triés + mal triés).
- **Supervision** : calendrier mensuel, avec une pastille pour le matin et une pour l'après-midi, et un taux de réalisation.

## Comptes et accès

Il faut se connecter avec un identifiant et un mot de passe. Il y a quatre rôles :

| Rôle | Accès |
|---|---|
| **Administrateur** | Tout : contrôle, suivi, supervision, exports, gestion des comptes, données de démo, effacement de l'historique |
| **Responsable** | Tout (paliers, Historique, Tableau de bord, Analyse, Supervision, exports, données de démo), sauf l'**effacement des données** et l'onglet **Comptes** |
| **Superviseur** | L'interface des paliers, et la consultation des données envoyées par les agents : Historique, Tableau de bord, Analyse par étage, exports. Pas de Supervision, pas de Comptes, pas de données de démo ni d'effacement |
| **Agent** | Uniquement la saisie des contrôles par palier (aucun accès au Suivi) |

Compte de départ : identifiant **Admin**, avec tous les droits.

**Ajouter ou modifier un compte (administrateur uniquement) :** connecte-toi en Admin, puis va dans **Suivi → 👥 Comptes**. Ajoute ou modifie les comptes, clique sur **Copier le bloc**, puis colle-le à la place du bloc `comptes: [ … ],` dans `js/config.js` sur GitHub (avec le crayon ✏️, puis **Commit changes**). Les mots de passe ne sont jamais écrits en clair : seule une empreinte chiffrée (SHA-256 avec sel) est enregistrée.

À savoir : la connexion se fait dans le navigateur. Elle empêche l'accès normal à l'appli, mais ce n'est pas une sécurité de niveau bancaire. Choisis des mots de passe longs et différents de tes autres mots de passe.

## Mettre l'appli en ligne avec GitHub Pages

1. Sur github.com, clique sur **+** (en haut à droite), puis **New repository**.
2. Donne-lui un nom (par ex. `tri-selectif`), laisse-le **Public** et clique sur **Create repository**.
3. Sur la page du dépôt vide, clique sur **uploading an existing file**.
4. Glisse **tout le contenu** du dossier dézippé (`index.html`, `README.md` et les dossiers `css` et `js`), puis clique sur **Commit changes**.
5. Va dans **Settings → Pages**. Sous « Branch », choisis `main` et `/ (root)`, puis clique sur **Save**.
6. Après une à deux minutes, l'appli est en ligne à `https://TON-PSEUDO.github.io/tri-selectif/`.

## Adapter à ton site

Tout se règle dans **`js/config.js`** : le nom de l'organisation, les magasins, les paliers, les étages, les types de déchets, et les poubelles en plus sur certains étages seulement (`dechetsSupplementaires`). Pour modifier ce fichier sur GitHub, ouvre-le, clique sur le crayon ✏️, puis sur **Commit changes**.

## Où sont stockées les données ?

Elles sont enregistrées dans le navigateur de chaque appareil (localStorage). Chaque téléphone ou ordinateur a donc son propre historique, et vider les données du navigateur l'efface. Pense à exporter régulièrement en CSV.

Pour partager un historique commun entre plusieurs agents, il faut brancher une base de données en ligne (par exemple Supabase ou Firebase). L'appli est prévue pour ça : seul le bloc « Stockage » de `js/app.js` est à remplacer.
