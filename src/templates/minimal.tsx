/**
 * Minimal Template Component
 * TypeScript version
 */

interface MinimalTemplateProps {
  content: string;
}

const MinimalTemplate = ({ content }: MinimalTemplateProps): JSX.Element => {
  return (
    <div className="p-8 max-w-4xl mx-auto bg-white">
      <div className="space-y-6">
        {content.split('\n\n').map((section, index) => (
          <div key={index} className="space-y-2">
            {section.split('\n').map((line, lineIndex) => {
              const isHeader = line.toUpperCase() === line && line.length > 0;
              return (
                <p key={lineIndex} className={`${isHeader ? 'text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1' : 'text-gray-800 leading-relaxed'}`}>
                  {line}
                </p>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MinimalTemplate;
