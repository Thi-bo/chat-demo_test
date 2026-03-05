# NutritionTV – Chat & Appels (démo React)

Projet React pour tester le module **conversations** (messages en temps réel + appels audio/vidéo LiveKit) du backend Laravel.

## Prérequis

- Backend Laravel démarré (`php artisan serve` sur le port 8000)
- Migrations et queue : `php artisan migrate` et `php artisan queue:work`
- Pour le **temps réel** : Reverb (`BROADCAST_CONNECTION=reverb` + `php artisan reverb:start`)
- Pour les **appels** : LiveKit (Cloud ou Docker, voir docs backend)

## Installation

```bash
cd chat-demo
npm install
cp .env.example .env
```

## Configuration

Le fichier `.env` du **backend** doit contenir au minimum :

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (pour les appels)
- Si vous testez le temps réel : `BROADCAST_CONNECTION=reverb` et les variables `REVERB_*` (voir `php artisan reverb:install`)

Dans `chat-demo/.env` vous pouvez laisser les valeurs par défaut : le proxy Vite envoie `/api` et `/broadcasting` vers `http://localhost:8000`. Si votre API est ailleurs, définir `VITE_API_URL` (ex. `http://localhost:8000`).

## Lancer la démo

```bash


```

Ouvrir http://localhost:5173.

## Créer un utilisateur de test (backend)

Le login exige un email vérifié. En local vous pouvez créer un utilisateur en base et mettre `email_verified_at` à maintenant :

```bash
cd ..   # à la racine du projet Laravel
php artisan tinker
>>> $u = \App\Models\User::firstOrCreate(['email' => 'test@test.com'], ['name' => 'Test', 'password' => bcrypt('password')]);
>>> $u->email_verified_at = now(); $u->save();
>>> $u->uuid;
```

Utilisez ensuite `test@test.com` / `password` pour vous connecter dans la démo. Créez un 2ᵉ utilisateur pour tester les conversations et appels entre deux comptes.

## Utilisation

1. **Connexion**  
   Utilisez un compte existant (email + mot de passe).  
   Pour avoir un token (appels API, Reverb), la démo envoie `platform: 'mobile'` au login.

2. **Conversations**  
   - Liste des conversations.
   - « Nouvelle conversation directe » : entrez l’**UUID** d’un autre utilisateur (ou le vôtre pour tester avec 2 onglets).

3. **Messages**  
   - Cliquez sur une conversation.
   - Envoyez des messages. Avec Reverb activé, les messages s’affichent en temps réel dans l’autre onglet.

4. **Appel audio/vidéo**  
   - Dans une conversation, cliquez sur **« Appel audio / vidéo »**.
   - Autorisez micro/caméra.
   - Pour tester à 2 : ouvrez la même conversation dans un 2ᵉ navigateur (ou fenêtre privée), connectez-vous avec un autre compte, puis lancez l’appel depuis les deux côtés.

## Test rapide sans Reverb

- L’API fonctionne : conversations, envoi de messages, token LiveKit.
- Les messages n’arrivent pas en temps réel (pas de WebSocket) ; rechargez la page pour voir les nouveaux messages.

## Test avec Reverb (temps réel)

1. Backend : `composer require laravel/reverb` puis `php artisan reverb:install`, configurer `.env` et lancer `php artisan reverb:start` + `php artisan queue:work`.
2. Frontend : dans `chat-demo/.env`, laisser ou adapter `VITE_REVERB_*` pour pointer vers le serveur Reverb (par défaut `localhost:8080`).
3. Les nouveaux messages s’affichent immédiatement dans les onglets abonnés à la conversation.
