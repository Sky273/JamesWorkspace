export interface Deal {
  id: string;
  title: string;
  description?: string;
  status?: string;
  client_id?: string;
  client_name?: string;
  firm_id?: string;
  created_at?: string;
}

export type ClientType = 'client' | 'prospect';
export type ClientStatus = 'active' | 'inactive';
export type SubmissionStatus = 'sent' | 'viewed' | 'rejected' | 'accepted' | 'pending';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  firm_id?: string;
  firmId?: string;
  status?: ClientStatus;
  address?: string;
  website?: string;
  industry?: string;
  notes?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  created_by?: string;
  firm_name?: string;
  contacts_count?: number;
  submissions_count?: number;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ResumeSubmission {
  id: string;
  resume_id: string;
  client_id: string;
  contact_id: string;
  mission_id?: string;
  firm_id: string;
  sent_at: string;
  sent_by?: string;
  notes?: string;
  status: SubmissionStatus;
  version_number?: number;
  created_at?: string;
  resume_name?: string;
  resume_title?: string;
  client_name?: string;
  client_type?: ClientType;
  contact_name?: string;
  contact_email?: string;
  mission_title?: string;
  sent_by_name?: string;
  firm_name?: string;
}

export interface ClientFormData {
  name: string;
  type: ClientType;
  status: ClientStatus;
  address?: string;
  website?: string;
  industry?: string;
  notes?: string;
}

export interface ContactFormData {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
}

export interface SubmissionFormData {
  resume_id: string;
  client_id: string;
  contact_id: string;
  mission_id?: string;
  notes?: string;
  sent_at?: string;
  status?: SubmissionStatus;
}

export type EmailTemplateStatus = 'active' | 'inactive';

export interface EmailTemplate {
  id: string;
  firm_id?: string;
  firm_name?: string;
  name: string;
  description?: string;
  subject_template: string;
  mjml_content: string;
  html_content?: string;
  is_system: boolean;
  is_default: boolean;
  status: EmailTemplateStatus;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmailTemplateFormData {
  name: string;
  description?: string;
  subjectTemplate: string;
  mjmlContent: string;
  isDefault?: boolean;
}

export interface EmailTemplateContext {
  client?: {
    name?: string;
    type?: string;
    industry?: string;
  };
  contact?: {
    name?: string;
    role?: string;
  };
  resume?: {
    name?: string;
    title?: string;
    version?: number;
  };
  firm?: {
    name?: string;
    logo?: string;
  };
  user?: {
    name?: string;
    email?: string;
    jobTitle?: string;
    phone?: string;
  };
}

export interface EmailTemplateKeywords {
  client: string[];
  contact: string[];
  resume: string[];
  firm: string[];
  user: string[];
  date: string[];
}
