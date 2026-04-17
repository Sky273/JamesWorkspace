import { safeLog } from '../../utils/logger.backend.js';
import {
    getDatabaseRuntimeShutdownSteps,
    getLocalStateShutdownSteps,
    getServiceShutdownSteps
} from './runtimeMaintenance.shutdownGroups.js';

async function runShutdownStep(stepName, step) {
    try {
        await step();
        return { stepName, ok: true };
    } catch (error) {
        safeLog('warn', 'Runtime shutdown cleanup step failed', {
            stepName,
            error: error.message
        });
        return { stepName, ok: false, error: error.message };
    }
}

export async function stopRuntimeMaintenance() {
    const shutdownSteps = [
        ...getLocalStateShutdownSteps(),
        ...getServiceShutdownSteps(),
        ...getDatabaseRuntimeShutdownSteps()
    ];

    const results = [];
    for (const [stepName, step] of shutdownSteps) {
        results.push(await runShutdownStep(stepName, step));
    }

    const failedSteps = results.filter((result) => !result.ok).map((result) => result.stepName);
    safeLog('info', 'Runtime maintenance shutdown completed', {
        failedSteps
    });
}
