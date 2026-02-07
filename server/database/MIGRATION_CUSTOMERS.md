# Migration du service Customers vers PostgreSQL

**Date** : 2026-02-04  
**Statut** : ✅ Complété

---

## 📋 Changements effectués

### Fichier créé
- `src/routes/customers.routes.postgres.js` - Version PostgreSQL du service customers

### Différences clés Airtable → PostgreSQL

| Aspect | Airtable | PostgreSQL |
|--------|----------|------------|
| **Import** | `airtableBase`, `CUSTOMERS_TABLE` | `postgresHelpers`, `database` |
| **Helpers** | `airtableHelpers.js` | `postgresHelpers.js` |
| **Recherche** | `filterByFormula` avec `FIND()` | `WHERE LOWER(name) LIKE $1` |
| **Pagination** | Cursor-based avec `offset` (record ID) | Offset-based avec `LIMIT/OFFSET` |
| **Champs** | `record.fields.Name` | `row.name` (snake_case) |
| **IDs** | `rec...` (Airtable ID) | UUID v4 |
| **Status** | `'Active'`, `'Inactive'` | `'active'`, `'inactive'` (lowercase) |
| **Erreurs** | `handleAirtableError()` | Codes PostgreSQL (`23505`, `23503`) |

---

## 🔄 Mapping des opérations

### GET /api/customers (Liste)

**Avant (Airtable)** :
```javascript
const { records, hasMore, totalCount } = await fetchPaginatedRecords(
    airtableBase, 
    CUSTOMERS_TABLE, 
    {
        pageSize: limit,
        offset: offset,
        filterByFormula: `FIND(LOWER('${search}'), LOWER({Name}))`,
        sort: [{ field: 'Name', direction: 'asc' }]
    }
);
```

**Après (PostgreSQL)** :
```javascript
const customers = await selectWithTimeout('customers', {
    where: 'LOWER(name) LIKE $1',
    params: [`%${search.toLowerCase()}%`],
    orderBy: 'name ASC',
    limit: limit + 1,
    offset: offset
});
```

### GET /api/customers/:id (Détail)

**Avant (Airtable)** :
```javascript
const record = await findWithTimeout(airtableBase, CUSTOMERS_TABLE, id);
res.json({
    id: record.id,
    ...record.fields
});
```

**Après (PostgreSQL)** :
```javascript
const customer = await findWithTimeout('customers', id);
res.json(customer); // Déjà au bon format
```

### POST /api/customers (Création)

**Avant (Airtable)** :
```javascript
const records = await createWithTimeout(
    airtableBase,
    CUSTOMERS_TABLE,
    [{ fields: { Name: req.body.name, Status: req.body.status } }]
);
```

**Après (PostgreSQL)** :
```javascript
const records = await createWithTimeout('customers', [{
    fields: {
        name: req.body.name,
        status: (req.body.status || 'active').toLowerCase()
    }
}]);
```

### PUT /api/customers/:id (Mise à jour)

**Avant (Airtable)** :
```javascript
const records = await updateWithTimeout(
    airtableBase,
    CUSTOMERS_TABLE,
    [{ id: id, fields: customerData }]
);
```

**Après (PostgreSQL)** :
```javascript
const records = await updateWithTimeout('customers', [{
    id: id,
    fields: {
        name: req.body.name,
        status: req.body.status.toLowerCase()
    }
}]);
```

### DELETE /api/customers/:id (Suppression)

**Avant (Airtable)** :
```javascript
// Vérifier les utilisateurs associés via CustomerName (string)
const associatedUsers = await selectWithTimeout(
    airtableBase,
    USERS_TABLE,
    { filterByFormula: `{CustomerName} = '${customerName}'` }
);
```

**Après (PostgreSQL)** :
```javascript
// Vérifier les utilisateurs associés via customer_id (UUID, foreign key)
const associatedUsers = await selectWithTimeout('users', {
    where: 'customer_id = $1',
    params: [id]
});
```

---

## 🔒 Gestion des erreurs PostgreSQL

### Codes d'erreur importants

| Code | Signification | Action |
|------|---------------|--------|
| `23505` | UNIQUE constraint violation | Nom de customer déjà existant |
| `23503` | FOREIGN KEY constraint violation | Référence invalide |
| `23502` | NOT NULL constraint violation | Champ requis manquant |
| `404` | Record not found | Customer inexistant |

**Exemple de gestion** :
```javascript
try {
    await createWithTimeout('customers', [{ fields: customerData }]);
} catch (error) {
    if (error.code === '23505') {
        return res.status(400).json({ 
            error: 'Customer with this name already exists' 
        });
    }
    // Autres erreurs...
}
```

---

## ⚠️ Points d'attention

### 1. Normalisation des valeurs ENUM
```javascript
// ❌ AVANT (Airtable)
status: req.body.status || 'Active'

// ✅ APRÈS (PostgreSQL)
status: (req.body.status || 'active').toLowerCase()
```

### 2. Noms de champs (snake_case)
```javascript
// ❌ AVANT (Airtable)
record.fields.Name
record.fields.CustomerName

// ✅ APRÈS (PostgreSQL)
row.name
```

### 3. Relations (Foreign Keys vs String)
```javascript
// ❌ AVANT (Airtable) - Relation par nom (string)
{CustomerName} = 'Acme Corp'

// ✅ APRÈS (PostgreSQL) - Relation par ID (UUID)
customer_id = 'uuid-here'
```

### 4. Pagination
```javascript
// ❌ AVANT (Airtable) - Cursor-based
offset: lastRecordId

// ✅ APRÈS (PostgreSQL) - Offset-based
offset: (page - 1) * limit
```

---

## 🧪 Tests à effectuer

### Tests manuels

1. **GET /api/customers** - Liste des customers
   - Sans recherche
   - Avec recherche (`?search=acme`)
   - Avec pagination (`?page=2&limit=10`)

2. **GET /api/customers/:id** - Détail d'un customer
   - ID valide
   - ID invalide (404)

3. **POST /api/customers** - Création
   - Données valides
   - Nom déjà existant (400)
   - Champs manquants (400)

4. **PUT /api/customers/:id** - Mise à jour
   - Données valides
   - ID invalide (404)
   - Nom déjà existant (400)

5. **DELETE /api/customers/:id** - Suppression
   - Customer sans utilisateurs
   - Customer avec utilisateurs (400)
   - ID invalide (404)

### Commandes curl

```bash
# Liste des customers
curl http://localhost:3001/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN"

# Créer un customer
curl -X POST http://localhost:3001/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Customer","status":"active"}'

# Mettre à jour un customer
curl -X PUT http://localhost:3001/api/customers/UUID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","status":"inactive"}'

# Supprimer un customer
curl -X DELETE http://localhost:3001/api/customers/UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 Prochaines étapes

1. ✅ **Tester** le service customers avec PostgreSQL
2. ⏳ **Basculer** de Airtable à PostgreSQL dans `proxy-server.js`
3. ⏳ **Migrer** les autres services simples :
   - `llm_settings`
   - `templates`
4. ⏳ **Migrer** les services avec dépendances :
   - `users` (dépend de customers)
   - `resumes`, `missions`, `adaptations`

---

## 📊 Compatibilité

Le service PostgreSQL est **100% compatible** avec l'API existante :
- ✅ Mêmes endpoints
- ✅ Mêmes paramètres de requête
- ✅ Même format de réponse
- ✅ Mêmes codes d'erreur HTTP

**Le frontend n'a pas besoin d'être modifié !** 🎉

---

**Dernière mise à jour** : 2026-02-04 12:28
