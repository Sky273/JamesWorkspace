# Migration Airtable → PostgreSQL

## Vue d'ensemble

Ce document décrit la migration de la base de données ResumeConverter d'Airtable vers PostgreSQL.

## 📊 Tables créées

### 1. **customers** - Organisations clientes
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE)
- `status` (Active/Inactive)
- Timestamps: `created_at`, `updated_at`

### 2. **users** - Comptes utilisateurs
- `id` (UUID, PK)
- `email` (VARCHAR, UNIQUE)
- `password` (VARCHAR, hashed)
- `name`, `role` (Admin/User), `status`
- `customer_id` (FK → customers)
- `customer_name` (dénormalisé)
- Timestamps: `created_at`, `updated_at`, `last_login`

### 3. **llm_settings** - Configuration LLM
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE)
- `provider` (OpenAI/Anthropic)
- `model`, `temperature`, `max_tokens`
- `system_prompt`, `user_prompt_template`
- `use_case` (analysis/improvement/adaptation)
- `status`

### 4. **templates** - Templates de CV
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE)
- `description`, `popular`, `status`
- `tags` (TEXT[])
- `preview_image_url`
- `header_content`, `template_content`, `footer_content`
- `footer_height`, `stylesheet`

### 5. **resumes** - CVs et analyses
- `id` (UUID, PK)
- `name`, `title`, `file_name`
- `resume_file_url`, `resume_file_size`, `resume_file_type`
- `status`, `customer_id` (FK)
- **Tags originaux** (JSONB): `skills`, `industries`, `tools`, `soft_skills`
- **Tags nettoyés** (JSONB): `skills_cleaned`, `industries_cleaned`, etc.
- **Mappings ESCO** (JSONB): `skills_esco`, `industries_esco`, etc.
- `key_improvements`, `summary`, `experience_years`, `education_level`
- `certifications`, `languages` (JSONB)

### 6. **missions** - Offres d'emploi
- `id` (UUID, PK)
- `title`, `content`
- `customer_id` (FK), `customer`, `status`
- `keywords`, `required_skills`, `preferred_skills` (JSONB)

### 7. **resume_adaptations** - CVs adaptés
- `id` (UUID, PK)
- `resume_id` (FK → resumes)
- `mission_id` (FK → missions)
- `resume_name`, `mission_title` (dénormalisés)
- `customer_id` (FK), `customer`
- `adapted_text`, `adaptation_notes`
- `match_score` (0-100)
- `status` (Draft/Final/Sent/Archived)

### 8. **rome_metiers** - Classification ROME 4.0
- `id` (UUID, PK)
- `code_rome` (VARCHAR, UNIQUE)
- `libelle`, `code_ogr`, `libelle_ogr`
- `code_domaine_professionnel`, `libelle_domaine_professionnel`
- `code_grand_domaine`, `libelle_grand_domaine`
- `competences`, `savoir_faire`, `savoir_etre`, `contextes_travail` (JSONB)
- `raw_data` (JSONB)

### 9. **industry_aliases** - Alias secteurs
- `id` (UUID, PK)
- `canonical_name`, `alias`
- UNIQUE constraint sur (canonical_name, alias)

### 10. **market_facts** - Statistiques marché
- `id` (UUID, PK)
- `keyword`, `location`, `region`
- `source` (FranceTravail/Adzuna)
- `job_count`, `date`
- `metadata` (JSONB)
- UNIQUE constraint sur (keyword, location, source, date)

### 11. **market_trends** - Tendances marché
- `id` (UUID, PK)
- `type` (demandeur/offre/embauche/tension/salaire/dynamique)
- `code_rome`, `rome_label`
- `region`, `region_code`, `secteur`
- `date`, `value`, `value_label`
- `metadata` (JSONB) - **Contient les déclinaisons par sexe, âge, catégorie**
- UNIQUE constraint sur (type, code_rome, region_code)

## 🔍 Vues créées

### v_active_resumes
CVs actifs avec informations client complètes

### v_active_missions
Missions actives avec informations client complètes

### v_adaptations_full
Adaptations avec contexte complet (CV + mission + client)

## ⚡ Fonctionnalités

- **UUID** : Tous les IDs sont des UUID v4
- **Triggers** : `updated_at` automatiquement mis à jour
- **Indexes** : 50+ indexes pour performance optimale
  - B-tree pour recherches exactes
  - GIN pour JSONB et arrays
  - pg_trgm pour recherche floue
- **Contraintes** : CHECK constraints pour valeurs énumérées
- **Foreign Keys** : Relations avec CASCADE/SET NULL appropriés
- **JSONB** : Flexibilité pour données semi-structurées

## 📝 Différences clés Airtable → PostgreSQL

| Aspect | Airtable | PostgreSQL |
|--------|----------|------------|
| **IDs** | `rec...` strings | UUID v4 |
| **Arrays** | Champs multi-select | `TEXT[]` ou `JSONB` |
| **JSON** | Champs long text | `JSONB` natif |
| **Relations** | Linked records | Foreign Keys |
| **Timestamps** | Auto-générés | Triggers `updated_at` |
| **Recherche** | Formules | Indexes GIN + pg_trgm |
| **Fichiers** | Attachments | URLs externes |

