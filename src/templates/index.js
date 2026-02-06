import ModernTemplate from './modern';
import ProfessionalTemplate from './professional';
import MinimalTemplate from './minimal';

export const templates = [
  {
    id: 'modern',
    name: 'Modern',
    component: ModernTemplate,
    description: 'A clean and contemporary design with balanced spacing and modern typography.'
  },
  {
    id: 'professional',
    name: 'Professional',
    component: ProfessionalTemplate,
    description: 'A traditional layout emphasizing professionalism and clarity.'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    component: MinimalTemplate,
    description: 'A minimalist design focusing on essential information with elegant typography.'
  }
];

export const getTemplateById = (id) => templates.find(template => template.id === id);
