/**
 * BubbleToolbar - Context-aware floating toolbar on selection
 * Shows different controls for: text, images, links
 */

import type { Editor } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface BubbleToolbarProps {
  editor: Editor;
  onSetLink: () => void;
}

const TB = ({ onClick, isActive, title, children, className = '' }: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`tiptap-bubble-btn ${isActive ? 'is-active' : ''} ${className}`}
  >
    {children}
  </button>
);

// ============================================
// IMAGE BUBBLE - HELPERS
// ============================================

type ImagePanel = 'quick' | 'dimensions' | 'style' | 'advanced';

type ImageAttributes = {
  width?: string | null;
  height?: string | null;
  alt?: string | null;
  title?: string | null;
  borderWidth?: string | null;
  borderStyle?: string | null;
  borderColor?: string | null;
  borderRadius?: string | null;
  margin?: string | null;
  padding?: string | null;
  shadow?: string | null;
  alignment?: string | null;
  float?: string | null;
};

const SHADOW_PRESETS = [
  { label: 'Aucune', value: null },
  { label: 'Légère', value: '0 1px 3px rgba(0,0,0,0.12)' },
  { label: 'Moyenne', value: '0 4px 12px rgba(0,0,0,0.15)' },
  { label: 'Forte', value: '0 8px 24px rgba(0,0,0,0.2)' },
] as const;

const BORDER_STYLES = [
  { label: 'Aucune', value: null },
  { label: 'Plein', value: 'solid' },
  { label: 'Tirets', value: 'dashed' },
  { label: 'Points', value: 'dotted' },
] as const;

const toInputValue = (value: string | null | undefined) => value ?? '';

// ============================================
// IMAGE BUBBLE (shown when image is selected)
// ============================================

