# NutritionTV – Chat demo (temps réel)

Démo frontend pour tester le chat et le temps réel (Laravel Reverb + Echo) en local.

## Prérequis

- Backend Laravel (NutritionTV-back) configuré avec Reverb et une base de données avec au moins un utilisateur.
- Node.js 18+.

## 1. Backend (.env)

Dans la racine du projet **backend** (`NutritionTV-back`), assure-toi d’avoir :

```env
BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=sync

REVERB_APP_ID=nutritiontv
REVERB_APP_KEY=local-key
REVERB_APP_SECRET=local-secret
REVERB_HOST=127.0.0.1
REVERB_PORT=8081
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8081
REVERB_SCHEME=http
```

- `QUEUE_CONNECTION=sync` : les événements broadcast sont envoyés tout de suite (pas besoin de `queue:work`).
- Si tu préfères `QUEUE_CONNECTION=database`, lance aussi : `php artisan queue:work`.

## 2. Démarrer le backend

```bash
# Depuis la racine du repo (NutritionTV-back)
php artisan serve
```

Dans un **second terminal** (si Reverb est utilisé) :

```bash
php artisan reverb:start
```

Reverb écoute sur `ws://127.0.0.1:8081`.

## 3. Chat-demo (.env)

Dans `chat-demo/.env` (déjà présent) :

```env
VITE_REVERB_APP_KEY=local-key
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8081
VITE_REVERB_SCHEME=http
```

Les clés doivent correspondre à celles du backend (surtout `REVERB_APP_KEY`).

## 4. Installer et lancer le frontend

```bash
cd chat-demo
npm install
npm run dev
```

Ouvre http://localhost:5173.

## 5. Tester

1. **Connexion**  
   Utilise un compte existant (email / mot de passe). La connexion se fait en **web** : le backend renvoie des cookies HTTP-only (plus sécurisé), utilisés pour l’API et pour l’auth des canaux Reverb (temps réel). Aucun token n’est exposé en JavaScript.

2. **Conversations**  
   La liste affiche les discussions de l’utilisateur. Si la liste est vide, crée une conversation via l’API (par exemple `POST /api/conversations/direct` avec `user_uuid` d’un autre utilisateur).

3. **Chat et temps réel**  
   Clique sur une conversation, envoie des messages.  
   - Les messages sont envoyés via l’API.  
   - Les nouveaux messages (y compris des autres participants) arrivent en temps réel via Reverb (événement `message.sent` sur le canal privé `conversation.{uuid}`).

## Dépannage

- **Pas de temps réel / auth canal refusée**  
  Connecte-toi bien depuis cette app (email / mot de passe). En mode web, les cookies sont envoyés automatiquement (proxy + `credentials: 'include'`). Vérifie que le backend et le front tournent bien (Reverb + queue ou `QUEUE_CONNECTION=sync`).

- **Reverb ne se connecte pas**  
  Vérifier que `php artisan reverb:start` tourne et que le port 8081 est libre. Vérifier que `VITE_REVERB_*` dans `chat-demo/.env` correspondent au backend.

- **CORS / 401 sur /broadcasting/auth**  
  Le proxy Vite envoie `/api` et `/broadcasting` vers `http://127.0.0.1:8000`. Vérifier que le backend autorise les requêtes (CORS et `config/cors.php` avec `broadcasting/auth`).

- **Messages pas en temps réel**  
  Vérifier `BROADCAST_CONNECTION=reverb` et que Reverb est démarré. Si `QUEUE_CONNECTION=database`, lancer `php artisan queue:work`.
