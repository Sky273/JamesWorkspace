# Guide d'utilisation du script PostgreSQL

## 📋 Vue d'ensemble

Le script `init_postgresql.sql` est maintenant :
- ✅ **100% SQL standard** sans caractères spéciaux ni commandes spécifiques à psql
- ✅ **Idempotent** : peut être relancé plusieurs fois sans erreur
- ✅ **Sécurisé** : supprime et recrée tous les objets automatiquement

## ✅ Changements appliqués

### **Supprimé**
- ❌ Commande `\c resumeconverter` (connexion psql)
- ❌ Bloc `DO $$` avec emojis et caractères spéciaux
- ❌ Commandes `DROP DATABASE` et `CREATE DATABASE` (commentées)

### **Résultat**
- ✅ Script SQL pur, compatible avec tous les clients PostgreSQL
- ✅ Peut être exécuté via psql, pgAdmin, DBeaver, DataGrip, etc.
- ✅ Compatible avec les outils d'automatisation et CI/CD

## 🚀 Méthodes d'exécution

### **Méthode 1 : Ligne de commande (Recommandé)**

```bash
# 1. Créer la base de données
psql -U postgres -c "CREATE DATABASE resumeconverter WITH ENCODING = 'UTF8';"

# 2. Exécuter le script
psql -U postgres -d resumeconverter -f database/init_postgresql.sql
```

### **Méthode 2 : En une seule commande**

```bash
# Créer la base ET exécuter le script
psql -U postgres << EOF
CREATE DATABASE resumeconverter WITH ENCODING = 'UTF8';
\c resumeconverter
\i database/init_postgresql.sql
EOF
```

### **Méthode 3 : pgAdmin (Interface graphique)**

1. Ouvrir pgAdmin
2. Créer une nouvelle base de données : `resumeconverter`
3. Clic droit sur la base → **Query Tool**
4. Ouvrir le fichier `init_postgresql.sql`
5. Cliquer sur **Execute** (F5)

### **Méthode 4 : DBeaver / DataGrip**

1. Créer une connexion PostgreSQL
2. Créer une nouvelle base : `resumeconverter`
3. Ouvrir `init_postgresql.sql`
4. Exécuter le script (Ctrl+Enter ou bouton Execute)

### **Méthode 5 : Docker PostgreSQL**

```bash
# Démarrer PostgreSQL dans Docker
docker run --name postgres-resumeconverter \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:15

# Créer la base
docker exec -it postgres-resumeconverter \
  psql -U postgres -c "CREATE DATABASE resumeconverter;"

# Exécuter le script
docker exec -i postgres-resumeconverter \
  psql -U postgres -d resumeconverter < database/init_postgresql.sql
```

### **Méthode 6 : Node.js (Programmation)**

```javascript
const { Client } = require('pg');
const fs = require('fs');

async function initDatabase() {
    // Connexion pour créer la base
    const adminClient = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'yourpassword',
        database: 'postgres'
    });
    
    await adminClient.connect();
    await adminClient.query('CREATE DATABASE resumeconverter');
    await adminClient.end();
    
    // Connexion à la nouvelle base
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'yourpassword',
        database: 'resumeconverter'
    });
    
    await client.connect();
    
    // Exécuter le script
    const sql = fs.readFileSync('database/init_postgresql.sql', 'utf8');
    await client.query(sql);
    
    await client.end();
    console.log('✅ Database initialized successfully!');
}

initDatabase().catch(console.error);
```

## 🔧 Configuration post-installation

### **1. Créer l'utilisateur applicatif**

```sql
-- Créer l'utilisateur
CREATE USER resumeconverter_app WITH PASSWORD 'votre_mot_de_passe_securise';

-- Donner les permissions
GRANT CONNECT ON DATABASE resumeconverter TO resumeconverter_app;
GRANT USAGE ON SCHEMA public TO resumeconverter_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resumeconverter_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resumeconverter_app;

-- Pour les futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resumeconverter_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO resumeconverter_app;
```

