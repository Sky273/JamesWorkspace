/**
 * Terms of Service Page
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const TermsOfServicePage = (): JSX.Element => {
  const { t } = useTranslation();
  const sections = [
    { id: 'acceptance', title: t('legal.terms.sections.acceptance.title') },
    { id: 'description', title: t('legal.terms.sections.description.title') },
    { id: 'account', title: t('legal.terms.sections.account.title') },
    { id: 'usage', title: t('legal.terms.sections.usage.title') },
    { id: 'intellectual', title: t('legal.terms.sections.intellectual.title') },
    { id: 'user-content', title: t('legal.terms.sections.userContent.title') },
    { id: 'disclaimer', title: t('legal.terms.sections.disclaimer.title') },
    { id: 'limitation', title: t('legal.terms.sections.limitation.title') },
    { id: 'termination', title: t('legal.terms.sections.termination.title') },
    { id: 'governing', title: t('legal.terms.sections.governing.title') },
    { id: 'contact', title: t('legal.terms.sections.contact.title') },
  ];
  const lastUpdated = '2026-04-07';

  return (
    <div className="min-h-screen bg-[#f3f2ef] px-4 py-12 dark:bg-[#111827] sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/"
          className="mb-8 inline-flex items-center text-[#6b4eff] hover:text-[#5b3eee] dark:text-[#c9ccff] dark:hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Link>

        <div className="rounded-[13px] border border-[#e4e4e7] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_rgba(0,0,0,0.07)] dark:border-white/10 dark:bg-[#182235] md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <DocumentTextIcon className="h-10 w-10 text-[#6b4eff] dark:text-[#c9ccff]" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('legal.terms.title')}
            </h1>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('legal.terms.lastUpdated')}: {lastUpdated}
          </p>

          <nav className="mb-10 rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/40">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Sommaire</p>
            <div className="flex flex-wrap gap-3">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:text-blue-600 dark:bg-white/5 dark:text-slate-200">
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="prose dark:prose-invert max-w-none">
            <section id="acceptance" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.acceptance.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.acceptance.content')}
              </p>
            </section>

            <section id="description" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.description.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.description.content')}
              </p>
            </section>

            <section id="account" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.account.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('legal.terms.sections.account.content')}
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>{t('legal.terms.sections.account.items.accurate')}</li>
                <li>{t('legal.terms.sections.account.items.security')}</li>
                <li>{t('legal.terms.sections.account.items.responsibility')}</li>
              </ul>
            </section>

            <section id="usage" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.usage.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('legal.terms.sections.usage.content')}
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>{t('legal.terms.sections.usage.items.lawful')}</li>
                <li>{t('legal.terms.sections.usage.items.noHarm')}</li>
                <li>{t('legal.terms.sections.usage.items.noAbuse')}</li>
                <li>{t('legal.terms.sections.usage.items.noUnauthorized')}</li>
              </ul>
            </section>

            <section id="intellectual" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.intellectual.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.intellectual.content')}
              </p>
            </section>

            <section id="user-content" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.userContent.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.userContent.content')}
              </p>
            </section>

            <section id="disclaimer" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.disclaimer.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.disclaimer.content')}
              </p>
            </section>

            <section id="limitation" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.limitation.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.limitation.content')}
              </p>
            </section>

            <section id="termination" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.termination.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.termination.content')}
              </p>
            </section>

            <section id="governing" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.governing.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.governing.content')}
              </p>
            </section>

            <section id="contact" className="mb-8 scroll-mt-24">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.terms.sections.contact.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.contact.content')}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                <strong>Email:</strong> legal@aptea.net
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
