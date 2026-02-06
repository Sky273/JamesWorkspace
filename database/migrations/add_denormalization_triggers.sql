-- ============================================
-- Triggers pour la synchronisation des champs dénormalisés
-- Maintient la cohérence de customer_name dans les tables liées
-- ============================================

-- ============================================
-- 1. Trigger: Synchroniser customer_name dans users quand customers.name change
-- ============================================
CREATE OR REPLACE FUNCTION sync_customer_name_to_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Quand le nom d'un customer change, mettre à jour tous les users liés
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        UPDATE users 
        SET customer_name = NEW.name,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_name_to_users ON customers;
CREATE TRIGGER trigger_sync_customer_name_to_users
    AFTER UPDATE OF name ON customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name_to_users();

-- ============================================
-- 2. Trigger: Synchroniser customer_name dans resumes quand customers.name change
-- ============================================
CREATE OR REPLACE FUNCTION sync_customer_name_to_resumes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        UPDATE resumes 
        SET customer_name = NEW.name,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_name_to_resumes ON customers;
CREATE TRIGGER trigger_sync_customer_name_to_resumes
    AFTER UPDATE OF name ON customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name_to_resumes();

-- ============================================
-- 3. Trigger: Synchroniser customer dans missions quand customers.name change
-- ============================================
CREATE OR REPLACE FUNCTION sync_customer_name_to_missions()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        UPDATE missions 
        SET customer = NEW.name,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_name_to_missions ON customers;
CREATE TRIGGER trigger_sync_customer_name_to_missions
    AFTER UPDATE OF name ON customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name_to_missions();

-- ============================================
-- 4. Trigger: Synchroniser customer dans resume_adaptations quand customers.name change
-- ============================================
CREATE OR REPLACE FUNCTION sync_customer_name_to_adaptations()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        UPDATE resume_adaptations 
        SET customer = NEW.name,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_name_to_adaptations ON customers;
CREATE TRIGGER trigger_sync_customer_name_to_adaptations
    AFTER UPDATE OF name ON customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_customer_name_to_adaptations();

-- ============================================
-- 5. Trigger: Auto-remplir customer_name dans users lors de l'INSERT
-- ============================================
CREATE OR REPLACE FUNCTION auto_fill_customer_name_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Si customer_id est fourni mais pas customer_name, le remplir automatiquement
    IF NEW.customer_id IS NOT NULL AND NEW.customer_name IS NULL THEN
        SELECT name INTO NEW.customer_name
        FROM customers
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_fill_customer_name_users ON users;
CREATE TRIGGER trigger_auto_fill_customer_name_users
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION auto_fill_customer_name_users();

-- ============================================
-- 6. Trigger: Auto-remplir customer_name dans resumes lors de l'INSERT
-- ============================================
CREATE OR REPLACE FUNCTION auto_fill_customer_name_resumes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.customer_name IS NULL THEN
        SELECT name INTO NEW.customer_name
        FROM customers
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_fill_customer_name_resumes ON resumes;
CREATE TRIGGER trigger_auto_fill_customer_name_resumes
    BEFORE INSERT OR UPDATE ON resumes
    FOR EACH ROW
    EXECUTE FUNCTION auto_fill_customer_name_resumes();

-- ============================================
-- 7. Trigger: Synchroniser resume_name et mission_title dans adaptations
-- ============================================
CREATE OR REPLACE FUNCTION sync_resume_name_to_adaptations()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        UPDATE resume_adaptations 
        SET resume_name = NEW.name,
            updated_at = CURRENT_TIMESTAMP
        WHERE resume_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_resume_name_to_adaptations ON resumes;
CREATE TRIGGER trigger_sync_resume_name_to_adaptations
    AFTER UPDATE OF name ON resumes
    FOR EACH ROW
    EXECUTE FUNCTION sync_resume_name_to_adaptations();

CREATE OR REPLACE FUNCTION sync_mission_title_to_adaptations()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.title IS DISTINCT FROM NEW.title THEN
        UPDATE resume_adaptations 
        SET mission_title = NEW.title,
            updated_at = CURRENT_TIMESTAMP
        WHERE mission_id = NEW.id;
    END IF;
    -- Also sync mission content if it changes
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        UPDATE resume_adaptations 
        SET mission_content = NEW.content,
            updated_at = CURRENT_TIMESTAMP
        WHERE mission_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_mission_title_to_adaptations ON missions;
CREATE TRIGGER trigger_sync_mission_title_to_adaptations
    AFTER UPDATE OF title, content ON missions
    FOR EACH ROW
    EXECUTE FUNCTION sync_mission_title_to_adaptations();

-- ============================================
-- 8. Trigger: Auto-remplir les champs dénormalisés dans adaptations
-- ============================================
CREATE OR REPLACE FUNCTION auto_fill_adaptation_denorm()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-fill resume_name if not provided
    IF NEW.resume_id IS NOT NULL AND NEW.resume_name IS NULL THEN
        SELECT name INTO NEW.resume_name
        FROM resumes
        WHERE id = NEW.resume_id;
    END IF;
    
    -- Auto-fill mission fields if not provided
    IF NEW.mission_id IS NOT NULL THEN
        IF NEW.mission_title IS NULL THEN
            SELECT title INTO NEW.mission_title
            FROM missions
            WHERE id = NEW.mission_id;
        END IF;
        IF NEW.mission_content IS NULL THEN
            SELECT content INTO NEW.mission_content
            FROM missions
            WHERE id = NEW.mission_id;
        END IF;
        IF NEW.customer_id IS NULL THEN
            SELECT customer_id, customer INTO NEW.customer_id, NEW.customer
            FROM missions
            WHERE id = NEW.mission_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_fill_adaptation_denorm ON resume_adaptations;
CREATE TRIGGER trigger_auto_fill_adaptation_denorm
    BEFORE INSERT ON resume_adaptations
    FOR EACH ROW
    EXECUTE FUNCTION auto_fill_adaptation_denorm();

-- ============================================
-- Vérification: Lister tous les triggers créés
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
