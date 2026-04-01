export interface Template {
  id: string;
  Name: string;
  Status?: string;
  TemplateContent?: string;
  Stylesheet?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
}

export interface Adaptation {
  id: string;
  Resume?: string[];
  Mission?: string[];
  'Resume ID'?: string;
  'Mission ID'?: string;
  'Resume Name'?: string;
  'Candidate Name'?: string;
  'Adapted Title'?: string;
  'Adapted Text'?: string;
  'Match Score'?: number;
  'Match Analysis'?: string;
  'Mission Title'?: string;
  'Mission Content'?: string;
  'Mission Client ID'?: string;
  'Mission Contact ID'?: string;
  Status?: string;
  'Created At'?: string;
  ResumeName?: string;
  ResumeTitle?: string;
  [key: string]: unknown;
}
