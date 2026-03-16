/**
 * Tests for trigram utility
 */

import { describe, it, expect } from 'vitest';
import { generateTrigram } from '../../utils/trigram.js';

describe('generateTrigram', () => {
    it('should return XXX for null/undefined/empty', () => {
        expect(generateTrigram(null)).toBe('XXX');
        expect(generateTrigram(undefined)).toBe('XXX');
        expect(generateTrigram('')).toBe('XXX');
        expect(generateTrigram('   ')).toBe('XXX');
    });

    it('should return XXX for non-string input', () => {
        expect(generateTrigram(123)).toBe('XXX');
        expect(generateTrigram({})).toBe('XXX');
    });

    it('should generate trigram from first + last name', () => {
        expect(generateTrigram('Jean Dupont')).toBe('JDU');
        expect(generateTrigram('Marie Martin')).toBe('MMA');
    });

    it('should use last part as surname for compound names', () => {
        expect(generateTrigram('Jean Pierre Dupont')).toBe('JDU');
    });

    it('should handle hyphenated names', () => {
        expect(generateTrigram('Pierre-Louis Durand')).toBe('PDU');
    });

    it('should handle accented characters', () => {
        expect(generateTrigram('René Étienne')).toBe('RET');
        expect(generateTrigram('François Müller')).toBe('FMU');
    });

    it('should handle single name', () => {
        const result = generateTrigram('Madonna');
        expect(result).toBe('MAD');
    });

    it('should handle single short name', () => {
        expect(generateTrigram('Li')).toBe('LIX');
        expect(generateTrigram('A')).toBe('AXX');
    });

    it('should handle extra spaces', () => {
        expect(generateTrigram('  Jean   Dupont  ')).toBe('JDU');
    });

    it('should return uppercase', () => {
        const result = generateTrigram('jean dupont');
        expect(result).toBe('JDU');
    });

    it('should handle names with dots and commas', () => {
        expect(generateTrigram('Jean, Dupont')).toBe('JDU');
        expect(generateTrigram('Dr. Smith')).toBe('DSM');
    });
});
