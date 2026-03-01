/**
 * Terms of Service Page
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const TermsOfServicePage = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-8"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12">
          <div className="flex items-center gap-3 mb-8">
            <DocumentTextIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('legal.terms.title')}
            </h1>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {t('legal.terms.lastUpdated')}: {new Date().toLocaleDateString()}
          </p>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.acceptance.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.acceptance.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.description.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.description.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.intellectual.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.intellectual.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.userContent.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.userContent.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.disclaimer.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.disclaimer.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.limitation.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.limitation.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.termination.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.termination.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('legal.terms.sections.governing.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.terms.sections.governing.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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
