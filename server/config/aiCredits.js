export const DEFAULT_FIRM_CREDITS = 1000;
export const DEFAULT_ALLOW_USER_REGISTRATION_WITHOUT_APPROVAL = false;

export const AI_CREDIT_ACTION_SETTINGS = Object.freeze([
    {
        actionType: 'chatbot.message',
        settingKey: 'aiCreditChatbotMessage',
        maxTokensSettingKey: 'aiMaxTokensChatbotMessage',
        defaultCost: 1,
        defaultMaxTokens: 4000
    },
    {
        actionType: 'resume.ai_modify',
        settingKey: 'aiCreditResumeAiModify',
        maxTokensSettingKey: 'aiMaxTokensResumeAiModify',
        defaultCost: 5,
        defaultMaxTokens: 8192
    },
    {
        actionType: 'resume.analysis',
        settingKey: 'aiCreditResumeAnalysis',
        maxTokensSettingKey: 'aiMaxTokensResumeAnalysis',
        defaultCost: 25,
        defaultMaxTokens: 16000
    },
    {
        actionType: 'resume.improvement',
        settingKey: 'aiCreditResumeImprovement',
        maxTokensSettingKey: 'aiMaxTokensResumeImprovement',
        defaultCost: 75,
        defaultMaxTokens: 16384
    },
    {
        actionType: 'resume.adaptation',
        settingKey: 'aiCreditResumeAdaptation',
        maxTokensSettingKey: 'aiMaxTokensResumeAdaptation',
        defaultCost: 50,
        defaultMaxTokens: 8192
    },
    {
        actionType: 'resume.match',
        settingKey: 'aiCreditResumeMatch',
        maxTokensSettingKey: 'aiMaxTokensResumeMatch',
        defaultCost: 8,
        defaultMaxTokens: 4096
    },
    {
        actionType: 'profile.search',
        settingKey: 'aiCreditProfileSearch',
        maxTokensSettingKey: 'aiMaxTokensProfileSearch',
        defaultCost: 12,
        defaultMaxTokens: 2048
    },
    {
        actionType: 'profile.analysis',
        settingKey: 'aiCreditProfileAnalysis',
        maxTokensSettingKey: 'aiMaxTokensProfileAnalysis',
        defaultCost: 25,
        defaultMaxTokens: 3072
    }
]);

export const AI_CREDIT_COSTS = Object.freeze(
    Object.fromEntries(AI_CREDIT_ACTION_SETTINGS.map(({ actionType, defaultCost }) => [actionType, defaultCost]))
);

export function buildAiCreditSettingsDefaults() {
    return {
        firmInitialCredits: DEFAULT_FIRM_CREDITS,
        ...Object.fromEntries(
            AI_CREDIT_ACTION_SETTINGS.flatMap(({ settingKey, maxTokensSettingKey, defaultCost, defaultMaxTokens }) => [
                [settingKey, defaultCost],
                [maxTokensSettingKey, defaultMaxTokens]
            ])
        )
    };
}

export function getInitialFirmCredits(settings = null) {
    const configuredValue = Number(settings?.firmInitialCredits);
    return Number.isInteger(configuredValue) && configuredValue >= 0
        ? configuredValue
        : DEFAULT_FIRM_CREDITS;
}

export function getAiCreditCost(actionType, settings = null) {
    const actionDefinition = AI_CREDIT_ACTION_SETTINGS.find((entry) => entry.actionType === actionType);
    if (!actionDefinition) {
        return 0;
    }

    const configuredValue = Number(settings?.[actionDefinition.settingKey]);
    return Number.isInteger(configuredValue) && configuredValue >= 0
        ? configuredValue
        : actionDefinition.defaultCost;
}

export function getAiActionMaxTokens(actionType, settings = null) {
    const actionDefinition = AI_CREDIT_ACTION_SETTINGS.find((entry) => entry.actionType === actionType);
    if (!actionDefinition) {
        return 4096;
    }

    const configuredValue = Number(settings?.[actionDefinition.maxTokensSettingKey]);
    return Number.isInteger(configuredValue) && configuredValue > 0
        ? configuredValue
        : actionDefinition.defaultMaxTokens;
}

export function getAiActionRuntimeConfig(actionType, settings = null) {
    return {
        cost: getAiCreditCost(actionType, settings),
        maxTokens: getAiActionMaxTokens(actionType, settings)
    };
}
