import {
    unlinkQuietly,
    unlinkMany,
    createAdvancedFallback
} from './pdfTextOcrPageProcessor.helpers.js';

async function cleanupOcrTempDirectory(fs, directoryPath) {
    if (!directoryPath) {
        return;
    }

    await fs.rm(directoryPath, { recursive: true, force: true }).catch(() => {});
}

export function createPdfOcrPageProcessor({
    settings,
    workerRef,
    callbacks,
    services,
    heuristics
}) {
    const {
        maxScannedOcrPages,
        maxOcrRenderPixels,
        minOcrTextLength,
        advancedOcrTriggerTextLength,
        ocrRenderScale,
        advancedOcrBackend,
        embeddedImageTriggerTextLength,
        embeddedImageStrongTextLength,
        maxEmbeddedImagesPerPage,
        maxVariantsPerPage,
        maxOcrTimePerPageMs,
        earlyAcceptScore
    } = settings;
    const {
        onOcrProgress,
        onOcrPageDetected,
        onOcrPageCompleted,
        onOcrPageFailed,
        onOcrVariantAttempt
    } = callbacks;
    const {
        fs,
        hasTesseractCli,
        hasPdftoppmCli,
        hasPdfimagesCli,
        renderPdfPageWithPdftoppm,
        recognizeWithTesseractCli,
        preparePythonOcrVariants,
        recognizeWithAdvancedOcr,
        extractEmbeddedImagesFromPdf,
        createCanvasModule,
        createTesseractWorker,
        createOcrPageEvaluator,
        recognizeBlockSequence,
        createOcrVariantBuffers,
        writeTempVariantBuffer
    } = services;
    const {
        locateInkBoundingBox,
        calculateOcrResultScore,
        getRecognizedTextLength,
        calculateOcrCandidateQuality,
        createOcrCandidate,
        calculateBlockSequenceScore,
        createBlockSequenceText
    } = heuristics;

    async function recognizeWithTesseractJs(tempPath) {
        const { data: { text, confidence } } = await workerRef.current.recognize(tempPath);
        return {
            text,
            confidence,
            score: calculateOcrResultScore(text, confidence),
            engine: 'tesseract.js',
            psm: null
        };
    }

    async function recognizeVariantBuffer(variantName, variantBuffer, pageNum) {
        const tempPath = await writeTempVariantBuffer(variantName, variantBuffer, pageNum);

        try {
            if (await hasTesseractCli()) {
                return await recognizeWithTesseractCli(tempPath);
            }
            return await recognizeWithTesseractJs(tempPath);
        } finally {
            await unlinkQuietly(fs, tempPath);
        }
    }

    async function ensureTesseractWorker(pageNum) {
        if ((await hasTesseractCli()) || workerRef.current) {
            return;
        }

        workerRef.current = await createTesseractWorker({
            logger: (message) => {
                if (message.status === 'recognizing text') {
                    onOcrProgress?.({ pageNum, progress: message.progress });
                }
            }
        });
    }

    async function maybeRunAdvancedImageRecognition({
        candidateImages,
        preparedAssets,
        evaluator,
        pageNum
    }) {
        if (
            !evaluator.getBestVariant()
            || (evaluator.getBestVariant()?.text?.trim().length || 0) >= advancedOcrTriggerTextLength
            || advancedOcrBackend === 'none'
            || evaluator.shouldStopExploration()
        ) {
            return;
        }

        for (const imageVariant of candidateImages) {
            if (evaluator.shouldStopExploration()) {
                break;
            }
            const advancedRecognition = await recognizeWithAdvancedOcr(
                imageVariant.path,
                advancedOcrBackend
            );
            if (!advancedRecognition) {
                continue;
            }
            evaluator.recordCandidate(`${imageVariant.name}-advanced`, advancedRecognition);
        }

        if (evaluator.shouldStopExploration()) {
            return;
        }

        const advancedBlockCandidate = await recognizeBlockSequence({
            blocks: preparedAssets.blocks,
            recognizer: async (imagePath) => {
                const advancedRecognition = await recognizeWithAdvancedOcr(
                    imagePath,
                    advancedOcrBackend
                );
                return advancedRecognition || createAdvancedFallback(advancedOcrBackend);
            },
            onOcrVariantAttempt,
            pageNum,
            variantPrefix: 'python-blocks-advanced',
            buildSequenceText: createBlockSequenceText,
            scoreSequence: calculateBlockSequenceScore
        });
        if (advancedBlockCandidate) {
            advancedBlockCandidate.score = calculateOcrCandidateQuality(
                advancedBlockCandidate.text,
                advancedBlockCandidate.confidence
            );
            evaluator.considerCandidate(advancedBlockCandidate);
        }
    }

    async function maybeRunEmbeddedImagePipeline({
        buffer,
        pageNum,
        evaluator
    }) {
        if (
            !(await hasPdfimagesCli())
            || getRecognizedTextLength(evaluator.getBestVariant()) >= embeddedImageTriggerTextLength
            || evaluator.shouldStopExploration()
        ) {
            return;
        }

        const embeddedImages = (await extractEmbeddedImagesFromPdf(buffer, pageNum))
            .slice(0, maxEmbeddedImagesPerPage);
        const embeddedImageCandidates = [];

        try {
            for (const embeddedImage of embeddedImages) {
                if (evaluator.shouldStopExploration()) {
                    break;
                }
                embeddedImageCandidates.push(embeddedImage);
                const baseRecognition = await recognizeWithTesseractCli(embeddedImage.path);
                const baseCandidate = evaluator.recordCandidate(embeddedImage.name, baseRecognition);

                if (
                    getRecognizedTextLength(baseCandidate) < embeddedImageStrongTextLength
                    && !evaluator.shouldStopExploration()
                ) {
                    const preparedEmbeddedAssets = await preparePythonOcrVariants(
                        embeddedImage.path,
                        pageNum
                    );
                    try {
                        for (const variant of preparedEmbeddedAssets.variants.slice(0, 4)) {
                            if (variant?.path) {
                                embeddedImageCandidates.push({
                                    name: `${embeddedImage.name}-${variant.name}`,
                                    path: variant.path,
                                    order: embeddedImage.order
                                });
                            }
                        }

                        if (!evaluator.shouldStopExploration()) {
                            const embeddedBlocksCandidate = await recognizeBlockSequence({
                                blocks: preparedEmbeddedAssets.blocks,
                                recognizer: async (imagePath) => recognizeWithTesseractCli(imagePath),
                                onOcrVariantAttempt,
                                pageNum,
                                variantPrefix: `${embeddedImage.name}-blocks`,
                                buildSequenceText: createBlockSequenceText,
                                scoreSequence: calculateBlockSequenceScore
                            });
                            if (embeddedBlocksCandidate) {
                                embeddedBlocksCandidate.score = calculateOcrCandidateQuality(
                                    embeddedBlocksCandidate.text,
                                    embeddedBlocksCandidate.confidence
                                );
                                evaluator.considerCandidate(embeddedBlocksCandidate);
                            }
                        }
                    } finally {
                        await unlinkMany(fs, preparedEmbeddedAssets.blocks);
                        await cleanupOcrTempDirectory(fs, preparedEmbeddedAssets.outputDir);
                    }
                }
            }

            if (!evaluator.shouldStopExploration()) {
                const embeddedSequenceCandidate = await recognizeBlockSequence({
                    blocks: embeddedImages,
                    recognizer: async (imagePath) => recognizeWithTesseractCli(imagePath),
                    onOcrVariantAttempt,
                    pageNum,
                    variantPrefix: 'pdfimages-sequence',
                    buildSequenceText: createBlockSequenceText,
                    scoreSequence: calculateBlockSequenceScore
                });
                if (embeddedSequenceCandidate) {
                    embeddedSequenceCandidate.score = calculateOcrCandidateQuality(
                        embeddedSequenceCandidate.text,
                        embeddedSequenceCandidate.confidence
                    );
                    evaluator.considerCandidate(embeddedSequenceCandidate);
                }
            }

            for (const imageVariant of embeddedImageCandidates) {
                if (evaluator.shouldStopExploration()) {
                    break;
                }
                if (embeddedImages.some((embedded) => embedded.path === imageVariant.path)) {
                    continue;
                }
                const recognition = await recognizeWithTesseractCli(imageVariant.path);
                evaluator.recordCandidate(imageVariant.name, recognition);
            }

            if (
                evaluator.getBestVariant()
                && (evaluator.getBestVariant()?.text?.trim().length || 0) < advancedOcrTriggerTextLength
                && advancedOcrBackend !== 'none'
                && !evaluator.shouldStopExploration()
            ) {
                const advancedEmbeddedSequenceCandidate = await recognizeBlockSequence({
                    blocks: embeddedImages,
                    recognizer: async (imagePath) => {
                        const advancedRecognition = await recognizeWithAdvancedOcr(
                            imagePath,
                            advancedOcrBackend
                        );
                        return advancedRecognition || createAdvancedFallback(advancedOcrBackend);
                    },
                    onOcrVariantAttempt,
                    pageNum,
                    variantPrefix: 'pdfimages-sequence-advanced',
                    buildSequenceText: createBlockSequenceText,
                    scoreSequence: calculateBlockSequenceScore
                });
                if (advancedEmbeddedSequenceCandidate) {
                    advancedEmbeddedSequenceCandidate.score = calculateOcrCandidateQuality(
                        advancedEmbeddedSequenceCandidate.text,
                        advancedEmbeddedSequenceCandidate.confidence
                    );
                    evaluator.considerCandidate(advancedEmbeddedSequenceCandidate);
                }
            }
        } finally {
            await unlinkMany(fs, embeddedImages);
            await unlinkMany(
                fs,
                embeddedImageCandidates.filter(
                    (item) => !embeddedImages.some((embedded) => embedded.path === item.path)
                )
            );
        }
    }

    async function runCliOcrPipeline({ buffer, pageNum, evaluator }) {
        const renderedImagePath = await renderPdfPageWithPdftoppm(buffer, pageNum);

        try {
            const candidateImages = [{ name: 'pdftoppm-page', path: renderedImagePath }];
            const baseRecognition = await recognizeWithTesseractCli(renderedImagePath);
            evaluator.recordCandidate('pdftoppm-page', baseRecognition);

            const preparedAssets = { variants: [], blocks: [] };

            try {
                if (!evaluator.shouldStopExploration()) {
                    const prepared = await preparePythonOcrVariants(renderedImagePath, pageNum);
                    preparedAssets.variants = prepared.variants;
                    preparedAssets.blocks = prepared.blocks;
                    preparedAssets.outputDir = prepared.outputDir;

                    for (const variant of preparedAssets.variants) {
                        if (variant?.path) {
                            candidateImages.push({ name: variant.name, path: variant.path });
                        }
                    }
                }

                for (const imageVariant of candidateImages.slice(1)) {
                    if (evaluator.shouldStopExploration()) {
                        break;
                    }
                    const recognition = await recognizeWithTesseractCli(imageVariant.path);
                    evaluator.recordCandidate(imageVariant.name, recognition);
                }

                if (!evaluator.shouldStopExploration() && preparedAssets.blocks.length > 0) {
                    const blockSequenceCandidate = await recognizeBlockSequence({
                        blocks: preparedAssets.blocks,
                        recognizer: async (imagePath) => recognizeWithTesseractCli(imagePath),
                        onOcrVariantAttempt,
                        pageNum,
                        buildSequenceText: createBlockSequenceText,
                        scoreSequence: calculateBlockSequenceScore
                    });
                    if (blockSequenceCandidate) {
                        blockSequenceCandidate.score = calculateOcrCandidateQuality(
                            blockSequenceCandidate.text,
                            blockSequenceCandidate.confidence
                        );
                        evaluator.considerCandidate(blockSequenceCandidate);
                    }
                }

                await maybeRunEmbeddedImagePipeline({ buffer, pageNum, evaluator });
                await maybeRunAdvancedImageRecognition({
                    candidateImages,
                    preparedAssets,
                    evaluator,
                    pageNum
                });
            } finally {
                await unlinkMany(fs, candidateImages.slice(1));
                await unlinkMany(fs, preparedAssets.blocks);
                await cleanupOcrTempDirectory(fs, preparedAssets.outputDir);
            }
        } finally {
            await unlinkQuietly(fs, renderedImagePath);
        }
    }

    async function runCanvasOcrPipeline({ page, pageNum, evaluator }) {
        const viewport = page.getViewport({ scale: ocrRenderScale });
        if ((viewport.width * viewport.height) > maxOcrRenderPixels) {
            throw new Error('Page is too large for OCR rendering');
        }

        const canvasModule = await createCanvasModule();
        const { createCanvas } = canvasModule;
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        const variantBuffers = createOcrVariantBuffers(
            canvasModule,
            canvas,
            context,
            locateInkBoundingBox
        );

        for (const variant of variantBuffers) {
            if (evaluator.shouldStopExploration()) {
                break;
            }
            const recognition = await recognizeVariantBuffer(variant.name, variant.buffer, pageNum);
            evaluator.recordCandidate(variant.name, recognition);
        }
    }

    return async function ocrPage({
        page,
        pageNum,
        buffer,
        state,
        totalTextLength = 0,
        itemCount = 0
    }) {
        if (state.ocrPageCount >= maxScannedOcrPages) {
            throw new Error(
                `PDF contains too many scanned pages for OCR extraction. Maximum supported scanned pages is ${maxScannedOcrPages}.`
            );
        }

        onOcrPageDetected?.({ pageNum, totalTextLength, itemCount });
        await ensureTesseractWorker(pageNum);

        const evaluator = createOcrPageEvaluator({
            pageNum,
            maxVariantsPerPage,
            maxOcrTimePerPageMs,
            earlyAcceptScore,
            onOcrVariantAttempt,
            buildCandidate: createOcrCandidate
        });

        if ((await hasTesseractCli()) && (await hasPdftoppmCli())) {
            await runCliOcrPipeline({ buffer, pageNum, evaluator });
        } else {
            await runCanvasOcrPipeline({ page, pageNum, evaluator });
        }

        const bestVariant = evaluator.getBestVariant();
        const ocrText = bestVariant?.text || '';
        const confidence = bestVariant?.confidence || 0;

        state.ocrPageCount++;

        if (ocrText && ocrText.trim().length > minOcrTextLength) {
            const trimmedText = ocrText.trim();
            state.ocrUsed = true;
            state.totalOcrConfidence += confidence || 0;
            const pageResult = {
                pageNum,
                confidence,
                textLength: trimmedText.length,
                variant: bestVariant?.variant || 'unknown',
                engine: bestVariant?.engine || 'unknown',
                psm: bestVariant?.psm || null
            };
            state.recentResults.push({ success: true, ...pageResult });
            if (state.recentResults.length > 10) {
                state.recentResults.shift();
            }
            onOcrPageCompleted?.(pageResult);
            return trimmedText + '\n\n';
        }

        state.failedOcrPages++;
        const failedResult = {
            pageNum,
            error: 'OCR returned insufficient text',
            confidence,
            textLength: ocrText?.trim().length || 0,
            variant: bestVariant?.variant || 'unknown',
            engine: bestVariant?.engine || 'unknown',
            psm: bestVariant?.psm || null
        };
        state.recentResults.push({ success: false, ...failedResult });
        if (state.recentResults.length > 10) {
            state.recentResults.shift();
        }
        onOcrPageFailed?.(failedResult);
        return '';
    };
}
