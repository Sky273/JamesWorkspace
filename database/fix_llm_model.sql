-- Fix LLM model configuration
-- Execute with: psql -U postgres -d resumeconverter -f database/fix_llm_model.sql

-- Update the LLM model to a valid OpenAI model
UPDATE llm_settings 
SET llm_model = 'gpt-4o'
WHERE llm_model = 'Default Analysis' OR llm_model IS NULL OR llm_model = '';

-- Verify the update
SELECT id, llm_model, llm_provider, cv_mode 
FROM llm_settings 
ORDER BY created_at DESC 
LIMIT 1;