### **2. Configurer les variables d'environnement**

Créer ou mettre à jour le fichier `.env` :

```env
# PostgreSQL Configuration
DATABASE_URL=postgresql://resumeconverter_app:password@localhost:5432/resumeconverter
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter_app
POSTGRES_PASSWORD=votre_mot_de_passe_securise

# SSL (production)
POSTGRES_SSL=true
```

### **3. Tester la connexion**

```bash
# Test avec psql
psql -U resumeconverter_app -d resumeconverter -c "SELECT COUNT(*) FROM customers;"

# Test avec Node.js
node -e "
const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
    console.log('✅ Connected successfully!');
    return client.query('SELECT version()');
}).then(res => {
    console.log('PostgreSQL version:', res.rows[0].version);
    return client.end();
}).catch(console.error);
"
```

## 📊 Vérification de l'installation

### **Vérifier les tables créées**

```sql
-- Lister toutes les tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Résultat attendu : 11 tables
-- customers, users, llm_settings, templates, resumes, missions,
-- resume_adaptations, rome_metiers, industry_aliases, market_facts, market_trends
```

### **Vérifier les indexes**

```sql
-- Compter les indexes
SELECT COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public';

-- Résultat attendu : 50+ indexes
```

### **Vérifier les triggers**

```sql
-- Lister les triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Résultat attendu : 10 triggers (update_*_updated_at)
```

### **Vérifier les vues**

```sql
-- Lister les vues
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';

-- Résultat attendu : 3 vues
-- v_active_resumes, v_active_missions, v_adaptations_full
```

### **Vérifier les extensions**

```sql
-- Lister les extensions installées
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pg_trgm');

-- Résultat attendu : 2 extensions
```

## ⚠️ Troubleshooting

### **Erreur : "database already exists"**

```sql
-- Supprimer la base existante (ATTENTION : perte de données)
DROP DATABASE IF EXISTS resumeconverter;

-- Puis recréer
CREATE DATABASE resumeconverter WITH ENCODING = 'UTF8';
```

### **Erreur : "extension does not exist"**

```sql
-- Installer les extensions (nécessite superuser)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### **Erreur : "permission denied"**

```bash
# Se connecter en tant que superuser
psql -U postgres -d resumeconverter -f database/init_postgresql.sql
```

### **Erreur : "relation already exists"**

✅ **Ce problème n'existe plus !** Le script est maintenant idempotent et supprime automatiquement tous les objets existants avant de les recréer. Vous pouvez le relancer autant de fois que nécessaire.

## 🔄 Réinitialisation complète

```sql
-- ATTENTION : Supprime toutes les données !

-- Supprimer toutes les tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Redonner les permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Puis ré-exécuter le script
\i database/init_postgresql.sql
```

## 📝 Prochaines étapes

Après l'initialisation de la base :

1. ✅ **Base créée** - Tables, indexes, triggers, vues
2. ⏳ **Créer l'utilisateur applicatif** - Voir section "Configuration post-installation"
3. ⏳ **Configurer .env** - Variables d'environnement
4. ⏳ **Migrer les données** - Script ETL Airtable → PostgreSQL
5. ⏳ **Adapter le code** - Remplacer Airtable SDK par client PostgreSQL
6. ⏳ **Tester** - Validation complète de l'application

## 📚 Ressources

- [Documentation PostgreSQL](https://www.postgresql.org/docs/)
- [node-postgres (pg)](https://node-postgres.com/)
- [Prisma ORM](https://www.prisma.io/docs)
- [pgAdmin](https://www.pgadmin.org/)
- [DBeaver](https://dbeaver.io/)

## 🎯 Résumé

Le script `init_postgresql.sql` est maintenant :
- ✅ Sans caractères spéciaux
- ✅ Sans commandes psql spécifiques (`\c`)
- ✅ Compatible avec tous les clients PostgreSQL
- ✅ Prêt pour l'automatisation et CI/CD
- ✅ Facile à exécuter et à maintenir
