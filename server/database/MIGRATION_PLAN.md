# Plan de migration Airtable → PostgreSQL

## 📊 Vue d'ensemble

Migration progressive de l'application ResumeConverter d'Airtable vers PostgreSQL.

## ✅ Étapes de migration

### Phase 1 : Infrastructure ⏳
- [ ] **1.1** Installer le client PostgreSQL (`pg`)
- [ ] **1.2** Créer la configuration de connexion
- [ ] **1.3** Créer le service de base de données PostgreSQL
- [ ] **1.4** Créer les helpers de requêtes

### Phase 2 : Services de base 🔜
- [ ] **2.1** Migrer `customers` (table simple, pas de dépendances)
- [ ] **2.2** Migrer `llm_settings` (table simple)
- [ ] **2.3** Migrer `templates` (table simple)
- [ ] **2.4** Migrer `users` (dépend de customers)

### Phase 3 : Authentification 🔜
- [ ] **3.1** Adapter `auth.routes.js` pour PostgreSQL
- [ ] **3.2** Adapter `jwt.service.js`
- [ ] **3.3** Tester le login/logout

### Phase 4 : Services métier 🔜
- [ ] **4.1** Migrer `resumes` (complexe, JSONB)
- [ ] **4.2** Migrer `missions`
- [ ] **4.3** Migrer `resume_adaptations` (dépend de resumes + missions)
- [ ] **4.4** Migrer `tags.routes.js`

### Phase 5 : Services de marché 🔜
- [ ] **5.1** Migrer `rome_metiers`
- [ ] **5.2** Migrer `industry_aliases`
- [ ] **5.3** Migrer `market_facts`
- [ ] **5.4** Migrer `market_trends` (JSONB complexe)

### Phase 6 : Tests et validation 🔜
- [ ] **6.1** Tests unitaires des services
- [ ] **6.2** Tests d'intégration
- [ ] **6.3** Migration des données Airtable → PostgreSQL
- [ ] **6.4** Tests end-to-end

## 📝 Fichiers à modifier

### Configuration
- `package.json` - Ajouter `pg`
- `src/config/database.js` - **NOUVEAU** Configuration PostgreSQL
- `src/config/constants.js` - Mettre à jour pour PostgreSQL
- `.env` - Ajouter variables PostgreSQL

### Services à créer
- `src/services/database.service.js` - **NOUVEAU** Service PostgreSQL
- `src/utils/postgresHelpers.js` - **NOUVEAU** Helpers PostgreSQL

### Services à migrer (27 fichiers)
- `src/routes/auth.routes.js`
- `src/routes/customers.routes.js`
- `src/routes/users.routes.js`
- `src/routes/llm.routes.js`
- `src/routes/settings.routes.js`
- `src/routes/templates.routes.js`
- `src/routes/resumes.routes.js`
- `src/routes/missions.routes.js`
- `src/routes/adaptations.routes.js`
- `src/routes/tags.routes.js`
- `src/routes/rome.routes.js`
- `src/routes/admin.routes.js`
- `src/routes/health.routes.js`
- `src/services/settings.service.js`
- `src/services/jwt.service.js`
- `src/services/profileMatching.service.js`
- `src/services/rome.service.js`
- `src/services/romeService.ts`
- `src/services/marketFacts.service.js`
- `src/services/marketTrends.service.js`
- `src/services/industry.service.js`
- `src/services/openai.service.js`
- `src/utils/pagination.js`
- `src/utils/pagination.ts`

### Fichiers à supprimer (après migration)
- `src/config/airtable.js`
- `src/utils/airtableHelpers.js`

## 🔄 Mapping Airtable → PostgreSQL

### Concepts clés

| Airtable | PostgreSQL | Notes |
|----------|------------|-------|
| `base(TABLE).select()` | `SELECT * FROM table` | Query builder → SQL |
| `base(TABLE).find(id)` | `SELECT * FROM table WHERE id = $1` | Parameterized |
| `base(TABLE).create([{fields}])` | `INSERT INTO table (...) VALUES (...)` | RETURNING * |
| `base(TABLE).update([{id, fields}])` | `UPDATE table SET ... WHERE id = $1` | RETURNING * |
| `base(TABLE).destroy([id])` | `DELETE FROM table WHERE id = $1` | - |
| `record.id` | `row.id` (UUID) | Format différent |
| `record.fields.Name` | `row.name` | snake_case |
| `filterByFormula` | `WHERE` clause | SQL natif |
| `sort` | `ORDER BY` | SQL natif |
| `maxRecords` | `LIMIT` | SQL natif |

### Champs JSON

| Airtable | PostgreSQL |
|----------|------------|
| `JSON.stringify(data)` | `data` (JSONB natif) |
| `JSON.parse(field)` | `field` (déjà objet) |
| Champ texte | Colonne JSONB |

### Valeurs ENUM

Toutes les valeurs sont maintenant en **lowercase** :
- `'Active'` → `'active'`
- `'Admin'` → `'admin'`
- `'OpenAI'` → `'openai'`

## 🛠️ Outils et bibliothèques

### Client PostgreSQL : `pg`
```bash
npm install pg
npm install --save-dev @types/pg
```

**Pourquoi `pg` plutôt que Prisma ?**
- ✅ Léger et rapide
- ✅ Contrôle total sur les requêtes SQL
- ✅ Pas de génération de schéma (on a déjà notre SQL)
- ✅ Compatible avec notre architecture existante
- ✅ Moins de refactoring nécessaire

### Alternative : Prisma
Si on veut un ORM complet plus tard :
```bash
npm install @prisma/client
npm install --save-dev prisma
```

## 📚 Ressources

- [node-postgres Documentation](https://node-postgres.com/)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)

## ⚠️ Points d'attention

### 1. Gestion des transactions
PostgreSQL supporte les transactions ACID. Utiliser pour les opérations critiques :
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... opérations
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### 2. Parameterized queries (sécurité)
Toujours utiliser des paramètres pour éviter les injections SQL :
```javascript
// ❌ DANGER
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ SÉCURISÉ
await pool.query('SELECT * FROM users WHERE email = $1', [email]);
```

### 3. Pool de connexions
Utiliser un pool pour gérer les connexions efficacement :
```javascript
const pool = new Pool({
  max: 20, // maximum de connexions
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 4. Gestion des erreurs
PostgreSQL a des codes d'erreur spécifiques :
- `23505` : Violation de contrainte UNIQUE
- `23503` : Violation de contrainte FOREIGN KEY
- `23502` : Violation de contrainte NOT NULL

### 5. JSONB vs JSON
Utiliser **JSONB** (binaire) plutôt que JSON :
- ✅ Indexable
- ✅ Plus rapide pour les requêtes
- ✅ Supporte les opérateurs (`@>`, `?`, etc.)

## 🎯 Stratégie de migration

### Approche progressive
1. **Dual-write** : Écrire dans Airtable ET PostgreSQL
2. **Validation** : Comparer les données
3. **Bascule lecture** : Lire depuis PostgreSQL
4. **Nettoyage** : Supprimer le code Airtable

### Rollback
Garder le code Airtable commenté pendant 1-2 semaines après la migration.

## 📊 Progression

- [ ] Phase 1 : Infrastructure (0/4)
- [ ] Phase 2 : Services de base (0/4)
- [ ] Phase 3 : Authentification (0/3)
- [ ] Phase 4 : Services métier (0/4)
- [ ] Phase 5 : Services de marché (0/4)
- [ ] Phase 6 : Tests et validation (0/4)

**Total : 0/23 tâches complétées**

---

*Dernière mise à jour : 2026-02-04*
