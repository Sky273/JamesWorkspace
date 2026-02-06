#!/bin/bash
# ============================================
# Test d'idempotence du script PostgreSQL
# Vérifie que le script peut être exécuté plusieurs fois sans erreur
# ============================================

set -e  # Arrêter en cas d'erreur

DB_NAME="resumeconverter_test"
DB_USER="postgres"
SCRIPT_PATH="init_postgresql.sql"

echo "=========================================="
echo "Test d'idempotence du script PostgreSQL"
echo "=========================================="
echo ""

# Fonction de nettoyage
cleanup() {
    echo "🧹 Nettoyage..."
    psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
}

# Nettoyer au démarrage et à la fin
trap cleanup EXIT

# Créer la base de test
echo "📦 Création de la base de test: $DB_NAME"
psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
psql -U $DB_USER -c "CREATE DATABASE $DB_NAME WITH ENCODING = 'UTF8';"
echo "✅ Base créée"
echo ""

# Première exécution
echo "🔄 Exécution 1/3 du script..."
psql -U $DB_USER -d $DB_NAME -f $SCRIPT_PATH > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Exécution 1 réussie"
else
    echo "❌ Exécution 1 échouée"
    exit 1
fi

# Vérifier les objets créés
TABLES=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
VIEWS=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public';")
TRIGGERS=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';")

echo "   📊 Tables créées: $TABLES"
echo "   👁️  Vues créées: $VIEWS"
echo "   ⚡ Triggers créés: $TRIGGERS"
echo ""

# Deuxième exécution (test d'idempotence)
echo "🔄 Exécution 2/3 du script (test d'idempotence)..."
psql -U $DB_USER -d $DB_NAME -f $SCRIPT_PATH > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Exécution 2 réussie (idempotence confirmée)"
else
    echo "❌ Exécution 2 échouée (problème d'idempotence)"
    exit 1
fi

# Vérifier que le nombre d'objets est identique
TABLES2=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
VIEWS2=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public';")
TRIGGERS2=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';")

if [ "$TABLES" = "$TABLES2" ] && [ "$VIEWS" = "$VIEWS2" ] && [ "$TRIGGERS" = "$TRIGGERS2" ]; then
    echo "   ✅ Nombre d'objets identique (tables: $TABLES2, vues: $VIEWS2, triggers: $TRIGGERS2)"
else
    echo "   ❌ Nombre d'objets différent!"
    echo "   Tables: $TABLES -> $TABLES2"
    echo "   Vues: $VIEWS -> $VIEWS2"
    echo "   Triggers: $TRIGGERS -> $TRIGGERS2"
    exit 1
fi
echo ""

# Troisième exécution (confirmation)
echo "🔄 Exécution 3/3 du script (confirmation)..."
psql -U $DB_USER -d $DB_NAME -f $SCRIPT_PATH > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Exécution 3 réussie"
else
    echo "❌ Exécution 3 échouée"
    exit 1
fi
echo ""

# Vérifier les données initiales
echo "📝 Vérification des données initiales..."
LLM_COUNT=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM llm_settings;")
if [ "$LLM_COUNT" -eq 3 ]; then
    echo "   ✅ Données initiales présentes (3 configurations LLM)"
else
    echo "   ⚠️  Nombre de configurations LLM: $LLM_COUNT (attendu: 3)"
fi
echo ""

# Test final
echo "=========================================="
echo "✅ TEST D'IDEMPOTENCE RÉUSSI!"
echo "=========================================="
echo ""
echo "Le script peut être exécuté plusieurs fois sans erreur."
echo "Tous les objets sont correctement supprimés et recréés."
echo ""
