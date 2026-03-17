/**
 * CustomImage - Extended Image extension with alignment, float, border, margin support
 * Extends @tiptap/extension-image with additional HTML attributes rendered as inline styles
 */

import Image from '@tiptap/extension-image';
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state';

export interface CustomImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    customImage: {
      setImageAttributes: (attributes: Record<string, unknown>) => ReturnType;
    };
  }
}

export const CustomImage = Image.extend({
  name: 'image',

  // Ensure clicking on the image creates a NodeSelection
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width') || element.style.width || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('height') || element.style.height || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      // float: left | right | none
      float: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.float || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.float || attributes.float === 'none') return {};
          const margin = attributes.float === 'left' ? '0 16px 8px 0' : '0 0 8px 16px';
          return {
            style: `float: ${attributes.float}; margin: ${margin};`,
          };
        },
      },
      // display alignment: left | center | right (block-level, not float)
      alignment: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          if (element.style.display === 'block') {
            if (element.style.marginLeft === 'auto' && element.style.marginRight === 'auto') return 'center';
            if (element.style.marginLeft === 'auto') return 'right';
          }
          return null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.alignment || attributes.float) return {};
          const map: Record<string, string> = {
            left: 'display: block; margin-left: 0; margin-right: auto;',
            center: 'display: block; margin-left: auto; margin-right: auto;',
            right: 'display: block; margin-left: auto; margin-right: 0;',
          };
          return { style: map[attributes.alignment as string] || '' };
        },
      },
      // border
      borderWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderWidth || null,
      },
      borderStyle: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderStyle || null,
      },
      borderColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderColor || null,
      },
      borderRadius: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.borderRadius || null,
      },
      // margin
      margin: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.margin || null,
      },
      // padding
      padding: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.padding || null,
      },
      // shadow
      shadow: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.boxShadow || null,
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    // Merge all style-generating attributes into a single style string
    const styles: string[] = [];

    if (HTMLAttributes.width) {
      const w = HTMLAttributes.width;
      styles.push(`width: ${typeof w === 'number' ? w + 'px' : w}`);
    }
    if (HTMLAttributes.height) {
      const h = HTMLAttributes.height;
      styles.push(`height: ${typeof h === 'number' ? h + 'px' : h}`);
    }
    if (HTMLAttributes.float && HTMLAttributes.float !== 'none') {
      styles.push(`float: ${HTMLAttributes.float}`);
      const m = HTMLAttributes.float === 'left' ? '0 16px 8px 0' : '0 0 8px 16px';
      styles.push(`margin: ${m}`);
    } else if (HTMLAttributes.alignment) {
      styles.push('display: block');
      const map: Record<string, string> = {
        left: 'margin-left: 0; margin-right: auto',
        center: 'margin-left: auto; margin-right: auto',
        right: 'margin-left: auto; margin-right: 0',
      };
      if (map[HTMLAttributes.alignment]) styles.push(map[HTMLAttributes.alignment]);
    }
    if (HTMLAttributes.margin && !HTMLAttributes.float) {
      styles.push(`margin: ${HTMLAttributes.margin}`);
    }
    if (HTMLAttributes.padding) {
      styles.push(`padding: ${HTMLAttributes.padding}`);
    }
    if (HTMLAttributes.borderWidth && HTMLAttributes.borderStyle) {
      styles.push(`border: ${HTMLAttributes.borderWidth} ${HTMLAttributes.borderStyle} ${HTMLAttributes.borderColor || '#000'}`);
    }
    if (HTMLAttributes.borderRadius) {
      styles.push(`border-radius: ${HTMLAttributes.borderRadius}`);
    }
    if (HTMLAttributes.shadow) {
      styles.push(`box-shadow: ${HTMLAttributes.shadow}`);
    }

    // Clean up attributes that were converted to styles
    const { float: _f, alignment: _a, borderWidth: _bw, borderStyle: _bs, borderColor: _bc, borderRadius: _br, margin: _m, padding: _p, shadow: _sh, style: existingStyle, ...rest } = HTMLAttributes;

    const finalStyle = [existingStyle, ...styles].filter(Boolean).join('; ');

    return ['img', { ...rest, ...(finalStyle ? { style: finalStyle } : {}) }];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAttributes:
        (attributes: Record<string, unknown>) =>
        ({ chain }) => {
          return chain().updateAttributes('image', attributes).run();
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('customImageClick'),
        props: {
          handleClickOn: (view, pos, node, nodePos, event, direct) => {
            if (node.type.name === 'image' && direct) {
              // Force NodeSelection on the clicked image
              const tr = view.state.tr.setSelection(
                NodeSelection.create(view.state.doc, nodePos),
              );
              view.dispatch(tr);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
