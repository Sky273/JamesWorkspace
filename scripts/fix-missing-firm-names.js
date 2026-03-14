/**
 * Script de rattrapage : renseigner firm_name sur les CVs qui ont firm_id mais pas firm_name
 * Exécuter avec: node scripts/fix-missing-firm-names.js
 */

import { query } from '../server/config/database.js';

async function fixMissingFirmNames() {
    console.log('=== Correction des firm_name manquants ===\n');

    try {
        // 1. Afficher les CVs concernés avant correction
        const beforeResult = await query(`
            SELECT r.id, r.name, r.firm_id, r.firm_name, f.name as expected_firm_name
            FROM resumes r
            LEFT JOIN firms f ON r.firm_id = f.id
            WHERE r.firm_id IS NOT NULL 
              AND (r.firm_name IS NULL OR r.firm_name = '')
            ORDER BY r.created_at DESC
        `);

        console.log(`CVs sans firm_name trouvés: ${beforeResult.rows.length}`);
        
        if (beforeResult.rows.length === 0) {
            console.log('Aucun CV à corriger.');
            process.exit(0);
        }

        console.log('\nCVs à corriger:');
        beforeResult.rows.forEach(row => {
            console.log(`  - ${row.name} (firm_id: ${row.firm_id}) -> firm_name: ${row.expected_firm_name}`);
        });

        // 2. Appliquer la correction
        const updateResult = await query(`
            UPDATE resumes r
            SET firm_name = f.name
            FROM firms f
            WHERE r.firm_id = f.id
              AND r.firm_id IS NOT NULL
              AND (r.firm_name IS NULL OR r.firm_name = '')
        `);

        console.log(`\n✓ ${updateResult.rowCount} CV(s) corrigé(s)`);

        // 3. Vérifier le résultat
        const afterResult = await query(`
            SELECT COUNT(*) as remaining
            FROM resumes
            WHERE firm_id IS NOT NULL 
              AND (firm_name IS NULL OR firm_name = '')
        `);

        console.log(`\nCVs restants sans firm_name: ${afterResult.rows[0].remaining}`);
        console.log('\n=== Correction terminée ===');

    } catch (error) {
        console.error('Erreur:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

fixMissingFirmNames();
