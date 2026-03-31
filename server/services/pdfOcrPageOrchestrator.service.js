export function createOcrPageEvaluator({
    pageNum,
    maxVariantsPerPage,
    maxOcrTimePerPageMs,
    earlyAcceptScore,
    onOcrVariantAttempt,
    buildCandidate
}) {
    let bestVariant = null;
    let evaluatedVariants = 0;
    const pageStartedAt = Date.now();

    function shouldStopExploration() {
        return (
            evaluatedVariants >= maxVariantsPerPage
            || (Date.now() - pageStartedAt) >= maxOcrTimePerPageMs
            || ((bestVariant?.score || 0) >= earlyAcceptScore)
        );
    }

    function recordCandidate(variant, recognition, extra = {}) {
        evaluatedVariants++;
        const trimmedTextLength = recognition.text?.trim().length || 0;
        onOcrVariantAttempt?.({
            pageNum,
            variant,
            confidence: recognition.confidence,
            textLength: trimmedTextLength,
            engine: recognition.engine,
            psm: recognition.psm,
            ...extra
        });
        const candidate = buildCandidate(variant, recognition);
        if (!bestVariant || candidate.score > bestVariant.score) {
            bestVariant = candidate;
        }
        return candidate;
    }

    function considerCandidate(candidate) {
        if (candidate && (!bestVariant || candidate.score > bestVariant.score)) {
            bestVariant = candidate;
        }
        return bestVariant;
    }

    function getBestVariant() {
        return bestVariant;
    }

    return {
        shouldStopExploration,
        recordCandidate,
        considerCandidate,
        getBestVariant
    };
}

export async function recognizeBlockSequence({
    blocks,
    recognizer,
    onOcrVariantAttempt,
    pageNum,
    variantPrefix = 'python-blocks',
    buildSequenceText,
    scoreSequence
}) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
        return null;
    }

    const results = [];
    for (const block of blocks) {
        const recognition = await recognizer(block.path);
        const trimmedTextLength = recognition.text?.trim().length || 0;
        onOcrVariantAttempt?.({
            pageNum,
            variant: `${variantPrefix}-${String(block.order ?? 0).padStart(2, '0')}`,
            confidence: recognition.confidence,
            textLength: trimmedTextLength,
            engine: recognition.engine,
            psm: recognition.psm,
            blockOrder: block.order ?? null
        });
        results.push({
            ...recognition,
            order: block.order ?? results.length
        });
    }

    const text = buildSequenceText(results);
    if (!text) {
        return null;
    }

    const confidences = results
        .map((result) => Number(result.confidence) || 0)
        .filter((value) => value > 0);

    return {
        variant: variantPrefix,
        text,
        confidence: confidences.length
            ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
            : 0,
        score: scoreSequence(results),
        engine: results[0]?.engine || 'unknown',
        psm: 'blocks'
    };
}
