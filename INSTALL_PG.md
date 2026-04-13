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

# Au moins un provider LLM est requis pour l'analyse / l'amélioration
# OpenAI
OPENAI_API_KEY=sk-votre-cle-openai

# Anthropic
ANTHROPIC_API_KEY=sk-ant-votre-cle-anthropic
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# DeepSeek
DEEPSEEK_API_KEY=sk-votre-cle-deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Hugging Face
HUGGINGFACE_API_KEY=hf-votre-cle-huggingface
HUGGINGFACE_BASE_URL=https://router.huggingface.co/v1

# MiniMax
MINIMAX_API_KEY=sk-api-votre-cle-minimax
MINIMAX_OPENAI_BASE_URL=https://api.minimax.io/v1
MINIMAX_ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic

# Cache applicatif
CACHE_BACKEND=memory
CACHE_REDIS_URL=redis://127.0.0.1:6379
CACHE_KEY_PREFIX=resumeconverter

# Ollama distant uniquement
# ResumeConverter n'embarque pas Ollama localement dans le conteneur ou le serveur.
OLLAMA_BASE_URL=http://192.168.1.20:11434
OLLAMA_AUTO_PULL=true
OLLAMA_REQUEST_TIMEOUT_MS=300000
```

## Migration de la base

Le schéma et les migrations ne sont plus appliqués automatiquement au démarrage du serveur web.

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
- `docker/schema.sql` si la base est vide (`docker/init-db.sql` ne fait plus que relayer ce schéma)
- les migrations SQL en attente dans `docker/migrations/`
- les migrations applicatives et seeds idempotents restants

Relancez la migration après chaque mise à jour de code ou de schéma.


Hors Docker, `npm run migrate` applique automatiquement `docker/schema.sql` si la base est vide, puis les migrations SQL/applicatives restantes.

## Cache applicatif

### Paramètres

- `CACHE_BACKEND` : backend demandé (`memory` ou `redis`)
- `CACHE_REDIS_URL` : URL Redis quand `CACHE_BACKEND=redis`
- `CACHE_KEY_PREFIX` : préfixe des clés de cache partagées
- `DISABLE_INTERNAL_REDIS` : en Docker, désactive le Redis embarqué si vous pointez déjà vers un Redis externe

### Principe de fonctionnement

- Le cache applicatif est géré côté backend, au niveau des services.
- Les lectures partagées utilisent des scopes versionnés stockés en base et un cache L1 en mémoire locale.
- Redis peut être activé comme backend de stockage, mais l'invalidation reste pilotée par les versions de scope et les notifications PostgreSQL.
- Toute création, modification ou suppression invalide l'élément concerné, incrémente les vues impactées et force les autres instances à relire la source de vérité.
- Le paramètre `refresh=1` bypass explicitement le cache applicatif pour recharger une vue depuis la base.

## Notes LLM

- **OpenAI** : provider par défaut, recommandé pour les workflows GPT-5 / GPT-4o.
- **Anthropic** : activez le provider avec `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` permet de fixer un modèle par défaut côté serveur, par exemple `claude-sonnet-4-20250514` ou `claude-3-5-sonnet-20241022`.
- **DeepSeek** : activez le provider avec `DEEPSEEK_API_KEY`. `DEEPSEEK_BASE_URL` est optionnelle si vous utilisez l'endpoint officiel. L'intégration appelle actuellement DeepSeek-V3.2 via les identifiants `deepseek-chat` et `deepseek-reasoner`.
- **Hugging Face** : activez le provider avec `HUGGINGFACE_API_KEY`. `HUGGINGFACE_BASE_URL` est optionnelle et pointe par défaut vers `https://router.huggingface.co/v1`.
- **Modèle Hugging Face pris en charge** : `MiniMaxAI/MiniMax-M2.7`, avec l'alias accepté `minimax-m2.7:cloud`.
- **MiniMax** : activez le provider avec `MINIMAX_API_KEY`. Les URLs `MINIMAX_OPENAI_BASE_URL` et `MINIMAX_ANTHROPIC_BASE_URL` sont optionnelles. Les modèles exposés dans l'application incluent `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`, `MiniMax-M2.1`, `MiniMax-M2.1-highspeed`, `MiniMax-M2`, et `M2-her`.
- **Ollama** : seule une instance **distante** est supportée. Configurez son URL via `OLLAMA_BASE_URL`.
- Si vous choisissez Ollama dans l'application, configurez aussi l'URL, le `keep alive` et le contexte (`num_ctx`) dans les paramètres LLM de l'interface.
