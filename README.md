# Jette là.

Version "vraie prod" de l'appli prototypée sur Claude Artifact — vraie carte (MapLibre GL + tuiles gratuites OpenFreeMap), vraie base de données partagée (Supabase), pensée pour tenir à l'échelle nationale (le prototype Artifact, lui, était limité à ~15 Mo de données embarquées dans une seule page : voir `cadrage-projet.md`, section "pilote multi-régions").

## Ce qui a changé par rapport au prototype

- **Carte** : rendu schématique SVG → vraie carte MapLibre GL (fond de carte [OpenFreeMap](https://openfreemap.org), gratuit, sans compte ni clé d'API) avec clustering (les points se regroupent visuellement en zoom arrière, essentiel dès qu'on dépasse quelques dizaines de milliers de points).
- **Données** : un seul bloc JSON embarqué dans la page → base Postgres (Supabase), interrogée par zone visible de la carte (plus de limite de taille de fichier).
- **Admin** : code en dur visible dans le HTML → vraie authentification (Supabase Auth), avec une table `admins` qui liste qui a les droits de modération.
- **Photos** : stockées en base64 dans les documents → vrai stockage de fichiers (Supabase Storage).
- **Temps réel** : conservé (signalements, propositions, votes se propagent toujours en direct entre utilisateurs).

Fonctionnalités **pas encore portées** depuis le prototype (à ajouter dans un prochain passage si besoin) : le panneau "Mon activité" (historique personnel), et le geocoding/recherche par ville hors zone visible de la carte.

> Note : le projet a d'abord été écrit avec Mapbox GL, qui demande d'enregistrer une carte bancaire dès l'inscription (même sur le palier gratuit). Remplacé par MapLibre GL + OpenFreeMap — même rendu, aucun compte ni carte bancaire nécessaire pour la carte.

## Mise en route, étape par étape

### 1. Créer un compte Supabase (base de données + authentification + stockage)
1. Va sur [supabase.com](https://supabase.com), crée un compte (gratuit pour démarrer, pas de carte bancaire requise).
2. Crée un nouveau projet (choisis une région proche, ex. Paris/Francfort/Irlande).
3. Une fois le projet prêt, va dans **SQL Editor** → **New query**, colle tout le contenu de `supabase/schema.sql` de ce dossier, et exécute (bouton "Run"). Ça crée toutes les tables, la sécurité (RLS), le stockage des photos et active le temps réel.
4. Va dans **Project Settings > API Keys** : note l'**URL** du projet (visible dans **Project Settings > General**, sous "Project ID" — l'URL est `https://<Project ID>.supabase.co`) et la clé **Publishable key** (`sb_publishable_...`) — tu en auras besoin à l'étape 3.
5. Note aussi la **Secret key** (`sb_secret_...`, même page) — à garder secrète, utilisée uniquement par le script d'import (étape 4), jamais côté navigateur/Vercel.

*(Supabase a renommé ses clés en 2026 : "Publishable key" remplace l'ancienne "anon key", "Secret key" remplace l'ancienne "service_role key" — elles fonctionnent exactement pareil.)*

### 2. Créer ton compte administrateur
1. Dans Supabase, va dans **Authentication > Users** → **Add user** → **Create new user**. Renseigne ton email et un mot de passe. Décoche "Send confirmation email" si tu veux pouvoir te connecter immédiatement.
2. Retourne dans **SQL Editor** et exécute (en remplaçant par ton email) :
   ```sql
   insert into admins (user_id)
   select id from auth.users where email = 'ton-email@exemple.fr';
   ```
   C'est cette table qui donne les droits de modération et de lecture des avis — sans cette ligne, ton compte peut se connecter mais l'espace admin restera vide/refusé.

### 3. Configurer le projet en local
```bash
cp .env.example .env.local
```
Remplis `.env.local` avec : l'URL et la clé publishable Supabase (étape 1.4), et la clé secrète Supabase (étape 1.5, pour le script d'import uniquement). Pas de clé nécessaire pour la carte.

```bash
npm install
npm run dev
```
Ouvre l'URL affichée (`http://localhost:5173` en général) — l'appli tourne en local, connectée à ta vraie base Supabase.

### 4. Importer les données (Normandie + Île-de-France déjà prêtes)
```bash
pip install requests
python3 scripts/import_data.py
```
Ce script relit `scripts/data/*_matched.json` (déjà généré à partir des mêmes exports Overpass que le prototype — 14 757 points Normandie + 41 090 points Île-de-France, soit 55 847 points au total) et les envoie dans la table `bins`. Pour ajouter d'autres régions plus tard : même méthode que dans `cadrage-projet.md` (export Overpass Turbo → rattachement aux communes officielles via `gregoiredavid/france-geojson` → nouveau fichier `scripts/data/<region>_matched.json`) puis relancer ce script.

### 5. Créer un compte GitHub et y déposer le code
1. Va sur [github.com](https://github.com), crée un compte (gratuit, pas de carte bancaire).
2. Crée un nouveau dépôt (bouton "New repository"), par exemple nommé `jette-la` — laisse-le vide (pas de README auto-généré).
3. Dépose le contenu de ce dossier dedans (soit via l'interface web "Add file > Upload files", soit en ligne de commande `git init && git add . && git commit -m "premier import" && git remote add origin <URL du dépôt> && git push -u origin main`).

### 6. Déployer (Vercel)
1. Va sur [vercel.com](https://vercel.com), connecte-toi avec ton compte GitHub, "Add New Project", sélectionne le dépôt `jette-la`.
2. Dans les réglages du projet Vercel, onglet **Environment Variables**, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (pas la clé secrète — elle ne doit jamais aller sur Vercel/le navigateur).
3. Déploie. Vercel te donne une URL `https://....vercel.app` fonctionnelle, gratuite.
4. Une fois prêt à commercialiser : passage au palier payant Vercel (~20$/mois) — voir `cadrage-projet.md` pour le détail des coûts. Le palier gratuit suffit pour tout le développement/test.

### 7. Réserver le nom de domaine (optionnel, pas urgent)
`jette-la.fr` était disponible au moment de la vérification (sept. 2026) — à réserver chez un registrar français (OVH, Gandi, ~10-15€/an) quand tu seras prêt·e. Pas nécessaire pour développer/tester : l'URL Vercel fonctionne très bien pour les premiers tests.

Une fois réservé : dans Vercel, **Project Settings > Domains**, ajoute `jette-la.fr`, puis suis les instructions pour pointer les DNS depuis ton registrar.

## Structure du projet

```
index.html              Page unique (SPA)
src/
  main.js                Point d'entrée, filtres, liste, tuto de bienvenue
  map.js                 Carte MapLibre GL + clustering + rafraîchissement par zone visible
  detail.js               Fiche détail d'un point (itinéraire, signalement, favoris, partage)
  addBin.js               Formulaire "proposer une poubelle manquante"
  feedback.js             Formulaire "Donner un avis"
  admin.js                Espace admin (connexion, avis reçus, modération)
  data.js                  Toutes les requêtes Supabase (lecture/écriture/temps réel)
  supabaseClient.js        Initialisation du client Supabase
  utils.js                 Favoris, cooldown anti-spam, compression photo, etc. (localStorage)
  style.css                Design (mêmes tokens de couleur que le prototype)
supabase/schema.sql        Schéma complet à exécuter une fois dans Supabase
scripts/
  import_data.py            Charge scripts/data/*_matched.json dans Supabase
  data/*_matched.json        Données déjà préparées (Normandie + Île-de-France)
```
