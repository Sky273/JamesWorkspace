import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { isValidDocxArchive, isValidFileSignature } from '../../utils/fileSignature.js';

async function buildDocxBuffer() {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
    </Types>`);
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Resume</w:t></w:r></w:p></w:body></w:document>');
    return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

describe('fileSignature', () => {
    it('validates basic PDF and DOC signatures', () => {
        expect(isValidFileSignature(Buffer.from('%PDF-1.7 example'), 'application/pdf')).toBe(true);
        expect(isValidFileSignature(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), 'application/msword')).toBe(true);
    });

    it('validates DOCX archives with expected OOXML structure', async () => {
        const buffer = await buildDocxBuffer();

        await expect(isValidDocxArchive(buffer)).resolves.toBe(true);
    });

    it('rejects ZIP-shaped buffers that are not DOCX archives', async () => {
        const zip = new JSZip();
        zip.file('readme.txt', 'hello');
        const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

        await expect(isValidDocxArchive(buffer)).resolves.toBe(false);
    });
});
