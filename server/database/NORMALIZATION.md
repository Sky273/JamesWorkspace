# Normalisation PostgreSQL - Bonnes pratiques appliquées

## 📋 Résumé des changements

Le script SQL a été normalisé selon les **bonnes pratiques PostgreSQL** pour garantir cohérence, maintenabilité et compatibilité.

## ✅ Changements appliqués

### 1. **Noms de tables** - ✅ Déjà conformes
Tous les noms de tables utilisent **snake_case** en minuscules :
- `customers`
- `users`
- `llm_settings`
- `templates`
- `resumes`
- `missions`
- `resume_adaptations`
- `rome_metiers`
- `industry_aliases`
- `market_facts`
- `market_trends`

### 2. **Noms de colonnes** - ✅ Déjà conformes
Tous les noms de colonnes utilisent **snake_case** en minuscules :
- `customer_id`, `customer_name`
- `created_at`, `updated_at`, `last_login`
- `resume_file_url`, `resume_file_size`, `resume_file_type`
- `skills_cleaned`, `industries_cleaned`
- `code_rome`, `rome_label`, `region_code`
- etc.

### 3. **Valeurs ENUM** - ✅ Normalisées en lowercase

#### **Avant** (PascalCase/CamelCase)
```sql
status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'))
role VARCHAR(50) DEFAULT 'User' CHECK (role IN ('Admin', 'User'))
provider VARCHAR(50) CHECK (provider IN ('OpenAI', 'Anthropic'))
source VARCHAR(50) CHECK (source IN ('FranceTravail', 'Adzuna'))
```

#### **Après** (lowercase)
```sql
status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user'))
provider VARCHAR(50) CHECK (provider IN ('openai', 'anthropic'))
source VARCHAR(50) CHECK (source IN ('france_travail', 'adzuna'))
```

### 4. **Suppression de redondance** - ✅ Corrigé
Suppression du champ `last_updated` dans `templates` (redondant avec `updated_at`)

#### **Avant**
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

#### **Après**
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

### 5. **Noms d'indexes** - ✅ Déjà conformes
Format standardisé : `idx_{table}_{column(s)}`
```sql
idx_customers_name
idx_users_email
idx_resumes_customer_id
idx_market_trends_type
```

### 6. **Noms de vues** - ✅ Déjà conformes
Préfixe `v_` pour identifier les vues :
```sql
v_active_resumes
v_active_missions
v_adaptations_full
```

## 📊 Tableau récapitulatif des valeurs ENUM normalisées

| Table | Colonne | Anciennes valeurs | Nouvelles valeurs |
|-------|---------|-------------------|-------------------|
| `customers` | `status` | Active, Inactive | active, inactive |
| `users` | `role` | Admin, User | admin, user |
| `users` | `status` | Active, Inactive | active, inactive |
| `llm_settings` | `provider` | OpenAI, Anthropic | openai, anthropic |
| `llm_settings` | `status` | Active, Inactive | active, inactive |
| `templates` | `status` | Active, Inactive | active, inactive |
| `resumes` | `status` | Active, Inactive, Archived | active, inactive, archived |
| `missions` | `status` | Active, Inactive, Closed | active, inactive, closed |
| `resume_adaptations` | `status` | Draft, Final, Sent, Archived | draft, final, sent, archived |
| `market_facts` | `source` | FranceTravail, Adzuna | france_travail, adzuna |

## 🎯 Bonnes pratiques PostgreSQL appliquées

### ✅ Conventions de nommage
- **Tables** : `snake_case`, pluriel (ex: `customers`, `users`)
- **Colonnes** : `snake_case` (ex: `customer_id`, `created_at`)
- **Indexes** : `idx_{table}_{column}` (ex: `idx_users_email`)
- **Contraintes** : Noms générés automatiquement par PostgreSQL
- **Vues** : Préfixe `v_` (ex: `v_active_resumes`)
- **Fonctions** : `snake_case` (ex: `update_updated_at_column`)

### ✅ Types de données
- **IDs** : `UUID` avec `uuid_generate_v4()`
- **Timestamps** : `TIMESTAMP WITH TIME ZONE` (timezone-aware)
- **JSON** : `JSONB` (binaire, indexable, performant)
- **Arrays** : `TEXT[]` pour listes simples
- **Énumérations** : `VARCHAR` avec `CHECK` constraint (plus flexible que `ENUM`)

