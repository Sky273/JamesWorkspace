/**
 * Modern Template Component
 * TypeScript version
 */

interface ModernTemplateProps {
  content?: string;
}

const ModernTemplate = ({ content = '' }: ModernTemplateProps): JSX.Element => {
  if (!content) {
    return <div className="p-8 max-w-4xl mx-auto bg-white">No content available</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white">
      <div className="space-y-6">
        {content.split('\n\n').map((section, index) => (
          <div key={index} className="space-y-2">
            {section.split('\n').map((line, lineIndex) => (
              <p key={lineIndex} className="text-gray-800 leading-relaxed">{line}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModernTemplate;
