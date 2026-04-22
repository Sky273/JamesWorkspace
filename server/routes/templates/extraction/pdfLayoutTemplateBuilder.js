import { loadPdfDocument } from '../../../utils/pdfjs.server.js';
import {
    sanitizeDocumentHtmlContent,
    sanitizeDocumentStylesheet
} from '../../../utils/sanitizer.backend.js';

const DEFAULT_HEADER_RATIO = 0.18;
const DEFAULT_FOOTER_RATIO = 0.14;
const HEADER_SCAN_RATIO = 0.28;
const FOOTER_SCAN_RATIO = 0.22;
const MAX_REPEATED_REGION_PAGES = 3;
const MAX_LAYOUT_CANDIDATE_PAGES = 3;
const MIN_LINE_GROUP_THRESHOLD = 6;
const MIN_VISUAL_BLOCK_AREA = 1200;
const MIN_IMAGE_BLOCK_AREA = 256;
const DEFAULT_PAGE_BACKGROUND = '#ffffff';
const MIN_PAGE_BACKGROUND_AREA_RATIO = 0.35;

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

function normalizeColorString(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return null;
    }

    if (/^#[0-9a-f]{3,8}$/i.test(normalized)) {
        return normalized.toLowerCase();
    }

    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const channels = rgbMatch[1]
            .split(',')
            .map((part) => Number.parseFloat(part.trim()))
            .filter((part) => Number.isFinite(part));
        if (channels.length >= 3) {
            return rgbToHex(
                clamp(Math.round(channels[0]), 0, 255),
                clamp(Math.round(channels[1]), 0, 255),
                clamp(Math.round(channels[2]), 0, 255)
            );
        }
    }

    return null;
}

function inferItemColor(item, style = {}) {
    const candidates = [
        item?.color,
        item?.fill,
        item?.fillColor,
        style?.color,
        style?.fill,
        style?.fillColor
    ];

    for (const candidate of candidates) {
        const normalized = normalizeColorString(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

function quoteCssFontFamily(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return 'sans-serif';
    }

    return normalized
        .split(',')
        .map((part) => {
            const token = part.trim();
            if (!token) {
                return null;
            }

            if (/^['"]/.test(token) || /^[a-z-]+$/i.test(token)) {
                return token;
            }

            return `"${token.replace(/"/g, '\\"')}"`;
        })
        .filter(Boolean)
        .join(', ');
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
                fontStyle: inferFontStyle(item.fontName, fontFamily),
                color: inferItemColor(item, style)
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
        const colorWeights = new Map();
        sortedItems.forEach((item) => {
            if (!item.color) {
                return;
            }
            colorWeights.set(item.color, (colorWeights.get(item.color) || 0) + Math.max(item.text.length, 1));
        });
        const dominantColor = Array.from(colorWeights.entries())
            .sort((left, right) => right[1] - left[1])[0]?.[0] || dominantItem.color || null;

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
            fontStyle: dominantItem.fontStyle,
            color: dominantColor
        };
    }).filter((line) => line.text.length > 0);
}