### ✅ Contraintes
- **PRIMARY KEY** : Sur tous les `id`
- **FOREIGN KEY** : Avec `ON DELETE CASCADE` ou `SET NULL` selon le cas
- **UNIQUE** : Sur colonnes uniques (email, name, code_rome)
- **CHECK** : Pour valider les énumérations et ranges
- **NOT NULL** : Sur champs obligatoires

### ✅ Indexes
- **B-tree** : Pour recherches exactes et tri
- **GIN** : Pour JSONB et arrays (recherche dans structures)
- **Partial indexes** : Dans les vues (ex: `WHERE status = 'active'`)

### ✅ Triggers
- Fonction `update_updated_at_column()` pour auto-update de `updated_at`
- Appliqué sur toutes les tables avec `updated_at`

## 🔄 Impact sur le code applicatif

### Changements nécessaires dans le code

#### **1. Valeurs de statut**
```javascript
// ❌ AVANT
if (user.status === 'Active') { ... }
if (user.role === 'Admin') { ... }

// ✅ APRÈS
if (user.status === 'active') { ... }
if (user.role === 'admin') { ... }
```

#### **2. Valeurs de provider**
```javascript
// ❌ AVANT
provider: 'OpenAI'
provider: 'Anthropic'

// ✅ APRÈS
provider: 'openai'
provider: 'anthropic'
```

#### **3. Valeurs de source**
```javascript
// ❌ AVANT
source: 'FranceTravail'
source: 'Adzuna'

// ✅ APRÈS
source: 'france_travail'
source: 'adzuna'
```

#### **4. Suppression de last_updated**
```javascript
// ❌ AVANT (templates)
lastUpdated: record.fields.LastUpdated

// ✅ APRÈS
updatedAt: record.updated_at
```

## 📝 Avantages de la normalisation

### 1. **Cohérence**
- Toutes les valeurs suivent le même pattern (lowercase, snake_case)
- Évite les erreurs de casse (Active vs active vs ACTIVE)

### 2. **Compatibilité**
- Standard PostgreSQL et SQL en général
- Compatible avec la plupart des ORMs (Prisma, TypeORM, Sequelize)
- Facilite les migrations depuis/vers d'autres bases

### 3. **Maintenabilité**
- Code plus lisible et prévisible
- Moins de bugs liés à la casse
- Facilite le travail en équipe

### 4. **Performance**
- Les comparaisons de chaînes en lowercase sont légèrement plus rapides
- Pas besoin de `LOWER()` dans les requêtes

### 5. **Internationalisation**
- Évite les problèmes de collation (tri alphabétique)
- Fonctionne correctement avec tous les locales

## ⚠️ Points d'attention

### Migration des données existantes
Si des données existent déjà dans Airtable avec les anciennes valeurs (PascalCase), il faudra les convertir lors de la migration :

```sql
-- Exemple de conversion lors de la migration
UPDATE users SET 
    status = LOWER(status),
    role = LOWER(role);

UPDATE llm_settings SET
    provider = LOWER(provider),
    status = LOWER(status);

-- etc.
```

### Compatibilité avec le code existant
Le code applicatif devra être mis à jour pour utiliser les nouvelles valeurs lowercase. Utiliser une recherche/remplacement globale :

```bash
# Rechercher et remplacer dans tout le projet
'Active' → 'active'
'Inactive' → 'inactive'
'Admin' → 'admin'
'User' → 'user'
'OpenAI' → 'openai'
'Anthropic' → 'anthropic'
'FranceTravail' → 'france_travail'
'Adzuna' → 'adzuna'
```

## ✅ Checklist de validation

- [x] Tous les noms de tables en snake_case
- [x] Tous les noms de colonnes en snake_case
- [x] Toutes les valeurs ENUM en lowercase
- [x] Suppression des redondances (last_updated)
- [x] Indexes nommés selon convention
- [x] Vues préfixées par v_
- [x] Contraintes CHECK avec valeurs lowercase
- [x] Documentation mise à jour

## 🎯 Conclusion

Le script PostgreSQL est maintenant **100% conforme** aux bonnes pratiques de nommage et de normalisation. Cette normalisation garantit :

- ✅ **Cohérence** dans toute la base
- ✅ **Maintenabilité** à long terme
- ✅ **Compatibilité** avec les outils standards
- ✅ **Performance** optimale
- ✅ **Lisibilité** du code SQL

La migration Airtable → PostgreSQL est prête pour la phase 2 (migration du code applicatif).
