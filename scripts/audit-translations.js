/**
 * Translation Audit Script
 * Compares translation keys used in code with translation files
 * Supports --fix flag to automatically add missing keys and remove unused ones
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_SRC = path.join(__dirname, '..', 'client', 'src');
const FR_JSON = path.join(CLIENT_SRC, 'i18n', 'locales', 'fr.json');
const EN_JSON = path.join(CLIENT_SRC, 'i18n', 'locales', 'en.json');

const FIX_MODE = process.argv.includes('--fix');
const REMOVE_UNUSED = process.argv.includes('--remove-unused');

// Valid translation key prefixes (to filter out false positives like imports, URLs, etc.)
const VALID_PREFIXES = [
    'common.', 'header.', 'footer.', 'auth.', 'about.', 'resume.', 'resumes.',
    'upload.', 'processing.', 'sidebar.', 'home.', 'dashboard.', 'missions.',
    'adaptations.', 'templates.', 'settings.', 'metrics.', 'security.', 'users.',
    'tags.', 'errors.', 'export.', 'marketRadar.', 'userGuide.', 'userProfile.',
    'pagination.', 'health.', 'chatbot.'
];

// Check if a key looks like a valid translation key
function isValidTranslationKey(key) {
    // Must start with a valid prefix
    if (!VALID_PREFIXES.some(prefix => key.startsWith(prefix))) {
        return false;
    }
    // Must not contain path separators, URLs, or special characters
    if (key.includes('/') || key.includes('\\') || key.includes('http') || key.includes('@')) {
        return false;
    }
    // Must be a reasonable length
    if (key.length > 100 || key.length < 3) {
        return false;
    }
    return true;
}

// Extract all translation keys from a nested object
function extractKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...extractKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

// Find all t('key') patterns in source files
function findUsedKeys(dir, extensions = ['.tsx', '.ts', '.js', '.jsx']) {
    const usedKeys = new Set();
    
    // Dynamic key prefixes - keys that are built dynamically with variables
    // These prefixes will be preserved even if not found with exact match
    const dynamicPrefixes = [
        'marketRadar.dataTypes.',
        'resumes.status.',
        'adaptations.status.',
        'security.levels.',
        'security.events.',
        'security.sources.',
        'header.language.',
        'header.theme.',
        'templates.editor.title.'
    ];
    
    function scanFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Match t('key'), t("key"), t(`key`)
        const patterns = [
            /t\('([^']+)'\)/g,
            /t\("([^"]+)"\)/g,
            /t\(`([^`]+)`\)/g,
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const key = match[1];
                // Skip interpolated strings and validate key format
                if (!key.includes('${') && isValidTranslationKey(key)) {
                    usedKeys.add(key);
                }
                // Detect dynamic key patterns like t(`prefix.${variable}`)
                if (key.includes('${')) {
                    // Extract the static prefix before the variable
                    const prefix = key.split('${')[0];
                    if (prefix && prefix.endsWith('.')) {
                        // Mark this prefix as dynamically used
                        dynamicPrefixes.push(prefix);
                    }
                }
            }
        }
        
        // Also detect patterns like t(`marketRadar.dataTypes.${...}`)
        const dynamicPatterns = [
            /t\(`([^`]+)\.\$\{[^}]+\}`\)/g,
        ];
        
        for (const pattern of dynamicPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const prefix = match[1] + '.';
                if (!dynamicPrefixes.includes(prefix)) {
                    dynamicPrefixes.push(prefix);
                }
            }
        }
    }
    
    // Store dynamic prefixes for later use
    findUsedKeys.dynamicPrefixes = dynamicPrefixes;
    
    function scanDir(dirPath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                scanDir(fullPath);
            } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                scanFile(fullPath);
            }
        }
    }
    
    scanDir(dir);
    return usedKeys;
}

// Set a nested key in an object
function setNestedKey(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}

// Delete a nested key from an object
function deleteNestedKey(obj, keyPath) {
    const parts = keyPath.split('.');
    let current = obj;
    const parents = [];
    
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) return false;
        parents.push({ obj: current, key: parts[i] });
        current = current[parts[i]];
    }
    
    if (current[parts[parts.length - 1]] !== undefined) {
        delete current[parts[parts.length - 1]];
        
        // Clean up empty parent objects
        for (let i = parents.length - 1; i >= 0; i--) {
            const { obj: parentObj, key } = parents[i];
            if (Object.keys(parentObj[key]).length === 0) {
                delete parentObj[key];
            } else {
                break;
            }
        }
        return true;
    }
    return false;
}

// Generate a placeholder translation value
function generatePlaceholder(key, lang) {
    const lastPart = key.split('.').pop();
    // Convert camelCase to words
    const words = lastPart.replace(/([A-Z])/g, ' $1').trim();
    const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
    return lang === 'fr' ? `[FR] ${capitalized}` : `[EN] ${capitalized}`;
}

// Main audit function
function audit() {
    console.log('🔍 Translation Audit' + (FIX_MODE ? ' (FIX MODE)' : '') + '\n');
    console.log('='.repeat(60));
    
    // Load translation files
    let frTranslations = JSON.parse(fs.readFileSync(FR_JSON, 'utf-8'));
    let enTranslations = JSON.parse(fs.readFileSync(EN_JSON, 'utf-8'));
    
    const frKeys = new Set(extractKeys(frTranslations));
    const enKeys = new Set(extractKeys(enTranslations));
    
    console.log(`\n📄 FR translations: ${frKeys.size} keys`);
    console.log(`📄 EN translations: ${enKeys.size} keys`);
    
    // Find used keys in code
    const usedKeys = findUsedKeys(CLIENT_SRC);
    console.log(`📝 Keys used in code: ${usedKeys.size} keys\n`);
    
    // Find missing keys in FR
    const missingInFr = [];
    for (const key of usedKeys) {
        if (!frKeys.has(key)) {
            missingInFr.push(key);
        }
    }
    
    // Find missing keys in EN
    const missingInEn = [];
    for (const key of usedKeys) {
        if (!enKeys.has(key)) {
            missingInEn.push(key);
        }
    }
    
    // Get dynamic prefixes detected during scanning
    const dynamicPrefixes = findUsedKeys.dynamicPrefixes || [];
    
    // Check if a key matches any dynamic prefix (used dynamically with variables)
    const isDynamicKey = (key) => {
        return dynamicPrefixes.some(prefix => key.startsWith(prefix));
    };
    
    // Find unused keys in FR (only if key starts with valid prefix and is not dynamic)
    const unusedInFr = [];
    for (const key of frKeys) {
        if (!usedKeys.has(key) && isValidTranslationKey(key) && !isDynamicKey(key)) {
            unusedInFr.push(key);
        }
    }
    
    // Find unused keys in EN
    const unusedInEn = [];
    for (const key of enKeys) {
        if (!usedKeys.has(key) && isValidTranslationKey(key) && !isDynamicKey(key)) {
            unusedInEn.push(key);
        }
    }
    
    // Find keys missing between FR and EN
    const missingInEnFromFr = [];
    for (const key of frKeys) {
        if (!enKeys.has(key)) {
            missingInEnFromFr.push(key);
        }
    }
    
    const missingInFrFromEn = [];
    for (const key of enKeys) {
        if (!frKeys.has(key)) {
            missingInFrFromEn.push(key);
        }
    }
    
    // Report
    console.log('='.repeat(60));
    console.log('❌ MISSING KEYS (used in code but not in translations)');
    console.log('='.repeat(60));
    
    if (missingInFr.length > 0) {
        console.log(`\n🇫🇷 Missing in FR (${missingInFr.length}):`);
        missingInFr.sort().forEach(key => console.log(`   - ${key}`));
    } else {
        console.log('\n🇫🇷 No missing keys in FR ✅');
    }
    
    if (missingInEn.length > 0) {
        console.log(`\n🇬🇧 Missing in EN (${missingInEn.length}):`);
        missingInEn.sort().forEach(key => console.log(`   - ${key}`));
    } else {
        console.log('\n🇬🇧 No missing keys in EN ✅');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  UNUSED KEYS (in translations but not used in code)');
    console.log('='.repeat(60));
    
    if (unusedInFr.length > 0) {
        console.log(`\n🇫🇷 Unused in FR (${unusedInFr.length}):`);
        unusedInFr.sort().slice(0, 50).forEach(key => console.log(`   - ${key}`));
        if (unusedInFr.length > 50) {
            console.log(`   ... and ${unusedInFr.length - 50} more`);
        }
    } else {
        console.log('\n🇫🇷 No unused keys in FR ✅');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 SYNC ISSUES (keys present in one file but not the other)');
    console.log('='.repeat(60));
    
    if (missingInEnFromFr.length > 0) {
        console.log(`\n🇫🇷→🇬🇧 In FR but not in EN (${missingInEnFromFr.length}):`);
        missingInEnFromFr.sort().forEach(key => console.log(`   - ${key}`));
    }
    
    if (missingInFrFromEn.length > 0) {
        console.log(`\n🇬🇧→🇫🇷 In EN but not in FR (${missingInFrFromEn.length}):`);
        missingInFrFromEn.sort().forEach(key => console.log(`   - ${key}`));
    }
    
    if (missingInEnFromFr.length === 0 && missingInFrFromEn.length === 0) {
        console.log('\n✅ FR and EN are in sync!');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Missing in FR: ${missingInFr.length}`);
    console.log(`   Missing in EN: ${missingInEn.length}`);
    console.log(`   Unused in FR: ${unusedInFr.length}`);
    console.log(`   Unused in EN: ${unusedInEn.length}`);
    console.log(`   Sync issues: ${missingInEnFromFr.length + missingInFrFromEn.length}`);
    console.log('='.repeat(60));
    
    // FIX MODE: Apply corrections
    if (FIX_MODE) {
        console.log('\n🔧 APPLYING FIXES...\n');
        
        let frModified = false;
        let enModified = false;
        
        // Add missing keys to FR
        for (const key of missingInFr) {
            // Try to get value from EN first
            const enValue = getNestedValue(enTranslations, key);
            const value = enValue || generatePlaceholder(key, 'fr');
            setNestedKey(frTranslations, key, value);
            console.log(`   ✅ Added to FR: ${key}`);
            frModified = true;
        }
        
        // Add missing keys to EN
        for (const key of missingInEn) {
            // Try to get value from FR first
            const frValue = getNestedValue(frTranslations, key);
            const value = frValue || generatePlaceholder(key, 'en');
            setNestedKey(enTranslations, key, value);
            console.log(`   ✅ Added to EN: ${key}`);
            enModified = true;
        }
        
        // Sync FR and EN
        for (const key of missingInEnFromFr) {
            const frValue = getNestedValue(frTranslations, key);
            setNestedKey(enTranslations, key, frValue || generatePlaceholder(key, 'en'));
            console.log(`   🔄 Synced to EN: ${key}`);
            enModified = true;
        }
        
        for (const key of missingInFrFromEn) {
            const enValue = getNestedValue(enTranslations, key);
            setNestedKey(frTranslations, key, enValue || generatePlaceholder(key, 'fr'));
            console.log(`   🔄 Synced to FR: ${key}`);
            frModified = true;
        }
        
        // Remove unused keys if requested
        if (REMOVE_UNUSED) {
            console.log('\n   🗑️  Removing unused keys...');
            let removedFr = 0;
            let removedEn = 0;
            
            for (const key of unusedInFr) {
                if (deleteNestedKey(frTranslations, key)) {
                    removedFr++;
                }
            }
            
            for (const key of unusedInEn) {
                if (deleteNestedKey(enTranslations, key)) {
                    removedEn++;
                }
            }
            
            console.log(`   🗑️  Removed ${removedFr} unused keys from FR`);
            console.log(`   🗑️  Removed ${removedEn} unused keys from EN`);
            frModified = frModified || removedFr > 0;
            enModified = enModified || removedEn > 0;
        } else {
            console.log('\n   ⚠️  Unused keys NOT removed automatically (manual review recommended)');
            console.log('   Run with --remove-unused to remove them');
        }
        
        // Save modified files
        if (frModified) {
            fs.writeFileSync(FR_JSON, JSON.stringify(frTranslations, null, 2) + '\n', 'utf-8');
            console.log('\n   💾 Saved FR translations');
        }
        
        if (enModified) {
            fs.writeFileSync(EN_JSON, JSON.stringify(enTranslations, null, 2) + '\n', 'utf-8');
            console.log('   💾 Saved EN translations');
        }
        
        console.log('\n✅ Fixes applied successfully!');
    } else {
        console.log('\n💡 Run with --fix to automatically add missing keys');
    }
    
    // Return results for further processing
    return {
        missingInFr,
        missingInEn,
        unusedInFr,
        unusedInEn,
        missingInEnFromFr,
        missingInFrFromEn
    };
}

// Get a nested value from an object
function getNestedValue(obj, keyPath) {
    const parts = keyPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (!current || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return current;
}

audit();
