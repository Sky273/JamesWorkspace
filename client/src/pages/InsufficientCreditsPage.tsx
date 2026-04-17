import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, BanknotesIcon, BoltIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import AnimatedCard from '../components/page/AnimatedCard';
import PageHeader from '../components/page/PageHeader';
import { useAuth } from '../context/AuthContext';

const ACTION_LABELS: Record<string, string> = {
  'chatbot.message': 'Chatbot',
  'resume.upload': 'Upload et analyse de CV',
  'resume.ai_modify': 'Édition IA de CV',
  'template.extract': 'Extraction de modèle',
  'resume.analysis': 'Analyse de CV',
  'resume.improvement': 'Amélioration de CV',
  'resume.adaptation': 'Adaptation de CV',
  'resume.match': 'Matching CV / mission',
  'profile.search': 'Recherche de profils',
  'profile.analysis': 'Analyse détaillée de profil',
};

const primaryLinkClassName = 'app-button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all';
const secondaryLinkClassName = 'app-button-secondary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all';

function parseCreditsValue(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCredits(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return new Intl.NumberFormat('fr-FR').format(value);
}

function getActionLabel(actionType: string | null): string | null {
  if (!actionType) {
    return null;
  }

  return ACTION_LABELS[actionType] || actionType;
}

function sanitizeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/')) {
    return '/';
  }

  if (value.startsWith('//')) {
    return '/';
  }

  return value;
}

const InsufficientCreditsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const requiredCredits = parseCreditsValue(searchParams.get('required'));
  const availableCredits = parseCreditsValue(searchParams.get('available'));
  const actionLabel = getActionLabel(searchParams.get('action'));
  const fromPath = sanitizeReturnPath(searchParams.get('from'));
  const canManageCredits = user?.role === 'admin' || user?.role === 'localAdmin';
  const topUpTarget = user?.role === 'admin' || user?.role === 'localAdmin' ? '/admin?tab=firmCredits' : '/';

  const missingCredits = useMemo(() => {
    if (requiredCredits === null || availableCredits === null) {
      return null;
    }

    return Math.max(0, requiredCredits - availableCredits);
  }, [availableCredits, requiredCredits]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="cv-surface app-page-shell mx-auto max-w-5xl"
    >
      <PageHeader
        title={t('firmCredits.insufficient.title')}
        subtitle={t(
          canManageCredits
            ? 'firmCredits.insufficient.subtitleManager'
            : 'firmCredits.insufficient.subtitleUser',
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
        <AnimatedCard className="overflow-hidden rounded-[2rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm dark:border-amber-500/20 dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-950">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <ExclamationTriangleIcon className="h-7 w-7" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                {t('firmCredits.insufficient.kicker')}
              </p>
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                {t('firmCredits.insufficient.heading')}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {actionLabel
                  ? t('firmCredits.insufficient.actionMessage', { action: actionLabel })
                  : t('firmCredits.insufficient.defaultMessage')}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <BanknotesIcon className="h-4 w-4" />
                {t('firmCredits.insufficient.availableCredits')}
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{formatCredits(availableCredits)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <BoltIcon className="h-4 w-4" />
                {t('firmCredits.insufficient.requiredCredits')}
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{formatCredits(requiredCredits)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <ExclamationTriangleIcon className="h-4 w-4" />
                {t('firmCredits.insufficient.missingCredits')}
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{formatCredits(missingCredits)}</div>
            </div>
          </div>
        </AnimatedCard>

        <AnimatedCard className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {t('firmCredits.insufficient.nextStepsTitle')}
            </h2>
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
              {t(
                canManageCredits
                  ? 'firmCredits.insufficient.nextStepsManager'
                  : 'firmCredits.insufficient.nextStepsUser',
              )}
            </p>

            <div className="space-y-3 pt-2">
              <Link to={topUpTarget} className={primaryLinkClassName}>
                <BanknotesIcon className="h-4 w-4" />
                <span>
                  {t(
                    canManageCredits
                      ? 'firmCredits.insufficient.manageCreditsCta'
                      : 'firmCredits.insufficient.contactManagerCta',
                  )}
                </span>
              </Link>

              <Link to={fromPath} className={secondaryLinkClassName}>
                <ArrowLeftIcon className="h-4 w-4" />
                <span>{t('firmCredits.insufficient.backCta')}</span>
              </Link>
            </div>
          </div>
        </AnimatedCard>
      </div>
    </motion.div>
  );
};

export default InsufficientCreditsPage;
