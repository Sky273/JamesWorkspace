import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatbotMarkdownProps {
  content: string;
}

export default function ChatbotMarkdown({ content }: ChatbotMarkdownProps) {
  return (
    <div className="chatbot-markdown text-sm leading-6 text-slate-700 dark:text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-primary-600 dark:text-primary-300">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="my-2 list-none space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-inside list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => (
            <li className="flex items-start">
              <span className="mr-2 text-primary-500 dark:text-primary-300">•</span>
              <span className="min-w-0 flex-1">{children}</span>
            </li>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary-700 dark:bg-primary-500/18 dark:text-primary-200">
                  {children}
                </code>
              );
            }
            return (
              <code className="my-2 block overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100 dark:bg-slate-950">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100 dark:bg-slate-950">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-primary-500 pl-3 italic text-slate-600 dark:text-slate-300">{children}</blockquote>,
          a: ({ href, children }) => (
            <a href={href} className="font-semibold text-primary-600 hover:underline dark:text-primary-300" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="mb-2 text-base font-bold text-slate-950 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-sm font-bold text-slate-950 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold text-slate-950 dark:text-white">{children}</h3>,
          hr: () => <hr className="my-2 border-slate-200 dark:border-slate-700" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-slate-200 bg-slate-100 px-2 py-1 text-left font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white">{children}</th>,
          td: ({ children }) => <td className="border border-slate-200 px-2 py-1 dark:border-slate-600">{children}</td>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