const ImageBubble = ({ editor }: { editor: Editor }) => {
  const { t } = useTranslation();
  const attrs = editor.getAttributes('image') as ImageAttributes;
  const [panel, setPanel] = useState<ImagePanel>('quick');

  // Form state for properties
  const [width, setWidth] = useState(toInputValue(attrs.width));
  const [height, setHeight] = useState(toInputValue(attrs.height));
  const [alt, setAlt] = useState(toInputValue(attrs.alt));
  const [title, setTitle] = useState(toInputValue(attrs.title));
  const [borderWidth, setBorderWidth] = useState(toInputValue(attrs.borderWidth));
  const [borderStyle, setBorderStyle] = useState(toInputValue(attrs.borderStyle));
  const [borderColor, setBorderColor] = useState(toInputValue(attrs.borderColor));
  const [borderRadius, setBorderRadius] = useState(toInputValue(attrs.borderRadius));
  const [margin, setMargin] = useState(toInputValue(attrs.margin));
  const [padding, setPadding] = useState(toInputValue(attrs.padding));

  useEffect(() => {
    setWidth(toInputValue(attrs.width));
    setHeight(toInputValue(attrs.height));
    setAlt(toInputValue(attrs.alt));
    setTitle(toInputValue(attrs.title));
    setBorderWidth(toInputValue(attrs.borderWidth));
    setBorderStyle(toInputValue(attrs.borderStyle));
    setBorderColor(toInputValue(attrs.borderColor));
    setBorderRadius(toInputValue(attrs.borderRadius));
    setMargin(toInputValue(attrs.margin));
    setPadding(toInputValue(attrs.padding));
  }, [
    attrs.alt,
    attrs.borderColor,
    attrs.borderRadius,
    attrs.borderStyle,
    attrs.borderWidth,
    attrs.height,
    attrs.margin,
    attrs.padding,
    attrs.title,
    attrs.width,
  ]);

  const updateAttr = useCallback((key: string, value: unknown) => {
    editor.chain().focus().updateAttributes('image', { [key]: value || null }).run();
  }, [editor]);

  const updateMultipleAttrs = useCallback((updates: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      cleaned[k] = v || null;
    }
    editor.chain().focus().updateAttributes('image', cleaned).run();
  }, [editor]);

  const setImageWidth = useCallback((w: string) => {
    editor.chain().focus().updateAttributes('image', { width: w }).run();
  }, [editor]);

  const setAlignment = useCallback((align: string | null) => {
    editor.chain().focus().updateAttributes('image', { alignment: align, float: null }).run();
  }, [editor]);

  const setFloat = useCallback((f: string | null) => {
    editor.chain().focus().updateAttributes('image', { float: f, alignment: null }).run();
  }, [editor]);

  return (
    <div className="tiptap-bubble-menu tiptap-bubble-image-enhanced">
      {/* ---- Quick Actions Panel ---- */}
      {panel === 'quick' && (
        <>
          {/* Size presets */}
          <TB onClick={() => setImageWidth('25%')} isActive={attrs.width === '25%'} title="25%">25%</TB>
          <TB onClick={() => setImageWidth('50%')} isActive={attrs.width === '50%'} title="50%">50%</TB>
          <TB onClick={() => setImageWidth('75%')} isActive={attrs.width === '75%'} title="75%">75%</TB>
          <TB onClick={() => setImageWidth('100%')} isActive={attrs.width === '100%'} title="100%">100%</TB>

          <span className="tiptap-bubble-divider" />

          {/* Alignment */}
          <TB onClick={() => setAlignment('left')} isActive={attrs.alignment === 'left'} title="Aligner à gauche">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
          </TB>
          <TB onClick={() => setAlignment('center')} isActive={attrs.alignment === 'center'} title="Centrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
          </TB>
          <TB onClick={() => setAlignment('right')} isActive={attrs.alignment === 'right'} title="Aligner à droite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
          </TB>

          <span className="tiptap-bubble-divider" />

          {/* Float */}
          <TB onClick={() => setFloat(attrs.float === 'left' ? null : 'left')} isActive={attrs.float === 'left'} title="Flottant gauche">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><line x1="14" y1="4" x2="21" y2="4"/><line x1="14" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>
          </TB>
          <TB onClick={() => setFloat(attrs.float === 'right' ? null : 'right')} isActive={attrs.float === 'right'} title="Flottant droite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="13" y="3" width="8" height="8" rx="1"/><line x1="3" y1="4" x2="10" y2="4"/><line x1="3" y1="8" x2="10" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>
          </TB>

          <span className="tiptap-bubble-divider" />

          {/* Panel toggles */}
          <TB onClick={() => setPanel('dimensions')} title="Dimensions & texte alt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l4-4 3 3 4-4 7 7"/></svg>
          </TB>
          <TB onClick={() => setPanel('style')} title="Bordure & ombre">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2"/></svg>
          </TB>
          <TB onClick={() => setPanel('advanced')} title="Marges & espacement">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </TB>

          <span className="tiptap-bubble-divider" />

          <TB onClick={() => editor.chain().focus().deleteSelection().run()} title={t('tiptap.image.delete')} className="tiptap-bubble-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </TB>
        </>
      )}

      {/* ---- Dimensions & Alt Panel ---- */}
      {panel === 'dimensions' && (
        <div className="tiptap-bubble-props">
          <div className="tiptap-bubble-props-header">
            <span>{t('tiptap.image.dimensionsText')}</span>
            <button type="button" className="tiptap-bubble-props-back" onClick={() => setPanel('quick')}>←</button>
          </div>
          <label>
            <span>{t('tiptap.image.width')}</span>
            <input type="text" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="ex: 300px, 50%" />
          </label>
          <label>
            <span>{t('tiptap.image.height')}</span>
            <input type="text" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="auto" />
          </label>
          <label>
            <span>Alt</span>
            <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={t('tiptap.image.altPlaceholder')} />
          </label>
          <label>
            <span>{t('tiptap.image.title')}</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tiptap.image.titlePlaceholder')} />
          </label>
          <div className="tiptap-bubble-props-actions">
            <button type="button" className="tiptap-bubble-props-apply" onClick={() => {
              updateMultipleAttrs({ width, height, alt, title });
              setPanel('quick');
            }}>{t('common.apply')}</button>
            <button type="button" className="tiptap-bubble-props-cancel" onClick={() => setPanel('quick')}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* ---- Border & Shadow Panel ---- */}
      {panel === 'style' && (
        <div className="tiptap-bubble-props">
          <div className="tiptap-bubble-props-header">
            <span>{t('tiptap.image.borderShadow')}</span>
            <button type="button" className="tiptap-bubble-props-back" onClick={() => setPanel('quick')}>←</button>
          </div>

          <label>
            <span>Style</span>
            <select
              value={borderStyle}
              onChange={(e) => setBorderStyle(e.target.value)}
              className="tiptap-bubble-select"
            >
              {BORDER_STYLES.map((opt) => (
                <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Épaisseur</span>
            <input type="text" value={borderWidth} onChange={(e) => setBorderWidth(e.target.value)} placeholder="ex: 2px" />
          </label>
          <label>
            <span>Couleur</span>
            <div className="tiptap-bubble-color-row">
              <input type="color" value={borderColor || '#000000'} onChange={(e) => setBorderColor(e.target.value)} className="tiptap-bubble-color-input" />
              <input type="text" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} placeholder="#000000" style={{ flex: 1 }} />
            </div>
          </label>
          <label>
            <span>Arrondi</span>
            <input type="text" value={borderRadius} onChange={(e) => setBorderRadius(e.target.value)} placeholder="ex: 8px, 50%" />
          </label>

          <div className="tiptap-bubble-props-sublabel">Ombre</div>
          <div className="tiptap-bubble-props-btn-row">
            {SHADOW_PRESETS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`tiptap-props-btn ${attrs.shadow === opt.value ? 'is-active' : ''}`}
                onClick={() => updateAttr('shadow', opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="tiptap-bubble-props-actions">
            <button type="button" className="tiptap-bubble-props-apply" onClick={() => {
              updateMultipleAttrs({ borderWidth, borderStyle, borderColor, borderRadius });
              setPanel('quick');
            }}>{t('common.apply')}</button>
            <button type="button" className="tiptap-bubble-props-cancel" onClick={() => setPanel('quick')}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* ---- Advanced (Margin/Padding) Panel ---- */}
      {panel === 'advanced' && (
        <div className="tiptap-bubble-props">
          <div className="tiptap-bubble-props-header">
            <span>{t('tiptap.image.spacing')}</span>
            <button type="button" className="tiptap-bubble-props-back" onClick={() => setPanel('quick')}>←</button>
          </div>
          <label>
            <span>Marge</span>
            <input type="text" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="ex: 8px, 0 auto" />
          </label>
          <div className="tiptap-bubble-props-btn-row">
            {[['0', '0'], ['8px', '8px'], ['16px', '16px'], ['0 auto', 'Centré']].map(([v, l]) => (
              <button key={v} type="button" className="tiptap-props-btn" onClick={() => { setMargin(v); updateAttr('margin', v); }}>
                {l === 'Centré' ? t('tiptap.image.centered') : l}
              </button>
            ))}
          </div>
          <label>
            <span>Padding</span>
            <input type="text" value={padding} onChange={(e) => setPadding(e.target.value)} placeholder="ex: 4px" />
          </label>
          <div className="tiptap-bubble-props-btn-row">
            {[['0', '0'], ['4px', '4px'], ['8px', '8px'], ['12px', '12px']].map(([v, l]) => (
              <button key={v} type="button" className="tiptap-props-btn" onClick={() => { setPadding(v); updateAttr('padding', v); }}>
                {l}
              </button>
            ))}
          </div>
          <div className="tiptap-bubble-props-actions">
            <button type="button" className="tiptap-bubble-props-apply" onClick={() => {
              updateMultipleAttrs({ margin, padding });
              setPanel('quick');
            }}>{t('common.apply')}</button>
            <button type="button" className="tiptap-bubble-props-cancel" onClick={() => setPanel('quick')}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// LINK BUBBLE (shown when cursor is in a link)
// ============================================

const LinkBubble = ({ editor, onSetLink }: { editor: Editor; onSetLink: () => void }) => {
  const { t } = useTranslation();
  const href = editor.getAttributes('link').href || '';
  return (
    <div className="tiptap-bubble-menu tiptap-bubble-link">
      <a href={href} target="_blank" rel="noopener noreferrer" className="tiptap-bubble-link-url" title={href}>
        {href.length > 40 ? href.slice(0, 40) + '…' : href}
      </a>
      <TB onClick={onSetLink} title={t('tiptap.editLink')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
      </TB>
      <TB onClick={() => editor.chain().focus().unsetLink().run()} title={t('tiptap.removeLink')} className="tiptap-bubble-danger">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
      </TB>
    </div>
  );
};

// ============================================
// TEXT BUBBLE (default: shown on text selection)
// ============================================

const TextBubble = ({ editor, onSetLink }: { editor: Editor; onSetLink: () => void }) => (
  <div className="tiptap-bubble-menu">
    <TB onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Gras">
      <strong>B</strong>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italique">
      <em>I</em>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Souligné">
      <u>U</u>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Barré">
      <s>S</s>
    </TB>
    <span className="tiptap-bubble-divider" />
    <TB onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    </TB>
    <TB onClick={onSetLink} isActive={editor.isActive('link')} title="Lien">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </TB>
    <TB onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Surligner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="m16.376 3.622 4.002 4.002-12.748 12.748H3.628v-4.002z"/></svg>
    </TB>
    <span className="tiptap-bubble-divider" />
    <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Gauche">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
    </TB>
    <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Centre">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
    </TB>
    <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Droite">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
    </TB>
  </div>
);

// ============================================
// MAIN EXPORT (context-aware)
// ============================================

export const BubbleToolbar = ({ editor, onSetLink }: BubbleToolbarProps) => {
  if (editor.isActive('image')) {
    return <ImageBubble editor={editor} />;
  }

  if (editor.isActive('link') && editor.state.selection.empty) {
    return <LinkBubble editor={editor} onSetLink={onSetLink} />;
  }

  return <TextBubble editor={editor} onSetLink={onSetLink} />;
};
