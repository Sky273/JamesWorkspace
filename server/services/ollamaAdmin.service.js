import { listOllamaModels, showOllamaModelDetails } from './ollama.service.js';
import { safeLog } from '../utils/logger.backend.js';

function toModelOption(model = {}) {
    return {
        value: model.name,
        label: model.name
    };
}

function mapOllamaModelCapabilities(model = {}, details = {}) {
    return {
        name: model.name,
        size: model.size || null,
        modifiedAt: model.modifiedAt || null,
        digest: model.digest || null,
        family: details.details?.family || model.details?.family || null,
        format: details.details?.format || model.details?.format || null,
        parameterSize: details.details?.parameter_size || model.details?.parameter_size || null,
        quantizationLevel: details.details?.quantization_level || model.details?.quantization_level || null,
        contextLength: details.model_info?.['llama.context_length']
            || details.model_info?.['general.context_length']
            || null,
        architecture: details.model_info?.['general.architecture'] || null
    };
}

export async function discoverOllamaModels(baseUrl, { includeCapabilities = false } = {}) {
    if (!baseUrl || !String(baseUrl).trim()) {
        return {
            models: [],
            modelCatalog: [],
            capabilitiesByModel: {}
        };
    }

    const models = await listOllamaModels(baseUrl);
    const modelCatalog = models
        .filter(model => Boolean(model?.name))
        .map(toModelOption);

    if (!includeCapabilities || modelCatalog.length === 0) {
        return {
            models,
            modelCatalog,
            capabilitiesByModel: {}
        };
    }

    const capabilitiesEntries = await Promise.all(modelCatalog.map(async (entry) => {
        try {
            const details = await showOllamaModelDetails(entry.value, baseUrl);
            return [entry.value, mapOllamaModelCapabilities(models.find(model => model.name === entry.value), details)];
        } catch (error) {
            safeLog('warn', 'Failed to fetch Ollama model details', {
                model: entry.value,
                baseUrl,
                error: error.message
            });
            return [entry.value, mapOllamaModelCapabilities(models.find(model => model.name === entry.value), {})];
        }
    }));

    return {
        models,
        modelCatalog,
        capabilitiesByModel: Object.fromEntries(capabilitiesEntries)
    };
}

export async function validateOllamaModelExists(baseUrl, model) {
    const discovery = await discoverOllamaModels(baseUrl, { includeCapabilities: false });
    const normalizedModel = String(model || '').trim();
    return {
        exists: discovery.modelCatalog.some(entry => entry.value === normalizedModel),
        discovery
    };
}
