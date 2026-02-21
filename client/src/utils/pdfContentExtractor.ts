/**
 * PDF Content Extraction Utilities
 * Functions for extracting and converting PDF content to HTML
 */

import logger from './logger.frontend';

interface TextItem {
    str?: string;
    transform?: number[];
    fontName?: string;
    color?: string;
    type?: string;
    tag?: string;
}

interface TextGroup {
    items: TextItem[];
    position: { x: number; y: number };
    style: {
        fontSize?: string;
        fontFamily?: string;
        isBold?: boolean;
        isItalic?: boolean;
        color?: string;
    };
    isHeader: boolean;
}

interface HTMLElement {
    html: string;
    position: { x?: number; y?: number };
}

interface Viewport {
    width: number;
    height: number;
}

interface ImageData {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
    kind?: number;
}

interface PDFPage {
    objs: {
        resolve: (id: string) => Promise<void>;
        get: (id: string) => Promise<unknown>;
    };
    getTextContent: (options?: { normalizeWhitespace?: boolean; includeMarkedContent?: boolean }) => Promise<{ items: TextItem[] }>;
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    getViewport: (options: { scale: number }) => Viewport;
}

interface PDFJSLib {
    OPS: {
        paintImageXObject: number;
        setFont: number;
        setFillRGBColor: number;
    };
}

/**
 * Process text content items from PDF and convert to HTML elements
 */
export function processTextContent(
    items: TextItem[],
    viewport: Viewport,
    defaultStyle: Record<string, unknown>
): HTMLElement[] {
    if (!Array.isArray(items)) {
        logger.warn('Invalid items array in processTextContent');
        return [];
    }

    const elements: HTMLElement[] = [];
    let currentGroup: TextGroup | null = null;
    let lastY: number | null = null;
    const yThreshold = 3;
    let inArtifact = false;

    items.forEach(item => {
        if (item?.type === 'beginMarkedContentProps') {
            switch (item.tag) {
                case 'Span':
                    if (currentGroup?.items?.length && currentGroup.items.length > 0) {
                        const htmlElement = convertTextGroupToHTML(currentGroup);
                        if (htmlElement) elements.push(htmlElement);
                        currentGroup = null;
                    }
                    return;
                case 'Artifact':
                    inArtifact = true;
                    return;
                default:
                    return;
            }
        }

        if (item?.type === 'endMarkedContent') {
            inArtifact = false;
            return;
        }

        if (inArtifact) return;

        if (!item?.transform || !Array.isArray(item.transform) || item.transform.length < 6) {
            return;
        }

        try {
            const y = item.transform[5];
            const x = item.transform[4];
            const fontSize = Math.abs(item.transform[0] || 12);
            const isHeader = fontSize > 14;

            if (!currentGroup || 
                (lastY && Math.abs(y - lastY) > yThreshold) || 
                isHeader || 
                (item.fontName && item.fontName.toLowerCase().includes('bold'))) {
                
                if (currentGroup?.items?.length && currentGroup.items.length > 0) {
                    const htmlElement = convertTextGroupToHTML(currentGroup);
                    if (htmlElement) elements.push(htmlElement);
                }

                currentGroup = {
                    items: [],
                    position: { x, y },
                    style: {
                        ...defaultStyle,
                        fontSize: `${fontSize}px`,
                        fontFamily: item.fontName || 'inherit',
                        isBold: item.fontName?.toLowerCase().includes('bold'),
                        isItalic: item.fontName?.toLowerCase().includes('italic')
                    },
                    isHeader
                };
            }

            currentGroup.items.push({
                str: item.str || '',
                transform: item.transform,
                fontName: item.fontName,
                color: item.color
            });
            lastY = y;
        } catch (error) {
            logger.warn('Error processing text item:', error);
        }
    });

    if (currentGroup?.items?.length && currentGroup.items.length > 0) {
        const htmlElement = convertTextGroupToHTML(currentGroup);
        if (htmlElement) elements.push(htmlElement);
    }

    return elements;
}

