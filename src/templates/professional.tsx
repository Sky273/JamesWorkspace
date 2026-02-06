/**
 * Professional Template Component
 * TypeScript version
 */

interface ProfessionalTemplateProps {
  content: string;
}

const ProfessionalTemplate = ({ content }: ProfessionalTemplateProps): JSX.Element => {
  return (
    <div className="p-8 max-w-4xl mx-auto bg-white">
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{content.split('\n')[0]}</h1>
      </div>
      <div className="space-y-8">
        {content.split('\n\n').slice(1).map((section, index) => (
          <div key={index} className="space-y-3">
            {section.split('\n').map((line, lineIndex) => (
              <p key={lineIndex} className="text-gray-800 leading-relaxed font-serif">{line}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfessionalTemplate;
