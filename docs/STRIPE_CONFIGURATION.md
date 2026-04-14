# Configuration Stripe

Cette documentation couvre la mise en place du paiement Stripe pour l'achat de crédits cabinet depuis l'écran `Administration > Crédits cabinet`, réservé aux `administrateurs locaux`.

## Portée

Le flux implémenté dans le projet est le suivant :

1. le `localAdmin` ouvre l'écran `Crédits cabinet`
2. il choisit un pack de crédits
3. le backend crée une `Checkout Session` Stripe
4. Stripe héberge le paiement
5. Stripe appelle le webhook backend après paiement
6. le backend crédite le cabinet uniquement après confirmation du paiement

Le retour navigateur seul ne crédite jamais le cabinet.

## Fichiers concernés

- Frontend : [client/src/pages/FirmCreditsPage.tsx](C:/Users/mail/CascadeProjects/ResumeConverter/client/src/pages/FirmCreditsPage.tsx:1)
- Service frontend : [client/src/utils/userService.ts](C:/Users/mail/CascadeProjects/ResumeConverter/client/src/utils/userService.ts:1)
- Config Stripe : [server/config/stripe.js](C:/Users/mail/CascadeProjects/ResumeConverter/server/config/stripe.js:1)
- Service métier Stripe : [server/services/stripeBilling.service.js](C:/Users/mail/CascadeProjects/ResumeConverter/server/services/stripeBilling.service.js:1)
- Routes API : [server/routes/billing.routes.js](C:/Users/mail/CascadeProjects/ResumeConverter/server/routes/billing.routes.js:1)
- Webhook Stripe : [server/routes/stripeWebhook.routes.js](C:/Users/mail/CascadeProjects/ResumeConverter/server/routes/stripeWebhook.routes.js:1)
- Migration SQL : [docker/migrations/add_firm_credit_purchases.sql](C:/Users/mail/CascadeProjects/ResumeConverter/docker/migrations/add_firm_credit_purchases.sql:1)

## Variables d'environnement

Ajoutez ces variables dans votre `.env` backend :

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CURRENCY=eur
FRONTEND_URL=http://localhost:5173
```

Optionnel :

```env
STRIPE_CREDIT_PACKS_JSON=[{"id":"starter","name":"Starter","credits":250,"priceCents":2900,"description":"Pour les besoins ponctuels du cabinet."},{"id":"growth","name":"Growth","credits":750,"priceCents":7900,"description":"Le meilleur rapport volume / prix."},{"id":"scale","name":"Scale","credits":2000,"priceCents":19900,"description":"Pour les usages soutenus et les equipes actives."}]
```

## Packs de crédits

Si `STRIPE_CREDIT_PACKS_JSON` n'est pas défini, le backend utilise les packs par défaut :

- `starter` : `250` crédits pour `29,00 EUR`
- `growth` : `750` crédits pour `79,00 EUR`
- `scale` : `2000` crédits pour `199,00 EUR`

## Step by step

### 1. Créer le compte Stripe

1. Connectez-vous au dashboard Stripe.
2. Travaillez d'abord en mode `test`.
3. Récupérez la clé secrète `sk_test_...`.

### 2. Renseigner les variables backend

1. Ouvrez votre fichier `.env`.
2. Ajoutez `STRIPE_SECRET_KEY`.
3. Ajoutez `STRIPE_CURRENCY=eur`.
4. Vérifiez que `FRONTEND_URL` pointe bien vers l'URL publique du frontend utilisé pour les redirections Checkout.

### 3. Appliquer la migration base de données

Exécutez :

```bash
npm run migrate
```

### 4. Redémarrer le backend

```bash
npm run start:proxy
```

### 5. Créer le webhook Stripe

Créez un endpoint webhook dans Stripe :

- URL locale via Stripe CLI : `http://localhost:3001/api/billing/stripe/webhook`
- URL de production : `https://votre-domaine/api/billing/stripe/webhook`

Événements à écouter :

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`

Copiez ensuite le secret `whsec_...` fourni par Stripe dans :

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 6. Tester en local avec Stripe CLI

```bash
stripe login
stripe listen --forward-to http://localhost:3001/api/billing/stripe/webhook
```

### 7. Vérifier l'interface

1. Connectez-vous avec un utilisateur `localAdmin`.
2. Ouvrez `Administration > Crédits cabinet`.
3. Vérifiez que les packs Stripe s'affichent.

### 8. Effectuer un paiement de test

1. Cliquez sur un pack.
2. Vous devez être redirigé vers Stripe Checkout.
3. Utilisez une carte de test Stripe.
4. Finalisez le paiement.

### 9. Vérifier les données en base

Contrôles à faire :

- une ligne `firm_credit_purchases` avec `status = completed`
- `stripe_checkout_session_id` renseigné
- `stripe_payment_intent_id` renseigné
- une transaction de crédit dans `firm_credit_transactions`
- le solde `firms.credits` mis à jour

## Endpoints exposés

### Lire les packs

```http
GET /api/billing/stripe/credit-packs
```

### Créer une session Checkout

```http
POST /api/billing/stripe/checkout-session
Content-Type: application/json

{
  "packId": "starter"
}
```

### Webhook Stripe

```http
POST /api/billing/stripe/webhook
```

## Sécurité

- pas de crédit ajouté sur redirection navigateur
- crédit uniquement après `checkout.session.completed`
- vérification de signature webhook Stripe
- achat persisté en base avant création Checkout
- statut d'achat suivi : `pending`, `completed`, `expired`, `failed`

## Validation recommandée

```bash
npm run typecheck
npx vitest run client/src/pages/FirmCreditsPage.test.tsx --config client/vitest.config.ts
npx vitest run server/tests/routes/billing.routes.test.js server/tests/services/stripeBilling.service.test.js --config server/vitest.config.js
```

## Références Stripe

- [Checkout](https://docs.stripe.com/payments/checkout)
- [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create)
- [Webhook signature verification](https://docs.stripe.com/webhooks/signature)
