import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AboutModalMarkdownProps {
  changelogText: string;
}

const AboutModalMarkdown = ({ changelogText }: AboutModalMarkdownProps): JSX.Element => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => (
        <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2 flex items-center">
          <span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1.5">
          {children}
        </h3>
      ),
      p: ({ children }) => (
        <p className="text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">{children}</p>
      ),
      ul: ({ children }) => (
        <ul className="space-y-1.5 my-2 ml-1">{children}</ul>
      ),
      li: ({ children }) => (
        <li className="flex items-start text-gray-600 dark:text-gray-300">
          <span className="text-primary-500 mr-2 mt-0.5">&bull;</span>
          <span className="flex-1">{children}</span>
        </li>
      ),
      strong: ({ children }) => (
        <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
      ),
      em: ({ children }) => (
        <em className="italic text-gray-500 dark:text-gray-400">{children}</em>
      ),
      code: ({ children }) => (
        <code className="bg-gray-200 dark:bg-gray-700 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      ),
      a: ({ href, children }) => (
        <a
          href={href}
          className="text-primary-500 hover:text-primary-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      ),
      hr: () => (
        <hr className="my-4 border-gray-200 dark:border-gray-700" />
      ),
    }}
  >
    {changelogText}
  </ReactMarkdown>
);

export default AboutModalMarkdown;
