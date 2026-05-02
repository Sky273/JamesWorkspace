import { describe, expect, it } from 'vitest';

import {
    extractRawValue,
    normalizeNumericString,
    toNumber
} from '../../services/marketTrends/extractors.js';

describe('Market Trends - Extractors', () => {
    describe('toNumber', () => {
        it('parses France Travail decimal comma values without truncating decimals', () => {
            expect(toNumber('12,75')).toBe(12.75);
            expect(toNumber('0,20')).toBe(0.2);
            expect(toNumber('-3,5')).toBe(-3.5);
        });

        it('parses localized separators commonly returned by French APIs', () => {
            expect(toNumber('1 234,56')).toBe(1234.56);
            expect(toNumber('1\u00a0234,56')).toBe(1234.56);
            expect(toNumber('1\u202f234,56')).toBe(1234.56);
            expect(toNumber('1.234,56')).toBe(1234.56);
            expect(toNumber('1,234.56')).toBe(1234.56);
            expect(toNumber('12,5 %')).toBe(12.5);
        });

        it('rejects invalid numeric strings', () => {
            expect(toNumber('')).toBeNull();
            expect(toNumber('N/A')).toBeNull();
            expect(toNumber('--')).toBeNull();
            expect(normalizeNumericString('N/A')).toBe('');
        });
    });

    describe('extractRawValue', () => {
        it('extracts decimal comma values from period values', () => {
            expect(extractRawValue({
                listeValeursParPeriode: [
                    { valeurPrincipaleTaux: '8,25' }
                ]
            })).toBe(8.25);
        });

        it('extracts decimal comma values from top-level indicators', () => {
            expect(extractRawValue({
                valeurPrincipaleDecimale: '4,75'
            })).toBe(4.75);
        });
    });
});
