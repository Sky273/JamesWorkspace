import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readStyle = (fileName: string): string =>
  readFileSync(resolve(__dirname, fileName), 'utf8');

describe('soft dark palette styles', () => {
  it('defines the global dark theme from the compact anthracite palette', () => {
    const variables = readStyle('_variables.css');

    expect(variables).toContain('--app-bg: #181b20');
    expect(variables).toContain('--surface-primary: #22262e');
    expect(variables).toContain('--surface-muted: #2a2f38');
    expect(variables).toContain('--border-subtle: #343a46');
    expect(variables).toContain('--text-primary: #f4f5f7');
  });

  it('keeps migrated shells on the same soft dark surfaces', () => {
    expect(readStyle('editorialPages.css')).toContain('--cv-surface-base-start: #181b20');
    expect(readStyle('resumesEditorial.css')).toContain('--cv-bg: #181b20');
  });

  it('keeps direct CVtheque loads dark against global important shell defaults', () => {
    const resumesEditorial = readStyle('resumesEditorial.css');

    expect(resumesEditorial).toContain('.dark .resumes-editorial-shell .cv-surface');
    expect(resumesEditorial).toContain('background: #181b20 !important');
    expect(resumesEditorial).toContain('background: #22262e !important');
    expect(resumesEditorial).toContain('border-color: #343a46 !important');
  });

  it('highlights active dark tabs with the usual violet accent', () => {
    const base = readStyle('_base.css');
    const editorialPages = readStyle('editorialPages.css');
    const resumesEditorial = readStyle('resumesEditorial.css');

    expect(base).toContain(
      '.dark .editorial-migrated-shell button.segmented-control__item.segmented-control__item--active[type="button"]'
    );
    expect(base).toContain('background: #7c5cff');
    expect(editorialPages).toContain(
      ".dark .editorial-migrated-shell button.segmented-control__item.segmented-control__item--active[type='button']"
    );
    expect(editorialPages).toContain('background: #7c5cff !important');
    expect(resumesEditorial).toContain(
      ".dark .resumes-editorial-shell button.segmented-control__item.segmented-control__item--active[type='button']"
    );
    expect(resumesEditorial).toContain('background: #7c5cff !important');
  });

  it('keeps tag administration cards and chips dark', () => {
    const base = readStyle('_base.css');

    expect(base).toContain('.dark .tags-management-shell .tags-stat-card');
    expect(base).toContain('.dark .tags-management-shell .tags-category-card');
    expect(base).toContain('.dark .tags-management-shell .tags-chip');
    expect(base).toContain('background: #151b2a !important');
  });

  it('keeps the France map card header dark in editorial shells', () => {
    const base = readStyle('_base.css');

    expect(base).toContain('.dark .editorial-migrated-shell .france-map-card-header');
    expect(base).toContain('.dark .editorial-migrated-shell .france-map-card');
    expect(base).toContain('border-color: #343a46 !important');
  });

  it('keeps profile matching fields dark in editorial shells', () => {
    const base = readStyle('_base.css');

    expect(base).toContain('.dark .profile-matching-shell .profile-matching-field');
    expect(base).toContain('.dark .profile-matching-shell .profile-matching-field:focus');
    expect(base).toContain('background: #151b2a !important');
  });

  it('keeps email template card titles readable in dark mode', () => {
    const base = readStyle('_base.css');
    const page = readStyle('../pages/admin/EmailTemplatesPage.tsx');
    const sections = readStyle('../pages/admin/EmailTemplatesPage.sections.tsx');

    expect(page).toContain('email-templates-shell');
    expect(sections).toContain('email-template-card-title');
    expect(base).toContain('.dark .email-templates-shell .email-template-card-title');
    expect(base).toContain('color: #f4f5f7 !important');
  });

  it('keeps CRM client type badges dark in dark mode', () => {
    const base = readStyle('_base.css');
    const clientsComponents = readStyle('../pages/ClientsPage.components.tsx');

    expect(clientsComponents).toContain('crm-client-type-badge');
    expect(base).toContain('.dark .crm-compact-shell .crm-client-type-badge--prospect');
    expect(base).toContain('.dark .crm-compact-shell .crm-client-type-badge--client');
    expect(base).toContain('background: rgba(124, 92, 255, 0.16) !important');
  });

  it('keeps CRM stats tiles and icons dark in dark mode', () => {
    const base = readStyle('_base.css');
    const clientsComponents = readStyle('../pages/ClientsPage.components.tsx');

    expect(clientsComponents).toContain('crm-stat-card');
    expect(clientsComponents).toContain('crm-stat-icon');
    expect(base).toContain('.dark .crm-compact-shell .crm-stat-card');
    expect(base).toContain('.dark .crm-compact-shell .crm-stat-icon--prospects');
    expect(base).toContain('.dark .crm-compact-shell .crm-stat-icon--submissions');
    expect(base).toContain('background: #22262e !important');
  });

  it('keeps the global icon system scoped to actual icons', () => {
    const base = readStyle('_base.css');
    const chatbotWindow = readStyle('../components/chatbot/ChatbotWindow.tsx');

    expect(base).not.toContain('[class*="icon-"]');
    expect(base).toContain('svg[data-slot="icon"]');
    expect(base).toContain('svg[data-slot="icon"][fill="none"]');
    expect(base).toContain('stroke: currentColor');
    expect(chatbotWindow).not.toContain('[stroke:white]');
    expect(chatbotWindow).not.toContain('[&_svg]');
  });

  it('keeps CRM client toolbar actions aligned with the type tabs', () => {
    const base = readStyle('_base.css');
    const clientsComponents = readStyle('../pages/ClientsPage.components.tsx');

    expect(clientsComponents).toContain('crm-clients-type-toggle');
    expect(clientsComponents).toContain('crm-clients-toolbar-actions');
    expect(clientsComponents).toContain('items-start justify-between');
    expect(base).toContain('.crm-compact-shell .crm-clients-toolbar-actions');
    expect(base).toContain('align-items: flex-start');
    expect(base).toContain('min-height: 3rem');
  });

  it('keeps CRM deal status badges dark in dark mode', () => {
    const base = readStyle('_base.css');
    const dealCard = readStyle('../components/CRM/DealCard.tsx');

    expect(dealCard).toContain('crm-deal-status-badge');
    expect(base).toContain('.dark .crm-compact-shell .crm-deal-status-badge--open');
    expect(base).toContain('.dark .crm-compact-shell .crm-deal-status-badge--won');
    expect(base).toContain('.dark .crm-compact-shell .crm-deal-status-badge--on_hold');
    expect(base).toContain('background: rgba(124, 92, 255, 0.16) !important');
  });

  it('keeps CV library candidate names readable in dark mode', () => {
    const base = readStyle('_base.css');
    const resumesEditorial = readStyle('resumesEditorial.css');
    const dealResumeCard = readStyle('../components/ResumesPage/DealResumeCard.tsx');

    expect(dealResumeCard).toContain('cv-library-candidate-name');
    expect(base).toContain('.dark .cv-resume-row .cv-library-candidate-name');
    expect(resumesEditorial).toContain('.dark .resumes-editorial-shell .cv-resume-row .cv-library-candidate-name');
    expect(base).toContain('color: #f4f5f7 !important');
    expect(resumesEditorial).toContain('color: #f4f5f7 !important');
  });

  it('keeps mission card titles readable in dark mode', () => {
    const base = readStyle('_base.css');
    const editorialPages = readStyle('editorialPages.css');
    const missionParts = readStyle('../components/MissionsPage/MissionsDealsGroupedView.parts.tsx');

    expect(missionParts).toContain('mission-card-title');
    expect(base).toContain('.dark .mission-card-title');
    expect(editorialPages).toContain('.dark .missions-editorial-shell .mission-card-title');
    expect(base).toContain('color: #f4f5f7 !important');
    expect(editorialPages).toContain('color: #f4f5f7 !important');
  });

  it('keeps batch jobs server info panel dark in dark mode', () => {
    const base = readStyle('_base.css');
    const jobsHeader = readStyle('../components/BatchUpload/jobsTab/JobsTabHeader.tsx');

    expect(jobsHeader).toContain('batch-jobs-server-info');
    expect(base).toContain('.dark .batch-jobs-server-info');
    expect(base).toContain('background: #151b2a !important');
  });

  it('keeps security logs surfaces and badges dark in dark mode', () => {
    const base = readStyle('_base.css');
    const page = readStyle('../pages/SecurityLogs.tsx');
    const sections = readStyle('../pages/SecurityLogs.sections.tsx');

    expect(page).toContain('security-logs-shell');
    expect(sections).toContain('security-logs-stat-card');
    expect(sections).toContain('security-logs-filters-panel');
    expect(sections).toContain('security-logs-table-panel');
    expect(sections).toContain('security-logs-badge');
    expect(base).toContain('.dark .security-logs-shell .security-logs-stat-card');
    expect(base).toContain('.dark .security-logs-shell .security-logs-filters-panel');
    expect(base).toContain('.dark .security-logs-shell .security-logs-table-panel');
    expect(base).toContain('.dark .security-logs-shell .security-logs-badge');
    expect(base).toContain('background: #22262e !important');
  });

  it('keeps GDPR audit surfaces and badges dark in dark mode', () => {
    const base = readStyle('_base.css');
    const page = readStyle('../pages/GdprAuditPage.tsx');
    const stats = readStyle('../components/GdprAudit/GdprAuditStatsGrid.tsx');
    const filters = readStyle('../components/GdprAudit/GdprAuditFiltersPanel.tsx');
    const table = readStyle('../components/GdprAudit/GdprAuditLogsTable.tsx');
    const pagination = readStyle('../components/GdprAudit/GdprAuditPagination.tsx');

    expect(page).toContain('gdpr-audit-shell');
    expect(stats).toContain('gdpr-audit-stat-card');
    expect(filters).toContain('gdpr-audit-filters-panel');
    expect(filters).toContain('gdpr-audit-field');
    expect(table).toContain('gdpr-audit-table-head');
    expect(table).toContain('gdpr-audit-badge');
    expect(pagination).toContain('gdpr-audit-pagination');
    expect(base).toContain('.dark .gdpr-audit-shell .gdpr-audit-stat-card');
    expect(base).toContain('.dark .gdpr-audit-shell .gdpr-audit-filters-panel');
    expect(base).toContain('.dark .gdpr-audit-shell .gdpr-audit-badge');
    expect(base).toContain('background: #22262e !important');
  });

  it('keeps the selected user guide navigation item violet in dark mode', () => {
    const base = readStyle('_base.css');
    const page = readStyle('../pages/UserGuidePage.tsx');

    expect(page).toContain('user-guide-shell');
    expect(page).toContain('user-guide-nav-item--active');
    expect(base).toContain('.dark .user-guide-shell .user-guide-nav-item--active');
    expect(base).toContain('background: #7c5cff !important');
  });

  it('keeps user guide headings readable in dark mode', () => {
    const base = readStyle('_base.css');
    const page = readStyle('../pages/UserGuidePage.tsx');

    expect(page).toContain('user-guide-content');
    expect(base).toContain('.dark .user-guide-shell .cv-page-heading h1');
    expect(base).toContain('.dark .user-guide-shell .user-guide-content :is(h2, h3, h4, h5, h6)');
    expect(base).toContain('color: #f4f5f7 !important');
  });

  it('keeps user management role badges dark in dark mode', () => {
    const base = readStyle('_base.css');
    const page = readStyle('../pages/UsersManagement.tsx');
    const sections = readStyle('../pages/UsersManagement.sections.tsx');

    expect(page).toContain('users-management-shell');
    expect(sections).toContain('users-management-role-badge');
    expect(sections).toContain('users-management-role-badge--admin');
    expect(sections).toContain('users-management-role-badge--local-admin');
    expect(sections).toContain('users-management-role-badge--user');
    expect(base).toContain('.dark .users-management-shell .users-management-role-badge');
    expect(base).toContain('.dark .users-management-shell .users-management-role-badge--admin');
    expect(base).toContain('background: rgba(124, 92, 255, 0.16) !important');
  });

  it('keeps common legacy neutral text utilities readable in dark mode', () => {
    const base = readStyle('_base.css');

    expect(base).toContain(
      '.dark :is(.text-black, .text-slate-950, .text-slate-900, .text-gray-950, .text-gray-900, .text-zinc-950, .text-zinc-900, .text-neutral-950, .text-neutral-900)'
    );
    expect(base).toContain('color: var(--text-primary) !important');
    expect(base).toContain(
      '.dark :is(.text-slate-800, .text-slate-700, .text-gray-800, .text-gray-700, .text-zinc-800, .text-zinc-700, .text-neutral-800, .text-neutral-700)'
    );
    expect(base).toContain('color: var(--text-secondary) !important');
    expect(base).toContain(
      '.dark :is(.text-slate-600, .text-slate-500, .text-gray-600, .text-gray-500, .text-zinc-600, .text-zinc-500, .text-neutral-600, .text-neutral-500)'
    );
    expect(base).toContain('color: var(--text-muted) !important');
  });

  it('keeps legacy arbitrary dark text colors readable in dark mode', () => {
    const base = readStyle('_base.css');

    expect(base).toContain('[class*="text-[#18181b]"]');
    expect(base).toContain('[class*="text-[#101828]"]');
    expect(base).toContain('[class*="text-[#13213f]"]');
    expect(base).toContain('[class*="text-[#1a1635]"]');
    expect(base).toContain('color: var(--text-primary) !important');
  });

  it('keeps dark shell headings and field labels readable across screens', () => {
    const base = readStyle('_base.css');

    expect(base).toContain(
      '.dark :is(.editorial-migrated-shell, .resumes-editorial-shell, .missions-editorial-shell, .crm-compact-shell, .profile-matching-shell, .tags-management-shell, .email-templates-shell, .security-logs-shell, .gdpr-audit-shell, .user-guide-shell, .users-management-shell)'
    );
    expect(base).toContain(':is(h1, h2, h3, h4, h5, h6, .cv-display, .page-title, .section-title, .card-title)');
    expect(base).toContain('color: #f4f5f7 !important');
    expect(base).toContain(':is(label, .cv-kicker, .field-label, .form-label, .card-label)');
    expect(base).toContain('color: #c4cad4 !important');
  });

  it('keeps breadcrumbs readable in dark mode', () => {
    const base = readStyle('_base.css');
    const breadcrumbs = readStyle('../components/Breadcrumbs.tsx');

    expect(breadcrumbs).toContain('app-breadcrumbs');
    expect(breadcrumbs).toContain('app-breadcrumbs__link');
    expect(breadcrumbs).toContain('app-breadcrumbs__current');
    expect(breadcrumbs).toContain('app-breadcrumbs__separator');
    expect(base).toContain('.dark .app-breadcrumbs .app-breadcrumbs__link');
    expect(base).toContain('.dark .app-breadcrumbs .app-breadcrumbs__current');
    expect(base).toContain('.dark .app-breadcrumbs .app-breadcrumbs__separator');
    expect(base).toContain('color: #c4cad4 !important');
    expect(base).toContain('color: #f4f5f7 !important');
  });

  it('keeps pagination components readable in dark mode', () => {
    const base = readStyle('_base.css');
    const pagination = readStyle('../components/Pagination.tsx');
    const gdprPagination = readStyle('../components/GdprAudit/GdprAuditPagination.tsx');
    const dealsTab = readStyle('../components/CRM/DealsTab.tsx');

    expect(pagination).toContain('app-pagination section-shell');
    expect(pagination).toContain('app-pagination__controls');
    expect(gdprPagination).toContain('app-pagination gdpr-audit-pagination');
    expect(dealsTab).toContain('app-pagination app-pagination__controls');
    expect(base).toContain('.dark .app-pagination');
    expect(base).toContain('.dark .app-pagination .app-button-secondary');
    expect(base).toContain('.dark .app-pagination .app-button-primary');
    expect(base).toContain('background: #2a2f38 !important');
    expect(base).toContain('color: #f4f5f7 !important');
  });

  it('keeps injected resume HTML previews readable in dark mode', () => {
    const base = readStyle('_base.css');
    const compareTab = readStyle('../components/ResumeAnalysis/CompareTab.tsx');
    const exportTab = readStyle('../components/ResumeAnalysis/ExportTab.tsx');

    expect(compareTab).toContain('resume-html-preview');
    expect(exportTab).toContain('resume-html-preview');
    expect(base).toContain('.dark .resume-html-preview');
    expect(base).toContain('.dark .resume-html-preview :is(p, li, div, span, strong, em, td, th, blockquote)');
    expect(base).toContain('.dark .resume-html-preview :is(h1, h2, h3, h4, h5, h6)');
    expect(base).toContain('color: #c4cad4 !important');
    expect(base).toContain('color: #f4f5f7 !important');
  });

  it('keeps Tiptap editor text readable in dark mode even with imported inline colors', () => {
    const tiptap = readStyle('../components/TiptapEditor/TiptapEditor.css');

    expect(tiptap).toContain('.dark .tiptap-editor-content .tiptap :is(p, li, div, span, strong, em)');
    expect(tiptap).toContain('.dark .tiptap-editor-content .tiptap :is(h1, h2, h3, h4, h5, h6)');
    expect(tiptap).toContain('.dark .tiptap-editor-content .tiptap :is(h1, h2, h3, h4, h5, h6) *');
    expect(tiptap).toContain('color: #e5e7eb !important');
    expect(tiptap).toContain('color: #f4f5f7 !important');
  });

  it('applies the soft dark palette to app chrome', () => {
    const base = readStyle('_base.css');

    expect(readStyle('../components/HeaderActions.tsx')).toContain('packageJson.version');
    expect(readStyle('../components/HeaderActions.tsx')).toContain('app-header-actions__text-control');
    expect(readStyle('../components/HeaderActions.tsx')).toContain('app-header-actions__version');
    expect(readStyle('../components/HeaderActions.tsx')).toContain('dark:text-white');
    expect(readStyle('../components/LanguageSelector.tsx')).toContain('app-header-actions__language');
    expect(readStyle('../components/LanguageSelector.tsx')).toContain('dark:text-white');
    expect(base).toContain('.dark .app-header-actions .app-header-actions__text-control');
    expect(base).toContain('.dark .app-header-actions .app-header-actions__language');
    expect(base).toContain('.dark .app-header-actions .app-header-actions__version');
    expect(base).toContain('-webkit-text-fill-color: #ffffff !important');
    expect(readStyle('../components/HeaderActions.tsx')).toContain('InformationCircleIcon');
    expect(readStyle('../components/HeaderActions.tsx')).toContain('MoonIcon');
    expect(readStyle('../components/HeaderActions.tsx')).toContain('SunIcon');
    expect(readStyle('../components/HeaderActions.tsx')).not.toContain('ComputerDesktopIcon');
    expect(readStyle('../components/HeaderActions.tsx')).not.toContain('Cog6ToothIcon');
    expect(readStyle('../components/HeaderActions.tsx')).not.toContain('navigation.settings');
    expect(readStyle('../components/HeaderActions.tsx')).not.toContain('common.about');
    expect(readStyle('../components/Layout.tsx')).toContain('HeaderActions');
    expect(readStyle('../components/Layout.tsx')).toContain('dark:bg-[#22262e]');
    expect(readStyle('../components/Layout.tsx')).toContain('dark:border-[#343a46]');
    expect(readStyle('../components/Footer.tsx')).toContain('dark:bg-[#22262e]');
    expect(readStyle('../components/Footer.tsx')).toContain('dark:text-[#f4f5f7]');
  });

  it('keeps off switches visible in light mode', () => {
    const base = readStyle('_base.css');
    const editorial = readStyle('editorialPages.css');

    expect(base).toContain('button.settings-switch[type="button"]');
    expect(base).toContain('border: 1px solid #64748b');
    expect(base).toContain('background: #cbd5e1');
    expect(base).toContain('background: #94a3b8');
    expect(base).toContain('border-color: #64748b');
    expect(base).not.toContain('button.settings-switch[type="button"] {\n  position: relative;\n  display: inline-flex;\n  width: 2.75rem;\n  height: 1.5rem;\n  flex-shrink: 0;\n  align-items: center;\n  padding: 0;\n  border: 2px solid transparent;');
    expect(editorial).toContain(".editorial-migrated-shell button[type='button']");
    expect(editorial).toContain(".editorial-migrated-shell button.settings-switch[type='button']");
    expect(editorial).toContain('background: #cbd5e1');
    expect(editorial).toContain('background: #94a3b8');
  });
});
