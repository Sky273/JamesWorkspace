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
    <div className="min-h-screen bg-[#f3f2ef] text-[#18181b] dark:bg-[#111827] dark:text-[#e5e7eb]">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {backLabel}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-2 text-sm font-semibold text-[#6b4eff] shadow-none dark:border-white/10 dark:bg-[#182235] dark:text-[#c9ccff]">
            <SparklesIcon className="h-4 w-4" />
            ResumeConverter
          </div>
        </div>
      </div>

      <div className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center">
          <section className="hidden lg:block">
            <div className="space-y-5 rounded-[13px] border border-[#e4e4e7] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_rgba(0,0,0,0.07)] dark:border-white/10 dark:bg-[#182235] dark:shadow-none">
              <div className="inline-flex items-center gap-2 rounded-[9px] bg-[#f4f2ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b4eff] dark:bg-white/5 dark:text-[#c9ccff]">
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
                      className="rounded-[9px] border border-[#e4e4e7] bg-[#f8f8f7] px-4 py-3 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-[#111827] dark:text-slate-200"
                    >
                      {point}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[13px] border border-[#e4e4e7] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_rgba(0,0,0,0.07)] dark:border-white/10 dark:bg-[#182235] dark:shadow-none sm:p-7">
            <div className="mx-auto max-w-md">
              <div className="mb-8 space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[13px] bg-[#f4f2ff] text-[#6b4eff] dark:bg-white/5 dark:text-[#c9ccff]">
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
