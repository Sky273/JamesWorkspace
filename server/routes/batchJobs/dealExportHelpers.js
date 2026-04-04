export function buildDealExportItems(dealResumes, dealAdaptations) {
    return [
        ...dealResumes.map((resume) => ({
            resumeId: resume.id,
            adaptationId: null,
            sourceType: 'resume',
            fileName: resume.name || 'CV',
            relativePath: resume.relative_path || null,
            originalName: resume.source_file_name || null
        })),
        ...dealAdaptations.map((adaptation) => ({
            resumeId: adaptation.resume_id,
            adaptationId: adaptation.id,
            sourceType: 'adaptation',
            fileName: `${adaptation.candidate_name || 'Candidat'} - ${adaptation.mission_name || 'Mission'}`,
            originalName: adaptation.source_file_name || null,
            relativePath: adaptation.relative_path || null
        }))
    ];
}

export function buildDealExportJobOptions({ deal, dealId, templateId, exportFormats }) {
    return {
        dealId,
        dealTitle: deal.title,
        templateId,
        exportFormats: Array.isArray(exportFormats) ? exportFormats : [exportFormats],
        export: true
    };
}

export function buildDealExportResponse(updatedJob, dealResumes, dealAdaptations) {
    return {
        ...updatedJob,
        resumeCount: dealResumes.length,
        adaptationCount: dealAdaptations.length
    };
}
