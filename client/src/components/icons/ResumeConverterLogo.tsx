/**
 * ResumeConverterLogo Component
 * TypeScript version
 */

interface ResumeConverterLogoProps {
  className?: string;
}

export default function ResumeConverterLogo({ className = "w-8 h-8" }: ResumeConverterLogoProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Document Base */}
      <path
        d="M4 4C4 2.89543 4.89543 2 6 2H14.1716C14.702 2 15.2107 2.21071 15.5858 2.58579L19.4142 6.41421C19.7893 6.78929 20 7.29799 20 7.82843V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z"
        className="fill-primary-200 dark:fill-primary-900"
      />
      {/* Conversion Arrows */}
      <path
        d="M12 7L15 10M15 10L12 13M15 10H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-600 dark:stroke-primary-400"
      />
      {/* Document Lines */}
      <path
        d="M9 16H15M9 19H13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-600/70 dark:stroke-primary-400/70"
      />
    </svg>
  );
}
