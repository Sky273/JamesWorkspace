/**
 * Email Template Visual Editor
 * Block-based editor for creating email templates without writing MJML code
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowUpIcon, 
  ArrowDownIcon,
  DocumentTextIcon,
  UserIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  TagIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { EmailTemplateKeywords } from '../../types/entities';

interface EditorBlock {
  id: string;
  type: 'logo' | 'header' | 'paragraph' | 'signature' | 'footer';
  content: string;
}

interface EmailTemplateEditorProps {
  initialMjml?: string;
  subjectTemplate: string;
  onSubjectChange: (subject: string) => void;
  onMjmlChange: (mjml: string) => void;
  keywords?: EmailTemplateKeywords;
}

const BLOCK_TYPES = [
  { type: 'logo', label: 'Logo', icon: PhotoIcon },
  { type: 'header', label: 'En-tête', icon: DocumentTextIcon },
  { type: 'paragraph', label: 'Paragraphe', icon: DocumentTextIcon },
  { type: 'signature', label: 'Signature', icon: UserIcon },
  { type: 'footer', label: 'Pied de page', icon: DocumentTextIcon }
] as const;

const KEYWORD_CATEGORIES = [
  { key: 'client', label: 'Client', icon: BuildingOfficeIcon },
  { key: 'contact', label: 'Contact', icon: UserIcon },
  { key: 'resume', label: 'CV', icon: DocumentTextIcon },
  { key: 'firm', label: 'Cabinet', icon: BuildingOfficeIcon },
  { key: 'user', label: 'Utilisateur', icon: UserIcon },
  { key: 'date', label: 'Date', icon: CalendarIcon }
] as const;

const DEFAULT_BLOCKS: EditorBlock[] = [
  { id: '1', type: 'header', content: '{{firm.name}}' },
  { id: '2', type: 'paragraph', content: 'Bonjour {{contact.firstName}},' },
  { id: '3', type: 'paragraph', content: 'Je me permets de vous adresser le profil de {{resume.name}}, {{resume.title}}, qui pourrait correspondre à vos besoins.' },
  { id: '4', type: 'paragraph', content: 'Vous trouverez son CV en pièce jointe (version {{resume.version}}).' },
  { id: '5', type: 'paragraph', content: 'Je reste à votre disposition pour organiser un échange.' },
  { id: '6', type: 'signature', content: 'Cordialement,\n{{user.name}}\n{{firm.name}}' },
  { id: '7', type: 'footer', content: '{{date.todayLong}}' }
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function parseMjmlToBlocks(mjml: string): EditorBlock[] {
  if (!mjml || mjml.trim() === '') {
    return DEFAULT_BLOCKS;
  }
  
  const blocks: EditorBlock[] = [];
  
  // First, detect mj-image tags for logo blocks
  const imageRegex = /<mj-image[^>]*src="[^"]*\{\{firm\.logo\}\}"[^>]*\/>/g;
  let imageMatch;
  while ((imageMatch = imageRegex.exec(mjml)) !== null) {
    blocks.push({
      id: generateId(),
      type: 'logo',
      content: '{{firm.logo}}'
    });
  }
  
  // Then, extract text content from mj-text tags
  const textRegex = /<mj-text[^>]*>([\s\S]*?)<\/mj-text>/g;
  let match;
  let index = 0;
  
  while ((match = textRegex.exec(mjml)) !== null) {
    const content = match[1]
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    if (content) {
      let type: EditorBlock['type'] = 'paragraph';
      
      // Detect block type based on content or position
      if (index === 0 && content.includes('{{firm.name}}') && blocks.length === 0) {
        type = 'header';
      } else if (index === 0 && content.includes('{{firm.name}}') && blocks.length > 0) {
        // If we already have a logo block, this is a header
        type = 'header';
      } else if (content.includes('Cordialement') || content.includes('{{user.name}}')) {
        type = 'signature';
      } else if (content.includes('{{date.')) {
        type = 'footer';
      }
      
      blocks.push({
        id: generateId(),
        type,
        content
      });
      index++;
    }
  }
  
  return blocks.length > 0 ? blocks : DEFAULT_BLOCKS;
}

function blocksToMjml(blocks: EditorBlock[]): string {
  const sections = blocks.map(block => {
    // Handle logo block separately
    if (block.type === 'logo') {
      return `        <mj-image src="{{firm.logo}}" alt="{{firm.name}}" width="150px" align="center" padding-bottom="20px" />`;
    }
    
    let styles = '';
    let content = block.content.replace(/\n/g, '<br/>');
    
    switch (block.type) {
      case 'header':
        styles = 'align="center" font-size="24px" font-weight="bold" color="#1f2937"';
        break;
      case 'signature':
        styles = 'padding-top="30px"';
        content = content.split('<br/>').map((line, i) => 
          i === 1 ? `<strong>${line}</strong>` : line
        ).join('<br/>');
        break;
      case 'footer':
        styles = 'align="center" font-size="12px" color="#9ca3af"';
        break;
      default:
        styles = 'padding-top="20px"';
    }
    
    // Wrap keywords in strong tags for visibility
    content = content.replace(/\{\{([^}]+)\}\}/g, '<strong>{{$1}}</strong>');
    
    return `        <mj-text ${styles}>${content}</mj-text>`;
  }).join('\n');

  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
${sections}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

const EmailTemplateEditor = ({
  initialMjml,
  subjectTemplate,
  onSubjectChange,
  onMjmlChange,
  keywords
}: EmailTemplateEditorProps): JSX.Element => {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => 
    parseMjmlToBlocks(initialMjml || '')
  );
  const [showKeywordMenu, setShowKeywordMenu] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('client');

  // Update MJML when blocks change
  useEffect(() => {
    const mjml = blocksToMjml(blocks);
    onMjmlChange(mjml);
  }, [blocks, onMjmlChange]);

  const addBlock = useCallback((type: EditorBlock['type']) => {
    let defaultContent = '';
    switch (type) {
      case 'logo':
        defaultContent = '{{firm.logo}}';
        break;
      case 'header':
        defaultContent = '{{firm.name}}';
        break;
      default:
        defaultContent = '';
    }
    const newBlock: EditorBlock = {
      id: generateId(),
      type,
      content: defaultContent
    };
    setBlocks(prev => [...prev, newBlock]);
  }, []);

  const updateBlock = useCallback((id: string, content: string) => {
    setBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, content } : block
    ));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(block => block.id !== id));
  }, []);

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const index = prev.findIndex(block => block.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newBlocks = [...prev];
      [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
      return newBlocks;
    });
  }, []);

  const insertKeyword = useCallback((blockId: string, keyword: string) => {
    const textarea = document.querySelector(`textarea[data-block-id="${blockId}"]`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = blocks.find(b => b.id === blockId)?.content || '';
      const newContent = currentContent.substring(0, start) + `{{${keyword}}}` + currentContent.substring(end);
      updateBlock(blockId, newContent);
      
      // Reset cursor position after React re-render
      setTimeout(() => {
        textarea.focus();
        const newPos = start + keyword.length + 4;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
    setShowKeywordMenu(null);
  }, [blocks, updateBlock]);

  const getBlockTypeLabel = (type: EditorBlock['type']) => {
    const found = BLOCK_TYPES.find(bt => bt.type === type);
    return found?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* Subject Template */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('emailTemplates.subjectLabel')}
        </label>
        <div className="relative">
          <input
            type="text"
            value={subjectTemplate}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Candidature - {{resume.name}} - {{resume.title}}"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => setShowKeywordMenu(showKeywordMenu === 'subject' ? null : 'subject')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-500"
            title={t('emailTemplates.insertKeyword')}
          >
            <TagIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Blocks Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('emailTemplates.contentLabel')}
        </label>
        
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div 
              key={block.id}
              className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              {/* Block Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {getBlockTypeLabel(block.type)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, 'down')}
                    disabled={index === blocks.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowDownIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKeywordMenu(showKeywordMenu === block.id ? null : block.id)}
                    className="p-1 text-gray-400 hover:text-indigo-500"
                    title={t('emailTemplates.insertKeyword')}
                  >
                    <TagIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Block Content */}
              {block.type === 'logo' ? (
                <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="text-center">
                    <PhotoIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('emailTemplates.logoPlaceholder')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {'{{firm.logo}}'}
                    </p>
                  </div>
                </div>
              ) : (
                <textarea
                  data-block-id={block.id}
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  rows={block.type === 'signature' ? 4 : 2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder={t('emailTemplates.blockPlaceholder')}
                />
              )}

              {/* Keyword Menu */}
              {showKeywordMenu === block.id && keywords && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[280px]">
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {KEYWORD_CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSelectedCategory(cat.key)}
                        className={`px-2 py-1 text-xs rounded ${
                          selectedCategory === cat.key
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(keywords[selectedCategory as keyof EmailTemplateKeywords] || []).map(kw => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => insertKeyword(block.id, `${selectedCategory}.${kw}`)}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900"
                      >
                        {`{{${selectedCategory}.${kw}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Block Buttons */}
        <div className="flex gap-2 mt-4">
          {BLOCK_TYPES.map(bt => (
            <button
              key={bt.type}
              type="button"
              onClick={() => addBlock(bt.type)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <PlusIcon className="w-4 h-4" />
              {bt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
