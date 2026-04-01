/**
 * CustomTableCell - Extended TableCell with padding, vertical-align, border, width attributes
 * These attributes are persisted as inline styles on <td> elements
 */

import { TableCell } from '@tiptap/extension-table-cell';

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || element.getAttribute('data-bg') || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}`, 'data-bg': attributes.backgroundColor };
        },
      },
      verticalAlign: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.verticalAlign || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.verticalAlign) return {};
          return { style: `vertical-align: ${attributes.verticalAlign}` };
        },
      },
      cellPadding: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.padding || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.cellPadding) return {};
          return { style: `padding: ${attributes.cellPadding}` };
        },
      },
      borderColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderColor || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.borderColor) return {};
          return { style: `border-color: ${attributes.borderColor}` };
        },
      },
      borderWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderWidth || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.borderWidth) return {};
          return { style: `border-width: ${attributes.borderWidth}` };
        },
      },
      cellWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || element.getAttribute('width') || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.cellWidth) return {};
          return { style: `width: ${attributes.cellWidth}` };
        },
      },
      textAlign: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.textAlign || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.textAlign) return {};
          return { style: `text-align: ${attributes.textAlign}` };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const styles: string[] = [];

    if (HTMLAttributes.backgroundColor) styles.push(`background-color: ${HTMLAttributes.backgroundColor}`);
    if (HTMLAttributes.verticalAlign) styles.push(`vertical-align: ${HTMLAttributes.verticalAlign}`);
    if (HTMLAttributes.cellPadding) styles.push(`padding: ${HTMLAttributes.cellPadding}`);
    if (HTMLAttributes.borderColor) styles.push(`border-color: ${HTMLAttributes.borderColor}`);
    if (HTMLAttributes.borderWidth) styles.push(`border-width: ${HTMLAttributes.borderWidth}`);
    if (HTMLAttributes.cellWidth) styles.push(`width: ${HTMLAttributes.cellWidth}`);
    if (HTMLAttributes.textAlign) styles.push(`text-align: ${HTMLAttributes.textAlign}`);

    const { backgroundColor, style: existingStyle, ...rest } = HTMLAttributes;

    const finalStyle = [existingStyle, ...styles].filter(Boolean).join('; ');

    return ['td', { ...rest, ...(finalStyle ? { style: finalStyle } : {}), ...(backgroundColor ? { 'data-bg': backgroundColor } : {}) }, 0];
  },
});
