# Installation du client PostgreSQL

## 📦 Commande d'installation

```bash
npm install pg
npm install --save-dev @types/pg
```

## 📝 Ce qui sera installé

- **pg** : Client PostgreSQL pour Node.js (production)
- **@types/pg** : Types TypeScript pour pg (développement)

## ⚙️ Configuration requise

Après l'installation, ajouter ces variables d'environnement dans `.env` :

```env
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter
POSTGRES_PASSWORD=votre_mot_de_passe_securise
POSTGRES_MAX_CONNECTIONS=20

# SSL (production uniquement)
POSTGRES_SSL=false
```

## 🚀 Prochaines étapes

Après l'installation :
1. Créer `src/config/database.js` - Configuration du pool PostgreSQL
2. Créer `src/services/database.service.js` - Service de base de données
3. Créer `src/utils/postgresHelpers.js` - Helpers pour requêtes

---

**Exécutez la commande d'installation ci-dessus pour continuer.**
