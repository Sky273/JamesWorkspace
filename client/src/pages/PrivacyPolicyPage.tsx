/**
 * Privacy Policy Page
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const PrivacyPolicyPage = (): JSX.Element => {
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
            <ShieldCheckIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('legal.privacy.title')}
            </h1>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {t('legal.privacy.lastUpdated')}: {new Date().toLocaleDateString()}
          </p>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.introduction.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.privacy.sections.introduction.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.dataCollection.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('legal.privacy.sections.dataCollection.content')}
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>{t('legal.privacy.sections.dataCollection.items.personal')}</li>
                <li>{t('legal.privacy.sections.dataCollection.items.resume')}</li>
                <li>{t('legal.privacy.sections.dataCollection.items.usage')}</li>
                <li>{t('legal.privacy.sections.dataCollection.items.technical')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.dataUse.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('legal.privacy.sections.dataUse.content')}
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>{t('legal.privacy.sections.dataUse.items.service')}</li>
                <li>{t('legal.privacy.sections.dataUse.items.improvement')}</li>
                <li>{t('legal.privacy.sections.dataUse.items.communication')}</li>
                <li>{t('legal.privacy.sections.dataUse.items.legal')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.dataProtection.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.privacy.sections.dataProtection.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.gdpr.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('legal.privacy.sections.gdpr.content')}
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>{t('legal.privacy.sections.gdpr.rights.access')}</li>
                <li>{t('legal.privacy.sections.gdpr.rights.rectification')}</li>
                <li>{t('legal.privacy.sections.gdpr.rights.erasure')}</li>
                <li>{t('legal.privacy.sections.gdpr.rights.portability')}</li>
                <li>{t('legal.privacy.sections.gdpr.rights.objection')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.cookies.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.privacy.sections.cookies.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('legal.privacy.sections.contact.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {t('legal.privacy.sections.contact.content')}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                <strong>Email:</strong> privacy@aptea.net
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
