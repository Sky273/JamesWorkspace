import type { TFunction } from 'i18next';
import ResumeWorkflowSteps from '../ResumeWorkflowSteps';

interface ResumeAnalysisStepIndicatorProps {
  resumeId: string;
  hasImprovedText: boolean;
  onImprove: () => void;
  t: TFunction;
}

export default function ResumeAnalysisStepIndicator({
  resumeId,
  hasImprovedText,
  onImprove,
  t,
}: ResumeAnalysisStepIndicatorProps): JSX.Element {
  return (
    <ResumeWorkflowSteps
      resumeId={resumeId}
      currentStep="analysis"
      hasImprovedText={hasImprovedText}
      onImprove={onImprove}
      t={t}
    />
  );
}
