import { loadPdfDocument } from '../../../utils/pdfjs.server.js';
import {
    sanitizeDocumentHtmlContent,
    sanitizeDocumentStylesheet
} from '../../../utils/sanitizer.backend.js';

const DEFAULT_HEADER_RATIO = 0.18;
const DEFAULT_FOOTER_RATIO = 0.14;
const MIN_LINE_GROUP_THRESHOLD = 6;
const MIN_VISUAL_BLOCK_AREA = 1200;
const MIN_IMAGE_BLOCK_AREA = 256;
const DEFAULT_PAGE_BACKGROUND = '#ffffff';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeCssIdentifier(value, fallback = 'item') {
    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function roundNumber(value, precision = 2) {
    const factor = 10 ** precision;
    return Math.round((Number(value) || 0) * factor) / factor;
}

function inferFontWeight(fontName, fontFamily) {
    return /bold|black|heavy|semibold|demibold/i.test(`${fontName} ${fontFamily}`) ? 700 : 400;
}

function inferFontStyle(fontName, fontFamily) {
    return /italic|oblique/i.test(`${fontName} ${fontFamily}`) ? 'italic' : 'normal';
}

function normalizeTextItems(items, styles, pageHeight) {
    return (items || [])
        .filter((item) => typeof item?.str === 'string' && item.str.trim())
        .map((item, index) => {
            const transform = Array.isArray(item.transform) ? item.transform : [];
            const x = Number(transform[4]) || 0;
            const y = Number(transform[5]) || 0;
            const rawFontSize = Math.max(
                Math.abs(Number(transform[0]) || 0),
                Math.abs(Number(transform[3]) || 0),
                Number(item.height) || 0
            );
            const fontSize = Math.max(8, Math.round(rawFontSize || 12));
            const width = Math.max(fontSize, Number(item.width) || (item.str.length * fontSize * 0.45));
            const height = Math.max(fontSize, Number(item.height) || fontSize);
            const style = styles?.[item.fontName] || {};
            const fontFamily = style.fontFamily || item.fontName || 'Arial, sans-serif';
            const top = Math.max(0, Math.round(pageHeight - y - height));
            const bottom = Math.min(pageHeight, top + height);

            return {
                index,
                text: item.str.replace(/\s+/g, ' ').trim(),
                left: Math.max(0, Math.round(x)),
                top,
                bottom,
                width: Math.round(width),
                height: Math.round(height),
                fontSize,
                fontFamily,
                fontName: item.fontName || '',
                fontWeight: inferFontWeight(item.fontName, fontFamily),
                fontStyle: inferFontStyle(item.fontName, fontFamily)
            };
        })
        .sort((a, b) => {
            if (Math.abs(a.top - b.top) <= MIN_LINE_GROUP_THRESHOLD) {
                return a.left - b.left;
            }

            return a.top - b.top;
        });
}

function groupItemsIntoLines(items) {
    const lines = [];

    for (const item of items) {
        const lastLine = lines[lines.length - 1];
        if (!lastLine) {
            lines.push({
                items: [item],
                top: item.top,
                bottom: item.bottom
            });
            continue;
        }

        const threshold = Math.max(
            MIN_LINE_GROUP_THRESHOLD,
            Math.round(Math.min(item.fontSize, lastLine.items[0]?.fontSize || item.fontSize) * 0.75)
        );
        if (Math.abs(item.top - lastLine.top) <= threshold) {
            lastLine.items.push(item);
            lastLine.top = Math.min(lastLine.top, item.top);
            lastLine.bottom = Math.max(lastLine.bottom, item.bottom);
            continue;
        }

        lines.push({
            items: [item],
            top: item.top,
            bottom: item.bottom
        });
    }

    return lines.map((line, index) => {
        const sortedItems = [...line.items].sort((a, b) => a.left - b.left);
        let previousRight = null;
        let text = '';

        for (const item of sortedItems) {
            const shouldInsertSpace = previousRight !== null && item.left - previousRight > Math.max(4, item.fontSize * 0.25);
            if (shouldInsertSpace && !text.endsWith(' ')) {
                text += ' ';
            }
            text += item.text;
            previousRight = item.left + item.width;
        }

        const dominantItem = sortedItems.reduce((selected, current) => (
            current.text.length > selected.text.length ? current : selected
        ), sortedItems[0]);

        return {
            index,
            text: text.trim(),
            left: Math.min(...sortedItems.map((item) => item.left)),
            right: Math.max(...sortedItems.map((item) => item.left + item.width)),
            top: line.top,
            bottom: line.bottom,
            height: Math.max(...sortedItems.map((item) => item.height)),
            fontSize: dominantItem.fontSize,
            fontFamily: dominantItem.fontFamily,
            fontWeight: dominantItem.fontWeight,
            fontStyle: dominantItem.fontStyle
        };
    }).filter((line) => line.text.length > 0);
}

function splitLinesIntoRegions(lines, pageHeight) {
    if (lines.length === 0) {
        return { header: [], content: [], footer: [] };
    }

    const headerBoundary = Math.round(pageHeight * DEFAULT_HEADER_RATIO);
    const footerBoundary = Math.round(pageHeight * (1 - DEFAULT_FOOTER_RATIO));

    const header = [];
    const content = [];
    const footer = [];

    for (const line of lines) {
        if (line.bottom <= headerBoundary) {
            header.push(line);
            continue;
        }

        if (line.top >= footerBoundary) {
            footer.push(line);
            continue;
        }

        content.push(line);
    }

    if (header.length === 0 && lines.length > 0) {
        header.push(lines[0]);
        const remaining = content.filter((line) => line.index !== lines[0].index);
        if (remaining.length !== content.length) {
            content.length = 0;
            content.push(...remaining);
        }
    }

    if (footer.length === 0 && content.length > 1) {
        const lastContentLine = content[content.length - 1];
        if (lastContentLine.top > pageHeight * 0.74) {
            footer.unshift(lastContentLine);
            content.pop();
        }
    }

    return { header, content, footer };
}

function getRegionBounds(lines, fallbackTop, fallbackBottom, pageWidth) {
    if (lines.length === 0) {
        return {
            left: 0,
            top: fallbackTop,
            right: Math.round(pageWidth),
            bottom: fallbackBottom,
            width: Math.round(pageWidth),
            height: Math.max(40, Math.round(fallbackBottom - fallbackTop))
        };
    }

    const left = Math.max(0, Math.min(...lines.map((line) => line.left)) - 12);
    const right = Math.min(Math.round(pageWidth), Math.max(...lines.map((line) => line.right)) + 12);
    const top = Math.max(0, Math.min(...lines.map((line) => line.top)) - 8);
    const bottom = Math.max(top + 24, Math.max(...lines.map((line) => line.bottom)) + 8);

    return {
        left: Math.round(left),
        top: Math.round(top),
        right: Math.round(right),
        bottom: Math.round(bottom),
        width: Math.max(40, Math.round(right - left)),
        height: Math.max(40, Math.round(bottom - top))
    };
}

function matrixMultiply(left, right) {
    const [a1, b1, c1, d1, e1, f1] = left;
    const [a2, b2, c2, d2, e2, f2] = right;

    return [
        (a1 * a2) + (c1 * b2),
        (b1 * a2) + (d1 * b2),
        (a1 * c2) + (c1 * d2),
        (b1 * c2) + (d1 * d2),
        (a1 * e2) + (c1 * f2) + e1,
        (b1 * e2) + (d1 * f2) + f1
    ];
}

function applyMatrix(matrix, x, y) {
    const [a, b, c, d, e, f] = matrix;
    return {
        x: (a * x) + (c * y) + e,
        y: (b * x) + (d * y) + f
    };
}

function normalizeRgbChannel(value) {
    return clamp(Math.round(Number(value) * 255), 0, 255);
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function cmykToRgb(c, m, y, k) {
    const normalizedC = clamp(Number(c) || 0, 0, 1);
    const normalizedM = clamp(Number(m) || 0, 0, 1);
    const normalizedY = clamp(Number(y) || 0, 0, 1);
    const normalizedK = clamp(Number(k) || 0, 0, 1);

    return {
        r: Math.round(255 * (1 - normalizedC) * (1 - normalizedK)),
        g: Math.round(255 * (1 - normalizedM) * (1 - normalizedK)),
        b: Math.round(255 * (1 - normalizedY) * (1 - normalizedK))
    };
}

function normalizeColorToHex(args, mode) {
    if (mode === 'rgb' && Array.isArray(args) && args.length >= 3) {
        return rgbToHex(
            normalizeRgbChannel(args[0]),
            normalizeRgbChannel(args[1]),
            normalizeRgbChannel(args[2])
        );
    }

    if (mode === 'gray' && Array.isArray(args) && args.length >= 1) {
        const channel = normalizeRgbChannel(args[0]);
        return rgbToHex(channel, channel, channel);
    }

    if (mode === 'cmyk' && Array.isArray(args) && args.length >= 4) {
        const rgb = cmykToRgb(args[0], args[1], args[2], args[3]);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    return null;
}

function normalizeRectPoints(points, pageHeight, pageWidth) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = clamp(Math.min(...xs), 0, pageWidth);
    const maxX = clamp(Math.max(...xs), 0, pageWidth);
    const minY = clamp(Math.min(...ys), 0, pageHeight);
    const maxY = clamp(Math.max(...ys), 0, pageHeight);
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);

    return {
        left: Math.round(minX),
        top: Math.round(pageHeight - maxY),
        width: Math.round(width),
        height: Math.round(height)
    };
}

function getOperatorArgsArray(operatorList, index) {
    const value = operatorList?.argsArray?.[index];
    return Array.isArray(value) ? value : [];
}

function collectRectanglesFromConstructPath(args, rectangleOpCode) {
    const [ops = [], coords = []] = args;
    if (!Array.isArray(ops) || !Array.isArray(coords) || rectangleOpCode === undefined || rectangleOpCode === null) {
        return [];
    }

    const rectangles = [];
    let coordIndex = 0;

    for (const op of ops) {
        if (op === rectangleOpCode) {
            const x = Number(coords[coordIndex]) || 0;
            const y = Number(coords[coordIndex + 1]) || 0;
            const width = Number(coords[coordIndex + 2]) || 0;
            const height = Number(coords[coordIndex + 3]) || 0;
            rectangles.push({ x, y, width, height });
            coordIndex += 4;
            continue;
        }

        coordIndex += 2;
    }

    return rectangles;
}

function classifyRegionForBounds(bounds, regionBoundaries) {
    const midpoint = bounds.top + (bounds.height / 2);
    if (midpoint <= regionBoundaries.headerBottom) {
        return 'header';
    }
    if (midpoint >= regionBoundaries.footerTop) {
        return 'footer';
    }
    return 'content';
}

function extractVisualArtifacts({ operatorList, pageHeight, pageWidth, pdfOps }) {
    if (!operatorList || !Array.isArray(operatorList.fnArray) || !pdfOps) {
        return {
            visualBlocks: [],
            imageBlocks: [],
            extractedColors: []
        };
    }

    const fnArray = operatorList.fnArray;
    const transformStack = [[1, 0, 0, 1, 0, 0]];
    let currentFill = '#e5e7eb';
    let pendingRectangles = [];
    const visualBlocks = [];
    const imageBlocks = [];
    const extractedColors = new Set();

    const currentMatrix = () => transformStack[transformStack.length - 1] || [1, 0, 0, 1, 0, 0];

    const flushRectangles = () => {
        if (pendingRectangles.length === 0) {
            return;
        }

        for (const rect of pendingRectangles) {
            const points = [
                applyMatrix(currentMatrix(), rect.x, rect.y),
                applyMatrix(currentMatrix(), rect.x + rect.width, rect.y),
                applyMatrix(currentMatrix(), rect.x, rect.y + rect.height),
                applyMatrix(currentMatrix(), rect.x + rect.width, rect.y + rect.height)
            ];
            const normalized = normalizeRectPoints(points, pageHeight, pageWidth);
            if ((normalized.width * normalized.height) < MIN_VISUAL_BLOCK_AREA) {
                continue;
            }

            visualBlocks.push({
                type: 'fill-rect',
                fill: currentFill,
                ...normalized
            });
            extractedColors.add(currentFill);
        }

        pendingRectangles = [];
    };

    for (let index = 0; index < fnArray.length; index += 1) {
        const fn = fnArray[index];
        const args = getOperatorArgsArray(operatorList, index);

        switch (fn) {
            case pdfOps.save:
                transformStack.push([...currentMatrix()]);
                break;
            case pdfOps.restore:
                flushRectangles();
                if (transformStack.length > 1) {
                    transformStack.pop();
                }
                break;
            case pdfOps.transform:
                if (Array.isArray(args) && args.length >= 6) {
                    transformStack[transformStack.length - 1] = matrixMultiply(currentMatrix(), [
                        Number(args[0]) || 1,
                        Number(args[1]) || 0,
                        Number(args[2]) || 0,
                        Number(args[3]) || 1,
                        Number(args[4]) || 0,
                        Number(args[5]) || 0
                    ]);
                }
                break;
            case pdfOps.setFillRGBColor: {
                const color = normalizeColorToHex(args, 'rgb');
                if (color) {
                    currentFill = color;
                }
                break;
            }
            case pdfOps.setFillGray: {
                const color = normalizeColorToHex(args, 'gray');
                if (color) {
                    currentFill = color;
                }
                break;
            }
            case pdfOps.setFillCMYKColor: {
                const color = normalizeColorToHex(args, 'cmyk');
                if (color) {
                    currentFill = color;
                }
                break;
            }
            case pdfOps.constructPath:
                pendingRectangles.push(...collectRectanglesFromConstructPath(args, pdfOps.rectangle));
                break;
            case pdfOps.fill:
            case pdfOps.eoFill:
            case pdfOps.fillStroke:
            case pdfOps.eoFillStroke:
                flushRectangles();
                break;
            case pdfOps.paintImageXObject:
            case pdfOps.paintInlineImageXObject:
            case pdfOps.paintImageMaskXObject:
            case pdfOps.paintSolidColorImageMask: {
                flushRectangles();
                const matrix = currentMatrix();
                const points = [
                    applyMatrix(matrix, 0, 0),
                    applyMatrix(matrix, 1, 0),
                    applyMatrix(matrix, 0, 1),
                    applyMatrix(matrix, 1, 1)
                ];
                const normalized = normalizeRectPoints(points, pageHeight, pageWidth);
                if ((normalized.width * normalized.height) >= MIN_IMAGE_BLOCK_AREA) {
                    imageBlocks.push(normalized);
                }
                break;
            }
            default:
                break;
        }
    }

    flushRectangles();

    return {
        visualBlocks: visualBlocks.slice(0, 24),
        imageBlocks: imageBlocks.slice(0, 12),
        extractedColors: Array.from(extractedColors).filter((color) => color !== DEFAULT_PAGE_BACKGROUND).slice(0, 12)
    };
}

function buildVisualLayers(regionName, regionTop, visualBlocks, imageBlocks) {
    const safeRegionName = sanitizeCssIdentifier(regionName, 'region');
    const htmlSegments = [];
    const cssRules = [];

    visualBlocks.forEach((block, index) => {
        const className = `template-region-${safeRegionName}-visual-${index}`;
        cssRules.push(
            `.${className}{position:absolute;left:${block.left}px;top:${Math.max(0, block.top - regionTop)}px;width:${block.width}px;height:${block.height}px;background:${block.fill || '#e5e7eb'};border-radius:${block.height <= 8 ? 999 : 6}px;opacity:${block.type === 'separator' ? 0.45 : 0.85};z-index:0;}`
        );
        htmlSegments.push(`<div class="template-visual-block ${className}" aria-hidden="true"></div>`);
    });

    imageBlocks.forEach((block, index) => {
        const className = `template-region-${safeRegionName}-image-${index}`;
        cssRules.push(
            `.${className}{position:absolute;left:${block.left}px;top:${Math.max(0, block.top - regionTop)}px;width:${block.width}px;height:${block.height}px;border:1px dashed rgba(107,114,128,0.55);background:rgba(229,231,235,0.4);border-radius:8px;z-index:1;}`
        );
        htmlSegments.push(`<div class="template-image-slot ${className}" data-role="image-slot" aria-hidden="true"></div>`);
    });

    return {
        html: htmlSegments.join(''),
        stylesheet: cssRules.join('\n')
    };
}

function buildRegionFragment(regionName, lines, regionBounds, pageWidth, regionHeight, visualBlocks = [], imageBlocks = []) {
    const safeRegionName = sanitizeCssIdentifier(regionName, 'region');
    const normalizedHeight = Math.max(40, Math.round(regionHeight || 40));
    const htmlLines = [];
    const cssRules = [
        `.template-region-${safeRegionName}{position:relative;width:${Math.round(pageWidth)}px;min-height:${normalizedHeight}px;}`,
    ];
    const extractedFonts = new Set();
    const visualLayers = buildVisualLayers(regionName, regionBounds.top, visualBlocks, imageBlocks);

    if (visualLayers.stylesheet) {
        cssRules.push(visualLayers.stylesheet);
    }

    lines.forEach((line, index) => {
        const className = `template-region-${safeRegionName}-line-${index}`;
        extractedFonts.add(line.fontFamily);
        cssRules.push(
            `.${className}{position:absolute;left:${line.left}px;top:${Math.max(0, line.top - regionBounds.top)}px;font-size:${line.fontSize}px;line-height:${Math.max(line.height, Math.round(line.fontSize * 1.2))}px;font-family:${line.fontFamily};font-weight:${line.fontWeight};font-style:${line.fontStyle};white-space:pre-wrap;z-index:2;}`
        );
        htmlLines.push(`<div class="${className}">${escapeHtml(line.text)}</div>`);
    });

    const html = `<div class="template-region template-region-${safeRegionName}">${visualLayers.html}${htmlLines.join('')}</div>`;
    return {
        html: sanitizeDocumentHtmlContent(html),
        stylesheet: cssRules.join('\n'),
        fonts: Array.from(extractedFonts)
    };
}

function buildCombinedPageHtml(headerHtml, contentHtml, footerHtml) {
    return sanitizeDocumentHtmlContent(
        `<div class="template-page"><header>${headerHtml}</header><main>${contentHtml}</main><footer>${footerHtml}</footer></div>`
    );
}

export function buildStructuredPdfTemplateInput({
    pageWidth,
    pageHeight,
    items = [],
    styles = {},
    operatorList = null,
    pdfOps = null
}) {
    const normalizedItems = normalizeTextItems(items, styles, pageHeight);
    const lines = groupItemsIntoLines(normalizedItems);
    const regions = splitLinesIntoRegions(lines, pageHeight);
    const headerBottom = regions.header.length > 0 ? Math.max(...regions.header.map((line) => line.bottom)) : Math.round(pageHeight * DEFAULT_HEADER_RATIO);
    const contentTop = regions.content.length > 0 ? Math.min(...regions.content.map((line) => line.top)) : headerBottom;
    const contentBottom = regions.content.length > 0 ? Math.max(...regions.content.map((line) => line.bottom)) : Math.round(pageHeight * (1 - DEFAULT_FOOTER_RATIO));
    const footerTop = regions.footer.length > 0 ? Math.min(...regions.footer.map((line) => line.top)) : contentBottom;
    const headerBounds = getRegionBounds(regions.header, 0, headerBottom, pageWidth);
    const contentBounds = getRegionBounds(regions.content, contentTop, contentBottom, pageWidth);
    const footerBounds = getRegionBounds(regions.footer, footerTop, pageHeight, pageWidth);
    const regionBoundaries = {
        headerBottom: headerBounds.bottom,
        footerTop: footerBounds.top
    };

    const visualArtifacts = extractVisualArtifacts({
        operatorList,
        pageHeight,
        pageWidth,
        pdfOps
    });

    const visualBlocksByRegion = {
        header: [],
        content: [],
        footer: []
    };
    const imageBlocksByRegion = {
        header: [],
        content: [],
        footer: []
    };

    for (const block of visualArtifacts.visualBlocks) {
        const region = classifyRegionForBounds(block, regionBoundaries);
        visualBlocksByRegion[region].push({
            ...block,
            region
        });
    }

    for (const block of visualArtifacts.imageBlocks) {
        const region = classifyRegionForBounds(block, regionBoundaries);
        imageBlocksByRegion[region].push({
            ...block,
            region
        });
    }

    const headerFragment = buildRegionFragment(
        'header',
        regions.header,
        headerBounds,
        pageWidth,
        headerBounds.height,
        visualBlocksByRegion.header,
        imageBlocksByRegion.header
    );
    const contentFragment = buildRegionFragment(
        'content',
        regions.content,
        contentBounds,
        pageWidth,
        contentBounds.height,
        visualBlocksByRegion.content,
        imageBlocksByRegion.content
    );
    const footerFragment = buildRegionFragment(
        'footer',
        regions.footer,
        footerBounds,
        pageWidth,
        footerBounds.height,
        visualBlocksByRegion.footer,
        imageBlocksByRegion.footer
    );

    const stylesheet = sanitizeDocumentStylesheet([
        `.template-page{position:relative;width:${Math.round(pageWidth)}px;min-height:${Math.round(pageHeight)}px;background:${DEFAULT_PAGE_BACKGROUND};color:#111;font-family:Arial,sans-serif;}`,
        `header,main,footer{display:block;width:100%;}`,
        `.template-visual-block,.template-image-slot{box-sizing:border-box;}`,
        headerFragment.stylesheet,
        contentFragment.stylesheet,
        footerFragment.stylesheet
    ].join('\n'));

    const extractedFonts = Array.from(new Set([
        ...headerFragment.fonts,
        ...contentFragment.fonts,
        ...footerFragment.fonts
    ])).slice(0, 12);

    const visualBlocks = [
        ...visualBlocksByRegion.header,
        ...visualBlocksByRegion.content,
        ...visualBlocksByRegion.footer
    ].map((block) => ({
        ...block,
        fill: block.fill || '#e5e7eb'
    }));

    const imageBlocks = [
        ...imageBlocksByRegion.header,
        ...imageBlocksByRegion.content,
        ...imageBlocksByRegion.footer
    ];

    return {
        pageHtml: buildCombinedPageHtml(headerFragment.html, contentFragment.html, footerFragment.html),
        headerHtml: headerFragment.html,
        contentHtml: contentFragment.html,
        footerHtml: footerFragment.html,
        stylesheet,
        extractedFonts,
        extractedColors: visualArtifacts.extractedColors,
        visualBlocks,
        imageBlocks,
        metrics: {
            totalLines: lines.length,
            headerLines: regions.header.length,
            contentLines: regions.content.length,
            footerLines: regions.footer.length,
            totalTextCharacters: lines.reduce((sum, line) => sum + line.text.length, 0),
            visualBlockCount: visualBlocks.length,
            imageBlockCount: imageBlocks.length,
            pageWidth: Math.round(pageWidth),
            pageHeight: Math.round(pageHeight),
            headerTop: roundNumber(headerBounds.top),
            headerBottom: roundNumber(headerBounds.bottom),
            footerTop: roundNumber(footerBounds.top)
        }
    };
}

export async function extractStructuredPdfTemplateInput(buffer) {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = await loadPdfDocument(uint8Array);
    const pdf = await loadingTask.promise;
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    const [textContent, operatorList, pdfjsLib] = await Promise.all([
        firstPage.getTextContent(),
        typeof firstPage.getOperatorList === 'function'
            ? firstPage.getOperatorList().catch(() => null)
            : Promise.resolve(null),
        import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null)
    ]);

    return buildStructuredPdfTemplateInput({
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        items: textContent.items,
        styles: textContent.styles,
        operatorList,
        pdfOps: pdfjsLib?.OPS || null
    });
}
