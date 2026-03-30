import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatbotMarkdownProps {
  content: string;
}

export default function ChatbotMarkdown({ content }: ChatbotMarkdownProps) {
  return (
    <div className="text-sm chatbot-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-primary-600 dark:text-primary-400">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-none space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
          li: ({ children }) => (
            <li className="flex items-start">
              <span className="text-primary-500 mr-2">•</span>
              <span className="flex-1">{children}</span>
            </li>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-200 dark:bg-gray-600 text-primary-600 dark:text-primary-300 px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-gray-800 text-gray-100 p-2 rounded text-xs font-mono my-2 overflow-x-auto">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs font-mono my-2 overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-primary-500 pl-3 my-2 italic text-gray-600 dark:text-gray-300">{children}</blockquote>,
          a: ({ href, children }) => (
            <a href={href} className="text-primary-500 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="text-base font-bold mb-2 text-primary-600 dark:text-primary-400">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mb-2 text-primary-600 dark:text-primary-400">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-primary-600 dark:text-primary-400">{children}</h3>,
          hr: () => <hr className="my-2 border-gray-300 dark:border-gray-600" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-200 dark:bg-gray-600 font-semibold text-left">{children}</th>,
          td: ({ children }) => <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{children}</td>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
