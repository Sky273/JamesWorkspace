export const DEFAULT_FIRM_CREDITS = 1000;

export const AI_CREDIT_ACTION_SETTINGS = Object.freeze([
    {
        actionType: 'chatbot.message',
        settingKey: 'aiCreditChatbotMessage',
        defaultCost: 1
    },
    {
        actionType: 'resume.ai_modify',
        settingKey: 'aiCreditResumeAiModify',
        defaultCost: 5
    },
    {
        actionType: 'template.extract',
        settingKey: 'aiCreditTemplateExtract',
        defaultCost: 15
    },
    {
        actionType: 'resume.analysis',
        settingKey: 'aiCreditResumeAnalysis',
        defaultCost: 25
    },
    {
        actionType: 'resume.improvement',
        settingKey: 'aiCreditResumeImprovement',
        defaultCost: 75
    },
    {
        actionType: 'resume.adaptation',
        settingKey: 'aiCreditResumeAdaptation',
        defaultCost: 50
    },
    {
        actionType: 'resume.match',
        settingKey: 'aiCreditResumeMatch',
        defaultCost: 8
    },
    {
        actionType: 'profile.search',
        settingKey: 'aiCreditProfileSearch',
        defaultCost: 12
    },
    {
        actionType: 'profile.analysis',
        settingKey: 'aiCreditProfileAnalysis',
        defaultCost: 25
    }
]);

export const AI_CREDIT_COSTS = Object.freeze(
    Object.fromEntries(AI_CREDIT_ACTION_SETTINGS.map(({ actionType, defaultCost }) => [actionType, defaultCost]))
);

export function buildAiCreditSettingsDefaults() {
    return {
        firmInitialCredits: DEFAULT_FIRM_CREDITS,
        ...Object.fromEntries(
            AI_CREDIT_ACTION_SETTINGS.map(({ settingKey, defaultCost }) => [settingKey, defaultCost])
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