## 🚀 Utilisation

### 1. Créer la base de données

Le script est maintenant **idempotent** : vous pouvez le relancer plusieurs fois sans erreur. Il supprime automatiquement tous les objets existants avant de les recréer.

```bash
# Première exécution ou ré-exécution - fonctionne dans les deux cas
psql -U postgres -d resumeconverter -f database/init_postgresql.sql
```

**⚠️ ATTENTION** : Le script supprime **toutes les données existantes** ! Utilisez avec précaution en production.

### 2. Créer l'utilisateur applicatif

```sql
CREATE USER resumeconverter_app WITH PASSWORD 'votre_mot_de_passe_securise';
GRANT CONNECT ON DATABASE resumeconverter TO resumeconverter_app;
GRANT USAGE ON SCHEMA public TO resumeconverter_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resumeconverter_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resumeconverter_app;
```

### 3. Configurer les variables d'environnement

```env
# PostgreSQL
DATABASE_URL=postgresql://resumeconverter_app:password@localhost:5432/resumeconverter
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter_app
POSTGRES_PASSWORD=votre_mot_de_passe_securise

# Airtable (à supprimer après migration)
# AIRTABLE_PAT=...
# AIRTABLE_BASE_ID=...
```

## 📦 Prochaines étapes

1. ✅ **Script SQL créé** - `init_postgresql.sql`
2. ⏳ **Migration du code** - Remplacer Airtable SDK par `pg` ou `Prisma`
3. ⏳ **Migration des données** - Script ETL Airtable → PostgreSQL
4. ⏳ **Tests** - Vérifier toutes les fonctionnalités
5. ⏳ **Déploiement** - Mise en production

## 🔧 Outils recommandés

### Option 1: pg (Node.js native)
```bash
npm install pg
```

### Option 2: Prisma (ORM moderne)
```bash
npm install @prisma/client
npx prisma init
```

### Option 3: Knex.js (Query builder)
```bash
npm install knex pg
```

## 📊 Mapping Airtable → PostgreSQL

| Table Airtable | Table PostgreSQL | Notes |
|----------------|------------------|-------|
| `Customers` | `customers` | ✅ Direct |
| `Users` | `users` | ✅ Direct + valeurs ENUM lowercase |
| `LLMSettings` | `llm_settings` | ✅ Direct + valeurs ENUM lowercase |
| `Templates` | `templates` | ✅ Direct + suppression `last_updated` |
| `Resumes` | `resumes` | ⚠️ Fichiers → URLs + ENUM lowercase |
| `Offers` | `missions` | ✅ Renommé + ENUM lowercase |
| `ResumeAdaptations` | `resume_adaptations` | ✅ Direct + ENUM lowercase |
| `RomeMetiers` | `rome_metiers` | ✅ Direct |
| `industry_aliases` | `industry_aliases` | ✅ Direct |
| `MarketFacts` | `market_facts` | ✅ Direct + ENUM lowercase |
| `MarketTrends` | `market_trends` | ✅ Direct |

## ⚠️ Points d'attention

### Fichiers attachés
Les fichiers Airtable (champ `Resume File`) doivent être :
1. Téléchargés depuis Airtable
2. Uploadés vers un stockage externe (S3, Cloudinary, etc.)
3. URLs stockées dans `resume_file_url`

### Champs JSON
Les champs stockés en JSON string dans Airtable (`Skills`, `Industries`, etc.) deviennent des colonnes JSONB natives.

### Relations
Les "Linked Records" Airtable deviennent des Foreign Keys avec contraintes d'intégrité.

### Valeurs ENUM normalisées
**IMPORTANT** : Toutes les valeurs énumérées sont maintenant en **lowercase** :
- `status`: `'active'`, `'inactive'`, `'archived'` (au lieu de `'Active'`, `'Inactive'`, etc.)
- `role`: `'admin'`, `'user'` (au lieu de `'Admin'`, `'User'`)
- `provider`: `'openai'`, `'anthropic'` (au lieu de `'OpenAI'`, `'Anthropic'`)
- `source`: `'france_travail'`, `'adzuna'` (au lieu de `'FranceTravail'`, `'Adzuna'`)

**Le code applicatif devra être mis à jour** pour utiliser ces nouvelles valeurs. Voir `database/NORMALIZATION.md` pour les détails.

### Performance
PostgreSQL nécessite des indexes explicites. Le script en crée 50+ pour couvrir les cas d'usage courants.

## 🎯 Avantages PostgreSQL

✅ **Performance** : Indexes optimisés, requêtes complexes rapides  
✅ **Coût** : Gratuit, pas de limite de records  
✅ **Flexibilité** : JSONB, full-text search, extensions  
✅ **Intégrité** : Foreign keys, transactions ACID  
✅ **Scalabilité** : Millions de records sans problème  
✅ **Backup** : pg_dump, réplication, PITR  
✅ **Sécurité** : Row-level security, encryption  

## 📞 Support

Pour toute question sur la migration, consultez :
- [Documentation PostgreSQL](https://www.postgresql.org/docs/)
- [Prisma Docs](https://www.prisma.io/docs)
- [node-postgres](https://node-postgres.com/)
