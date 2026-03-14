-- Script de rattrapage : renseigner firm_name sur les CVs qui ont firm_id mais pas firm_name
-- Exécuter ce script une seule fois après le déploiement du correctif getPendingJobs

-- Afficher les CVs concernés avant correction
SELECT r.id, r.name, r.firm_id, r.firm_name, f.name as expected_firm_name
FROM resumes r
LEFT JOIN firms f ON r.firm_id = f.id
WHERE r.firm_id IS NOT NULL 
  AND (r.firm_name IS NULL OR r.firm_name = '')
ORDER BY r.created_at DESC;

-- Appliquer la correction
UPDATE resumes r
SET firm_name = f.name
FROM firms f
WHERE r.firm_id = f.id
  AND r.firm_id IS NOT NULL
  AND (r.firm_name IS NULL OR r.firm_name = '');

-- Vérifier le résultat
SELECT COUNT(*) as remaining_without_firm_name
FROM resumes
WHERE firm_id IS NOT NULL 
  AND (firm_name IS NULL OR firm_name = '');