/**
 * Convert a text group to HTML element
 */
export function convertTextGroupToHTML(group: TextGroup): HTMLElement | null {
    try {
        if (!group?.items || group.items.length === 0) return null;

        const text = group.items
            .map(item => (item.str || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();

        if (!text) return null;

        const styles: string[] = [];
        const position = group.position || { x: 0, y: 0 };

        if (group.style?.fontSize) styles.push(`font-size: ${group.style.fontSize}`);
        if (group.style?.isBold) styles.push('font-weight: bold');
        if (group.style?.isItalic) styles.push('font-style: italic');
        if (group.style?.color) styles.push(`color: ${group.style.color}`);
        if (group.style?.fontFamily) styles.push(`font-family: ${group.style.fontFamily}`);

        const styleStr = styles.join('; ');
        let html = '';

        if (group.isHeader) {
            const fontSize = parseInt(group.style?.fontSize || '16') || 16;
            const level = Math.min(Math.ceil(24 / fontSize), 6);
            html = `<h${level} style="${styleStr}; margin: 0.5em 0;">${text}</h${level}>`;
        } else if (text.match(/^[•\-\d]+[\.\)]/) || text.startsWith('•')) {
            html = `<li style="${styleStr}; margin-left: 1.5em;">${text.replace(/^[•\-\d]+[\.\)]/, '').trim()}</li>`;
        } else {
            html = `<p style="${styleStr}; margin: 0.5em 0;">${text}</p>`;
        }

        return { html, position };
    } catch (error) {
        logger.warn('Error converting text group to HTML:', error);
        return null;
    }
}

/**
 * Extract image from PDF page
 */
export async function extractImage(page: PDFPage, imageId: string): Promise<ImageData | null> {
    try {
        await page.objs.resolve(imageId);

        let imageObj: unknown = null;
        try {
            imageObj = await page.objs.get(imageId);
        } catch (error) {
            logger.warn(`Failed to get image object directly: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        if (!imageObj) {
            const alternativeIds = [
                imageId,
                `img_${imageId}`,
                `image_${imageId}`,
                imageId.replace('img_', ''),
                imageId.replace('image_', '')
            ];

            for (const id of alternativeIds) {
                try {
                    await page.objs.resolve(id);
                    const obj = await page.objs.get(id);
                    if (obj) {
                        logger.log('Found image with alternative ID:', id);
                        imageObj = obj;
                        break;
                    }
                } catch {
                    continue;
                }
            }
        }

        if (!imageObj) {
            logger.warn('Image object not found after trying alternative IDs:', imageId);
            return null;
        }

        const imgObj = imageObj as Record<string, unknown>;

        if (imgObj instanceof ImageData) {
            return {
                data: imgObj.data,
                width: imgObj.width,
                height: imgObj.height
            };
        }

        if (imgObj.image) {
            const image = imgObj.image as ImageData;
            return {
                data: image.data,
                width: image.width,
                height: image.height,
                kind: image.kind
            };
        }

        if (imgObj.data) {
            return {
                data: imgObj.data as Uint8ClampedArray,
                width: imgObj.width as number,
                height: imgObj.height as number,
                kind: imgObj.kind as number
            };
        }

        logger.warn('Unknown image object format:', Object.keys(imgObj));
        return null;
    } catch (error) {
        logger.warn('Error extracting image:', error);
        return null;
    }
}

/**
 * Convert image to HTML with base64 encoding
 */
export async function convertImageToHTML(image: ImageData, viewport: Viewport): Promise<HTMLElement | null> {
    try {
        if (!image || !image.data) return null;

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let imageData: globalThis.ImageData;
        if (image.kind === 1) { // Grayscale
            imageData = ctx.createImageData(image.width, image.height);
            for (let i = 0, j = 0; i < image.data.length; i++, j += 4) {
                imageData.data[j] = image.data[i] as number;
                imageData.data[j + 1] = image.data[i] as number;
                imageData.data[j + 2] = image.data[i] as number;
                imageData.data[j + 3] = 255;
            }
        } else if (image.kind === 2) { // RGB
            imageData = ctx.createImageData(image.width, image.height);
            for (let i = 0, j = 0; i < image.data.length; i += 3, j += 4) {
                imageData.data[j] = image.data[i] as number;
                imageData.data[j + 1] = image.data[i + 1] as number;
                imageData.data[j + 2] = image.data[i + 2] as number;
                imageData.data[j + 3] = 255;
            }
        } else if (image.kind === 3) { // RGBA
            imageData = new globalThis.ImageData(
                new Uint8ClampedArray(image.data),
                image.width,
                image.height
            );
        } else {
            imageData = new globalThis.ImageData(
                new Uint8ClampedArray(image.data),
                image.width,
                image.height
            );
        }

        ctx.putImageData(imageData, 0, 0);

        const maxWidth = viewport.width * 0.8;
        const scale = Math.min(1, maxWidth / image.width);
        const displayWidth = Math.round(image.width * scale);
        const displayHeight = Math.round(image.height * scale);

        const dataUrl = canvas.toDataURL('image/png');
        const html = `<img src="${dataUrl}" width="${displayWidth}" height="${displayHeight}" style="max-width: 100%; height: auto; margin: 1em 0;" />`;

        return { html, position: { y: 0 } };
    } catch (error) {
        logger.warn('Error converting image to HTML:', error);
        return null;
    }
}

/**
 * Extract structured content from a PDF page
 */
export async function extractStructuredContent(page: PDFPage, pdfjsLib: PDFJSLib): Promise<string> {
    try {
        const textContent = await page.getTextContent({
            normalizeWhitespace: true,
            includeMarkedContent: true,
        });

        if (!textContent || !textContent.items) {
            logger.warn('No text content found in PDF page');
            return '';
        }

        const operatorList = await page.getOperatorList();
        const viewport = page.getViewport({ scale: 1.0 });

        let elements: HTMLElement[] = [];
        const currentStyle: Record<string, unknown> = {
            fontSize: null,
            fontFamily: null,
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: null,
            backgroundColor: null,
        };

        for (let i = 0; i < operatorList.fnArray.length; i++) {
            const fn = operatorList.fnArray[i];
            const args = operatorList.argsArray[i];

            switch (fn) {
                case pdfjsLib.OPS.paintImageXObject:
                    try {
                        const imageId = args[0] as string;
                        if (imageId) {
                            await page.objs.resolve(imageId);
                            const image = await extractImage(page, imageId);
                            if (image) {
                                const imgElement = await convertImageToHTML(image, viewport);
                                if (imgElement) elements.push(imgElement);
                            }
                        }
                    } catch (error) {
                        logger.warn('Error processing image:', error);
                    }
                    break;

                case pdfjsLib.OPS.setFont:
                    if (args[0]) {
                        const fontName = (args[0] as string).toLowerCase();
                        currentStyle.fontFamily = fontName;
                        currentStyle.fontWeight = fontName.includes('bold') ? 'bold' : 'normal';
                        currentStyle.fontStyle = fontName.includes('italic') ? 'italic' : 'normal';
                    }
                    break;

                case pdfjsLib.OPS.setFillRGBColor:
                    if (args.length >= 3) {
                        currentStyle.color = `rgb(${Math.round((args[0] as number) * 255)}, ${Math.round((args[1] as number) * 255)}, ${Math.round((args[2] as number) * 255)})`;
                    }
                    break;
            }
        }

        const textElements = processTextContent(textContent.items, viewport, currentStyle);
        elements = elements.concat(textElements);

        elements.sort((a, b) => (b.position?.y || 0) - (a.position?.y || 0));

        return elements.map(el => el.html || '').filter(Boolean).join('\n');
    } catch (error) {
        logger.error('Error extracting content:', error);
        return '';
    }
}
