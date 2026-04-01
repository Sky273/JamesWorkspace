/**
 * CustomTable - Extended Table extension with table-level style attributes
 * Supports: width, border style/width/color, layout, striped rows
 */

import { Table } from '@tiptap/extension-table';
import type { CommandProps } from '@tiptap/core';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    customTable: {
      setTableAttribute: (attr: string, value: unknown) => ReturnType;
    };
  }
}

export const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.tableWidth) return {};
          return { style: `width: ${attributes.tableWidth}` };
        },
      },
      tableBorderStyle: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const s = element.style.borderStyle;
          return s && s !== 'none' ? s : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.tableBorderStyle) return {};
          return { style: `border-style: ${attributes.tableBorderStyle}` };
        },
      },
      tableBorderWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderWidth || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.tableBorderWidth) return {};
          return { style: `border-width: ${attributes.tableBorderWidth}` };
        },
      },
      tableBorderColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderColor || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.tableBorderColor) return {};
          return { style: `border-color: ${attributes.tableBorderColor}` };
        },
      },
      tableLayout: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.tableLayout || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.tableLayout) return {};
          return { style: `table-layout: ${attributes.tableLayout}` };
        },
      },
      stripedRows: {
        default: false,
        parseHTML: (element: HTMLElement) => element.classList.contains('tiptap-striped-table'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.stripedRows) return {};
          return { class: 'tiptap-striped-table' };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setTableAttribute:
        (attr: string, value: unknown) =>
        ({ state, dispatch, tr }: CommandProps) => {
          const { $from } = state.selection;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'table') {
              if (dispatch) {
                const pos = $from.before(d);
                const node = $from.node(d);
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attr]: value });
                dispatch(tr);
              }
              return true;
            }
          }
          return false;
        },
    };
  },
});
