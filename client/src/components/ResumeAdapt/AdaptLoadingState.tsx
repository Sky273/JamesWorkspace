import { AnimatePresence, motion } from 'framer-motion';
import { DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface AdaptLoadingStateProps {
  mode: 'analyzing' | 'adapting';
  cycleIndex: number;
  cycleMessages: string[];
  t: any;
}

export default function AdaptLoadingState({
  mode,
  cycleIndex,
  cycleMessages,
  t
}: AdaptLoadingStateProps): JSX.Element {
  const isAdapting = mode === 'adapting';

  return (
    <motion.div
      key={mode}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col items-center justify-center py-20 overflow-hidden"
    >
      <div className={`absolute inset-0 ${isAdapting
        ? 'bg-gradient-to-br from-purple-50/60 via-transparent to-fuchsia-50/40 dark:from-purple-950/30 dark:via-transparent dark:to-fuchsia-950/20'
        : 'bg-gradient-to-br from-blue-50/60 via-transparent to-indigo-50/40 dark:from-blue-950/30 dark:via-transparent dark:to-indigo-950/20'}`} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 10 }, (_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${isAdapting ? 'bg-purple-400/30' : 'bg-indigo-400/30'}`}
            style={{
              left: `${isAdapting ? 8 + i * 9 : 10 + i * 9}%`,
              top: `${isAdapting ? 10 + (i % 4) * 22 : 15 + (i % 3) * 25}%`,
              width: isAdapting ? 3 + (i % 3) : 3 + (i % 4),
              height: isAdapting ? 3 + (i % 3) : 3 + (i % 4)
            }}
            animate={{ y: [0, isAdapting ? -16 : -18, 0], x: [0, i % 2 === 0 ? (isAdapting ? 7 : 6) : (isAdapting ? -7 : -6), 0], opacity: [0, isAdapting ? 0.5 : 0.6, 0], scale: [isAdapting ? 0.4 : 0.5, isAdapting ? 1.2 : 1.3, isAdapting ? 0.4 : 0.5] }}
            transition={{ duration: (isAdapting ? 3.5 : 3) + i * (isAdapting ? 0.3 : 0.4), delay: i * (isAdapting ? 0.2 : 0.25), repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative w-32 h-32 mb-8">
        <motion.div
          className={`absolute -inset-4 rounded-full ${isAdapting ? 'bg-gradient-to-br from-purple-400/10 to-fuchsia-500/10' : 'bg-gradient-to-br from-blue-400/10 to-indigo-500/10'}`}
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className={`absolute inset-0 rounded-full border-[3px] ${isAdapting ? 'border-purple-200/50 dark:border-purple-800/30' : 'border-blue-200/50 dark:border-blue-800/30'}`}
          style={isAdapting ? { borderTopColor: 'rgb(147, 51, 234)', borderRightColor: 'rgb(147, 51, 234)' } : { borderTopColor: 'rgb(99, 102, 241)', borderRightColor: 'rgb(99, 102, 241)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className={`absolute inset-3 rounded-full border-[3px] ${isAdapting ? 'border-fuchsia-200/30 dark:border-fuchsia-800/20' : 'border-indigo-200/30 dark:border-indigo-800/20'}`}
          style={isAdapting ? { borderBottomColor: 'rgb(192, 38, 211)', borderLeftColor: 'rgb(192, 38, 211)' } : { borderBottomColor: 'rgb(79, 70, 229)', borderLeftColor: 'rgb(79, 70, 229)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className={`absolute inset-6 rounded-full border-[2px] ${isAdapting ? 'border-indigo-200/20 dark:border-indigo-800/15' : 'border-purple-200/20 dark:border-purple-800/15'}`}
          style={isAdapting ? { borderTopColor: 'rgb(99, 102, 241)', borderRightColor: 'rgb(99, 102, 241)' } : { borderTopColor: 'rgb(147, 51, 234)', borderRightColor: 'rgb(147, 51, 234)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
        {isAdapting && [0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 4 + i * 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
          >
            <motion.div
              className={`absolute w-2 h-2 rounded-full ${i === 0 ? 'bg-purple-400' : i === 1 ? 'bg-fuchsia-400' : 'bg-indigo-400'}`}
              style={{ top: '-4px', left: '50%', marginLeft: '-4px' }}
              animate={{ scale: [0.6, 1.3, 0.6], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
            />
          </motion.div>
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className={`w-14 h-14 rounded-2xl ${isAdapting ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-indigo-500/30'} flex items-center justify-center shadow-lg`}
            animate={{ scale: [1, 1.08, 1], rotate: [0, isAdapting ? 3 : 2, isAdapting ? -3 : -2, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {isAdapting ? <SparklesIcon className="w-7 h-7 text-white" /> : <DocumentTextIcon className="w-7 h-7 text-white" />}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            />
          </motion.div>
        </div>
      </div>

      <h3 className="relative text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {isAdapting ? t('adaptation.generating') : t('adaptation.analyzing', "Analyse d'adéquation en cours...")}
      </h3>

      <div className="relative h-6 mb-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={cycleIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            {cycleMessages[cycleIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className={`relative w-64 h-1.5 rounded-full overflow-hidden mb-5 ${isAdapting ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
        <motion.div
          className={`absolute inset-y-0 w-1/2 rounded-full ${isAdapting ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500'}`}
          animate={{ left: ['-50%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {isAdapting && (
        <p className="relative text-xs text-gray-400 dark:text-gray-500">
          {t('adaptation.generatingTime')}
        </p>
      )}

      <div className="relative flex items-center gap-1.5 mt-3">
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${isAdapting ? 'bg-purple-400' : 'bg-indigo-400 dark:bg-indigo-400'}`}
            animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}
