import { getSettings, upsertSettings, createSettings } from '../services/settings.service.js';
import {
    buildSettingsCreateFields,
    buildSettingsUpdateFields,
    persistSettingsMutation
} from './settings.routes.helpers.js';

export async function persistSettingsUpdateRoute({
    id,
    rawSettings,
    getProviderAvailabilityFlags,
    reqUser
}) {
    const currentSettingsRecord = await getSettings();

    return persistSettingsMutation({
        rawSettings,
        currentSettingsRecord,
        getProviderAvailabilityFlags,
        reqUser,
        persist: (settingsData) => upsertSettings(id, buildSettingsUpdateFields(settingsData))
    });
}

export async function persistSettingsCreateRoute({
    rawSettings,
    getProviderAvailabilityFlags,
    reqUser
}) {
    const currentSettingsRecord = await getSettings();

    return persistSettingsMutation({
        rawSettings,
        currentSettingsRecord,
        getProviderAvailabilityFlags,
        reqUser,
        persist: (preparedSettings) => createSettings(buildSettingsCreateFields(preparedSettings))
    });
}