function normalizeRegionHintText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/\d+/g, '#')
        .replace(/[^a-z0-9#@&.+-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildRegionHintSet(lines = []) {
    return new Set(
        lines
            .map((line) => normalizeRegionHintText(line.text))
            .filter(Boolean)
    );
}

function computeContinuationThreshold(referenceLine, candidateLine) {
    return Math.max(
        20,
        Math.round(Math.max(referenceLine?.height || 0, candidateLine?.height || 0) * 2.4)
    );
}

function extendHeaderRegion(header, content, lines, pageHeight, repeatedHeaderTexts) {
    if (lines.length === 0) {
        return;
    }

    const maxHeaderTop = Math.round(pageHeight * 0.34);

    while (content.length > 0 && header.length > 0) {
        const lastHeaderLine = header[header.length - 1];
        const nextLine = content[0];
        const gap = Math.max(0, nextLine.top - lastHeaderLine.bottom);
        const nextLineHint = normalizeRegionHintText(nextLine.text);
        const shouldPromoteByHint = repeatedHeaderTexts.has(nextLineHint);
        const shouldPromoteByContinuity = nextLine.top <= maxHeaderTop
            && gap <= computeContinuationThreshold(lastHeaderLine, nextLine);

        if (!shouldPromoteByHint && !shouldPromoteByContinuity) {
            break;
        }

        header.push(content.shift());
    }
}

function extendFooterRegion(footer, content, lines, pageHeight, repeatedFooterTexts) {
    if (lines.length === 0) {
        return;
    }

    const minFooterBottom = Math.round(pageHeight * 0.66);

    while (content.length > 0 && footer.length > 0) {
        const firstFooterLine = footer[0];
        const previousLine = content[content.length - 1];
        const gap = Math.max(0, firstFooterLine.top - previousLine.bottom);
        const previousLineHint = normalizeRegionHintText(previousLine.text);
        const shouldPromoteByHint = repeatedFooterTexts.has(previousLineHint);
        const shouldPromoteByContinuity = previousLine.bottom >= minFooterBottom
            && gap <= computeContinuationThreshold(firstFooterLine, previousLine);

        if (!shouldPromoteByHint && !shouldPromoteByContinuity) {
            break;
        }

        footer.unshift(content.pop());
    }
}

function splitLinesIntoRegions(lines, pageHeight, repeatedRegionHints = null) {
    if (lines.length === 0) {
        return { header: [], content: [], footer: [] };
    }

    const headerBoundary = Math.round(pageHeight * DEFAULT_HEADER_RATIO);
    const footerBoundary = Math.round(pageHeight * (1 - DEFAULT_FOOTER_RATIO));
    const repeatedHeaderTexts = repeatedRegionHints?.headerTexts || new Set();
    const repeatedFooterTexts = repeatedRegionHints?.footerTexts || new Set();

    const header = [];
    const content = [];
    const footer = [];

    for (const line of lines) {
        const normalizedText = normalizeRegionHintText(line.text);
        const matchesRepeatedHeader = repeatedHeaderTexts.has(normalizedText);
        const matchesRepeatedFooter = repeatedFooterTexts.has(normalizedText);

        if (line.bottom <= headerBoundary || matchesRepeatedHeader) {
            header.push(line);
            continue;
        }

        if (line.top >= footerBoundary || matchesRepeatedFooter) {
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

    extendHeaderRegion(header, content, lines, pageHeight, repeatedHeaderTexts);
    extendFooterRegion(footer, content, lines, pageHeight, repeatedFooterTexts);

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
            `.${className}{position:absolute;left:${line.left}px;top:${Math.max(0, line.top - regionBounds.top)}px;font-size:${line.fontSize}px;line-height:${Math.max(line.height, Math.round(line.fontSize * 1.2))}px;font-family:${quoteCssFontFamily(line.fontFamily)};font-weight:${line.fontWeight};font-style:${line.fontStyle};${line.color ? `color:${line.color};` : ''}white-space:pre-wrap;z-index:2;}`
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

function derivePrimaryFontFamily(lines = []) {
    const weights = new Map();

    lines.forEach((line) => {
        if (!line?.fontFamily) {
            return;
        }
        const weight = Math.max((line.text || '').length, 1) * Math.max(line.fontSize || 1, 1);
        weights.set(line.fontFamily, (weights.get(line.fontFamily) || 0) + weight);
    });

    return Array.from(weights.entries())
        .sort((left, right) => right[1] - left[1])[0]?.[0] || 'Arial, sans-serif';
}

function derivePrimaryTextColor(lines = []) {
    const weights = new Map();

    lines.forEach((line) => {
        if (!line?.color) {
            return;
        }
        const weight = Math.max((line.text || '').length, 1) * Math.max(line.fontSize || 1, 1);
        weights.set(line.color, (weights.get(line.color) || 0) + weight);
    });

    return Array.from(weights.entries())
        .sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function derivePageBackgroundColor(visualBlocks = [], pageWidth = 0, pageHeight = 0) {
    const pageArea = Math.max(Number(pageWidth) || 0, 1) * Math.max(Number(pageHeight) || 0, 1);
    const largestBlock = [...visualBlocks]
        .sort((left, right) => ((right.width * right.height) - (left.width * left.height)))[0];

    if (!largestBlock) {
        return null;
    }

    const blockArea = (largestBlock.width || 0) * (largestBlock.height || 0);
    if ((blockArea / pageArea) < MIN_PAGE_BACKGROUND_AREA_RATIO) {
        return null;
    }

    return largestBlock.fill || null;
}

function buildExtractedColorPalette(lines = [], visualArtifacts = {}, pageBackgroundColor = null) {
    const weightedColors = new Map();

    lines.forEach((line) => {
        if (!line?.color) {
            return;
        }
        const weight = Math.max((line.text || '').length, 1) * Math.max(line.fontSize || 1, 1);
        weightedColors.set(line.color, (weightedColors.get(line.color) || 0) + weight);
    });

    (visualArtifacts?.visualBlocks || []).forEach((block) => {
        if (!block?.fill) {
            return;
        }
        const weight = Math.max((block.width || 0) * (block.height || 0), 1);
        weightedColors.set(block.fill, (weightedColors.get(block.fill) || 0) + weight);
    });

    if (pageBackgroundColor) {
        weightedColors.set(pageBackgroundColor, (weightedColors.get(pageBackgroundColor) || 0) + 1_000_000);
    }

    return Array.from(weightedColors.entries())
        .sort((left, right) => right[1] - left[1])
        .map(([color]) => color)
        .filter((color, index, array) => color && array.indexOf(color) === index)
        .slice(0, 12);
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
    pdfOps = null,
    repeatedRegionHints = null
}) {
    const normalizedItems = normalizeTextItems(items, styles, pageHeight);
    const lines = groupItemsIntoLines(normalizedItems);
    const regions = splitLinesIntoRegions(lines, pageHeight, repeatedRegionHints);
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
        `.template-page{position:relative;width:${Math.round(pageWidth)}px;min-height:${Math.round(pageHeight)}px;${(() => {
            const pageBackgroundColor = derivePageBackgroundColor(visualArtifacts.visualBlocks, pageWidth, pageHeight);
            const primaryTextColor = derivePrimaryTextColor(lines);
            const primaryFontFamily = derivePrimaryFontFamily(lines);
            return [
                `background:${pageBackgroundColor || DEFAULT_PAGE_BACKGROUND};`,
                primaryTextColor ? `color:${primaryTextColor};` : '',
                `font-family:${quoteCssFontFamily(primaryFontFamily)};`
            ].filter(Boolean).join('');
        })()}}`,
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
    const pageBackgroundColor = derivePageBackgroundColor(visualBlocks, pageWidth, pageHeight);

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
        extractedColors: buildExtractedColorPalette(lines, { visualBlocks }, pageBackgroundColor),
        visualBlocks,
        imageBlocks,
        metrics: {
            totalLines: lines.length,
            headerLines: regions.header.length,
            contentLines: regions.content.length,
            footerLines: regions.footer.length,
            repeatedHeaderTextCount: repeatedRegionHints?.headerTexts?.size || 0,
            repeatedFooterTextCount: repeatedRegionHints?.footerTexts?.size || 0,
            totalTextCharacters: lines.reduce((sum, line) => sum + line.text.length, 0),
            visualBlockCount: visualBlocks.length,
            imageBlockCount: imageBlocks.length,
            rawItemCount: items.length,
            rawTextCharacters: (items || []).reduce((sum, item) => sum + (item?.str || '').length, 0),
            pageWidth: Math.round(pageWidth),
            pageHeight: Math.round(pageHeight),
            headerTop: roundNumber(headerBounds.top),
            headerBottom: roundNumber(headerBounds.bottom),
            footerTop: roundNumber(footerBounds.top)
        }
    };
}

async function extractRepeatedRegionHints(pdf) {
    const pageCount = Math.min(Number(pdf?.numPages) || 0, MAX_REPEATED_REGION_PAGES);
    if (pageCount <= 1) {
        return null;
    }

    const headerCounts = new Map();
    const footerCounts = new Map();

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const normalizedItems = normalizeTextItems(textContent.items, textContent.styles, viewport.height);
        const lines = groupItemsIntoLines(normalizedItems);
        const headerCandidates = lines.filter((line) => line.bottom <= (viewport.height * HEADER_SCAN_RATIO));
        const footerCandidates = lines.filter((line) => line.top >= (viewport.height * (1 - FOOTER_SCAN_RATIO)));

        for (const text of buildRegionHintSet(headerCandidates)) {
            headerCounts.set(text, (headerCounts.get(text) || 0) + 1);
        }

        for (const text of buildRegionHintSet(footerCandidates)) {
            footerCounts.set(text, (footerCounts.get(text) || 0) + 1);
        }
    }

    const headerTexts = new Set(
        Array.from(headerCounts.entries())
            .filter(([, count]) => count >= 2)
            .map(([text]) => text)
    );
    const footerTexts = new Set(
        Array.from(footerCounts.entries())
            .filter(([, count]) => count >= 2)
            .map(([text]) => text)
    );

    if (headerTexts.size === 0 && footerTexts.size === 0) {
        return null;
    }

    return { headerTexts, footerTexts };
}

export async function extractStructuredPdfTemplateInput(buffer) {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = await loadPdfDocument(uint8Array);
    const pdf = await loadingTask.promise;
    const repeatedRegionHints = await extractRepeatedRegionHints(pdf);
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null);
    const pageCount = Math.min(Number(pdf?.numPages) || 0, MAX_LAYOUT_CANDIDATE_PAGES);
    const candidateAnalyses = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const [textContent, operatorList] = await Promise.all([
            page.getTextContent(),
            typeof page.getOperatorList === 'function'
                ? page.getOperatorList().catch(() => null)
                : Promise.resolve(null)
        ]);

        const candidate = buildStructuredPdfTemplateInput({
            pageWidth: viewport.width,
            pageHeight: viewport.height,
            items: textContent.items,
            styles: textContent.styles,
            operatorList,
            pdfOps: pdfjsLib?.OPS || null,
            repeatedRegionHints
        });

        candidateAnalyses.push({
            pageNumber,
            analysis: candidate,
            rawItemCount: textContent.items.length,
            rawTextCharacters: textContent.items.reduce((sum, item) => sum + (item?.str || '').length, 0)
        });
    }

    const selectedCandidate = [...candidateAnalyses].sort((left, right) => {
        const rightScore = (right.analysis.metrics.totalTextCharacters * 10) + (right.analysis.metrics.totalLines * 5) + right.rawTextCharacters;
        const leftScore = (left.analysis.metrics.totalTextCharacters * 10) + (left.analysis.metrics.totalLines * 5) + left.rawTextCharacters;
        return rightScore - leftScore;
    })[0];

    const selectedAnalysis = selectedCandidate?.analysis || buildStructuredPdfTemplateInput({
        pageWidth: 0,
        pageHeight: 0
    });

    selectedAnalysis.metrics = {
        ...selectedAnalysis.metrics,
        sourcePageNumber: selectedCandidate?.pageNumber || 1,
        candidatePageCount: candidateAnalyses.length,
        candidatePages: candidateAnalyses.map((candidate) => ({
            pageNumber: candidate.pageNumber,
            rawItemCount: candidate.rawItemCount,
            rawTextCharacters: candidate.rawTextCharacters,
            totalLines: candidate.analysis.metrics.totalLines,
            layoutTextCharacters: candidate.analysis.metrics.totalTextCharacters
        }))
    };

    return selectedAnalysis;
}
