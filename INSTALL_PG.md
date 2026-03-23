# Installation du client PostgreSQL

## Commande d'installation

```bash
npm install pg
npm install --save-dev @types/pg
```

## Ce qui sera installe

- `pg` : client PostgreSQL pour Node.js
- `@types/pg` : types TypeScript pour `pg`

## Configuration requise

Apres l'installation, ajoutez ces variables dans `.env` :

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter
POSTGRES_PASSWORD=votre_mot_de_passe_securise
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_SSL=false
```

## Migration de la base

Le schema et les migrations ne sont plus appliques automatiquement au demarrage du serveur web.

Hors Docker :
```bash
npm run migrate
```

Windows :
```batch
migrate-server.bat
```

Docker / conteneur :
```bash
npm run docker-migrate
```

Windows :
```batch
docker-migrate.bat
```

Le runner applique :
- `docker/schema.sql` si la base est vide (`docker/init-db.sql` ne fait plus que relayer ce schema)
- les migrations SQL en attente dans `docker/migrations/`
- les migrations applicatives et seeds idempotents restants

Relancez la migration apres chaque mise a jour de code ou de schema.


Hors Docker, `npm run migrate` applique automatiquement `docker/schema.sql` si la base est vide, puis les migrations SQL/applicatives restantes.
