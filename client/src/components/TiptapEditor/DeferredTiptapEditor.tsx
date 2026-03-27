import {
  forwardRef,
  useEffect,
  useState,
  type ComponentType,
  type RefAttributes,
} from 'react';

import type { TiptapEditorProps, TiptapEditorRef } from './TiptapEditor';

type TiptapEditorComponent = ComponentType<TiptapEditorProps & RefAttributes<TiptapEditorRef>>;

const DeferredTiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(
  ({ height = 500, className = '', ...props }, ref) => {
    const [EditorComponent, setEditorComponent] = useState<TiptapEditorComponent | null>(null);

    useEffect(() => {
      let cancelled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let idleId: number | undefined;

      const loadEditor = () => {
        import('./TiptapEditor').then((module) => {
          if (!cancelled) {
            setEditorComponent(() => module.default as TiptapEditorComponent);
          }
        });
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = (window as Window & typeof globalThis & { requestIdleCallback: typeof requestIdleCallback }).requestIdleCallback(loadEditor, { timeout: 1200 });
      } else {
        timeoutId = globalThis.setTimeout(loadEditor, 180);
      }

      return () => {
        cancelled = true;
        if (typeof idleId === 'number' && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          (window as Window & typeof globalThis & { cancelIdleCallback: typeof cancelIdleCallback }).cancelIdleCallback(idleId);
        }
        if (timeoutId !== undefined) {
          globalThis.clearTimeout(timeoutId);
        }
      };
    }, []);

    if (!EditorComponent) {
      return (
        <div
          className={['overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900', className]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div
            className="flex items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950/50 dark:text-slate-400"
            style={{ minHeight: height }}
          >
            Chargement de l'editeur...
          </div>
        </div>
      );
    }

    return <EditorComponent ref={ref} height={height} className={className} {...props} />;
  }
);

DeferredTiptapEditor.displayName = 'DeferredTiptapEditor';

export default DeferredTiptapEditor;
