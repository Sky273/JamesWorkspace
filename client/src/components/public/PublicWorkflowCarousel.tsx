import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLongLeftIcon,
  ArrowLongRightIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

import uploadFlowVisual from '../../assets/welcome/workflow-upload.svg';
import analysisFlowVisual from '../../assets/welcome/workflow-analysis.svg';
import improveFlowVisual from '../../assets/welcome/workflow-improve.svg';
import exportFlowVisual from '../../assets/welcome/workflow-export.svg';
import missionSelectVisual from '../../assets/welcome/workflow-mission-select.svg';
import missionAdaptVisual from '../../assets/welcome/workflow-mission-adapt.svg';

type WorkflowSlide = {
  id: string;
  flow: string;
  stepLabel: string;
  title: string;
  description: string;
  bullets: string[];
  accentClassName: string;
  imageSrc: string;
  icon: typeof DocumentArrowUpIcon;
};

const slides: WorkflowSlide[] = [
  {
    id: 'import',
    flow: 'Flux CV',
    stepLabel: '01 · Import',
    title: 'Importez le CV en quelques secondes',
    description: 'Dépôt de PDF, DOCX ou texte brut dans une interface claire, avec guidage des formats et validation immédiate.',
    bullets: ['Glisser-déposer', 'Vérification du format', 'Démarrage direct du traitement'],
    accentClassName: 'from-sky-500/20 via-cyan-500/10 to-transparent text-sky-700 ring-sky-500/20',
    imageSrc: uploadFlowVisual,
    icon: DocumentArrowUpIcon,
  },
  {
    id: 'analysis',
    flow: 'Flux CV',
    stepLabel: '02 · Analyse',
    title: 'Analyse structurée et lecture métier',
    description: "Le CV est décomposé en sections exploitables avec une vue d'ensemble, des signaux qualifiants et un pipeline lisible.",
    bullets: ['Vue globale', 'Compétences et tags', 'Pipeline de traitement visible'],
    accentClassName: 'from-indigo-500/20 via-violet-500/10 to-transparent text-indigo-700 ring-indigo-500/20',
    imageSrc: analysisFlowVisual,
    icon: ChartBarIcon,
  },
  {
    id: 'improve',
    flow: 'Flux CV',
    stepLabel: '03 · Amélioration',
    title: "Améliorez le contenu avec l’aide IA",
    description: "Le texte enrichi reste éditable, comparé à la version d’origine et prêt pour des itérations rapides avant diffusion.",
    bullets: ['Édition assistée', 'Comparaison avant/après', 'Preuves de compétences conservées'],
    accentClassName: 'from-fuchsia-500/20 via-pink-500/10 to-transparent text-fuchsia-700 ring-fuchsia-500/20',
    imageSrc: improveFlowVisual,
    icon: SparklesIcon,
  },
  {
    id: 'export',
    flow: 'Flux CV',
    stepLabel: '04 · Export',
    title: 'Exportez une version propre et diffusable',
    description: 'Sélection du modèle, du format et de la source pour produire un document final cohérent avec le niveau de finition attendu.',
    bullets: ["Modèles prêts à l’emploi", 'PDF / Word / email', 'Source originale ou améliorée'],
    accentClassName: 'from-emerald-500/20 via-green-500/10 to-transparent text-emerald-700 ring-emerald-500/20',
    imageSrc: exportFlowVisual,
    icon: DocumentArrowDownIcon,
  },
  {
    id: 'mission-select',
    flow: 'Flux mission',
    stepLabel: '05 · Mission',
    title: 'Choisissez la mission à cibler',
    description: 'Le recruteur sélectionne le besoin commercial cible pour lancer une lecture contextualisée du profil et de ses écarts.',
    bullets: ['Sélection guidée', 'Contexte client visible', 'Passage fluide vers le matching'],
    accentClassName: 'from-amber-500/20 via-orange-500/10 to-transparent text-amber-700 ring-amber-500/20',
    imageSrc: missionSelectVisual,
    icon: BriefcaseIcon,
  },
  {
    id: 'mission-adapt',
    flow: 'Flux mission',
    stepLabel: '06 · Adaptation',
    title: 'Adaptez le CV à une mission précise',
    description: 'Le système met en regard le CV et la mission, explique le matching, puis génère une version ciblée exploitable aussitôt.',
    bullets: ['Analyse de correspondance', 'Génération ciblée', 'Restitution exploitable en un clic'],
    accentClassName: 'from-rose-500/20 via-pink-500/10 to-transparent text-rose-700 ring-rose-500/20',
    imageSrc: missionAdaptVisual,
    icon: ArrowPathIcon,
  },
];

const slideMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -18 },
};

function PublicWorkflowCarousel(): JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];
  const ActiveIcon = activeSlide.icon;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, []);

  const goToPrevious = () => {
    setActiveIndex((currentIndex) => (currentIndex - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
  };

  return (
    <section className="relative overflow-hidden border-y border-slate-200/70 bg-white/75 py-20 dark:border-white/10 dark:bg-slate-950/60">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.16),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.1),_transparent_30%)]" />
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-slate-300/80 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            Parcours produit
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Visualisez les flux majeurs de ResumeConverter
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
            Un carrousel de vues produit pour montrer le passage de l’import à l’export, puis l’adaptation d’un CV à une mission.
          </p>
        </div>

        <div className="mt-12 rounded-[2rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.5)] backdrop-blur xl:p-5 dark:border-white/10 dark:bg-slate-900/75">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={slideMotion.initial}
              animate={slideMotion.animate}
              exit={slideMotion.exit}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
            >
              <div className="overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-slate-100 shadow-inner shadow-slate-200/60 dark:border-white/10 dark:bg-slate-950">
                <img
                  src={activeSlide.imageSrc}
                  alt={activeSlide.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="flex flex-col rounded-[1.6rem] border border-slate-200/80 bg-slate-50/80 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                <div className={`inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r px-4 py-2 text-xs font-semibold ring-1 ${activeSlide.accentClassName}`}>
                  <ActiveIcon className="h-4 w-4" />
                  <span>{activeSlide.flow}</span>
                  <span className="text-slate-500 dark:text-slate-300">{activeSlide.stepLabel}</span>
                </div>

                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {activeSlide.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {activeSlide.description}
                </p>

                <div className="mt-6 grid gap-3">
                  {activeSlide.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary-500)]" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8">
                  <div className="mb-4 flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                    <span>Progression</span>
                    <span>{String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-500)] via-sky-500 to-emerald-500"
                      initial={false}
                      animate={{ width: `${((activeIndex + 1) / slides.length) * 100}%` }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
              {slides.map((slide, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)] shadow-sm shadow-[var(--color-primary-100)] dark:border-[var(--color-primary-500)] dark:bg-[color:color-mix(in_srgb,var(--color-primary-500)_12%,transparent)]'
                        : 'border-slate-200/80 bg-white/80 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      {slide.flow}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{slide.stepLabel}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">{slide.title}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={goToPrevious}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.08]"
                aria-label="Flux précédent"
              >
                <ArrowLongLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                aria-label="Flux suivant"
              >
                <ArrowLongRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PublicWorkflowCarousel;
