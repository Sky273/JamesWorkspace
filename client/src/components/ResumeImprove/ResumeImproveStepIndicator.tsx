import type { TFunction } from 'i18next';
import ResumeWorkflowSteps from '../ResumeWorkflowSteps';

interface ResumeImproveStepIndicatorProps {
  resumeId: string;
  hasImprovedText: boolean;
  t: TFunction;
}

export default function ResumeImproveStepIndicator({
  resumeId,
  hasImprovedText,
  t,
}: ResumeImproveStepIndicatorProps): JSX.Element {
  return (
    <ResumeWorkflowSteps
      resumeId={resumeId}
      currentStep="improve"
      hasImprovedText={hasImprovedText}
      t={t}
    />
  );
}
