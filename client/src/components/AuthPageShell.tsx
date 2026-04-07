import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Footer from './Footer';

interface AuthPageShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  asideTitle?: string;
  asideBody?: string;
  asidePoints?: string[];
  backHref?: string;
  backLabel?: string;
}

export default function AuthPageShell({
  title,
  subtitle,
  children,
  asideTitle,
  asideBody,
  asidePoints = [],
  backHref = '/welcome',
  backLabel = 'Retour',
}: AuthPageShellProps): JSX.Element {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_34%),linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(241,245,249,0.94))] dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_34%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))]">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {backLabel}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/85 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-400/20 dark:bg-white/5 dark:text-indigo-200">
            <SparklesIcon className="h-4 w-4" />
            ResumeConverter
          </div>
        </div>
      </div>

      <div className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center">
          <section className="hidden lg:block">
            <div className="space-y-6 rounded-[2rem] border border-white/60 bg-white/70 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                <SparklesIcon className="h-4 w-4" />
                ResumeConverter
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {asideTitle || title}
                </h1>
                {asideBody ? (
                  <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                    {asideBody}
                  </p>
                ) : null}
              </div>
              {asidePoints.length > 0 ? (
                <div className="grid gap-3">
                  {asidePoints.map((point) => (
                    <div
                      key={point}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/85 px-4 py-3 text-sm font-medium text-slate-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-200"
                    >
                      {point}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0f172ad9] dark:shadow-[0_24px_60px_rgba(0,0,0,0.38)] sm:p-8">
            <div className="mx-auto max-w-md">
              <div className="mb-8 space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                  <SparklesIcon className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {children}
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
