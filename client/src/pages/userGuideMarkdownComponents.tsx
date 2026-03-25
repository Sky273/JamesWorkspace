import type { Components } from 'react-markdown';

export const userGuideMarkdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-blue-500 pb-3 mb-6 mt-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4 flex items-center">
      <span className="w-1 h-6 bg-blue-500 rounded mr-3"></span>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-6 mb-3">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-base font-medium text-gray-600 dark:text-gray-400 mt-4 mb-2">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="space-y-2 mb-4 ml-4">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-2 mb-4 ml-4 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="text-gray-600 dark:text-gray-400 flex items-start">
      <span className="text-blue-500 mr-2 mt-1.5">•</span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }

    return <code className={className}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 text-sm font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-3 my-4 rounded-r-lg">
      <div className="text-blue-800 dark:text-blue-300 italic">{children}</div>
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6">
      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-200 dark:divide-gray-600">{children}</tbody>,
  tr: ({ children }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-600">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{children}</td>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-t-2 border-gray-200 dark:border-gray-700" />,
};
