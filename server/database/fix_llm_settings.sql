-- Fix LLM settings configuration
-- Execute with: psql -U postgres -d resumeconverter -f database/fix_llm_settings.sql

-- First, check current values
SELECT id, name, llm_model, cv_mode, chatbot_enabled FROM llm_settings;

-- Update the LLM model to a valid OpenAI model
UPDATE llm_settings 
SET llm_model = 'gpt-4o'
WHERE llm_model IS NULL 
   OR llm_model = '' 
   OR llm_model = 'Default Analysis'
   OR llm_model NOT LIKE 'gpt-%' AND llm_model NOT LIKE 'o%' AND llm_model NOT LIKE 'chatgpt-%';

-- Verify the update
SELECT id, name, llm_model, cv_mode, chatbot_enabled FROM llm_settings;
