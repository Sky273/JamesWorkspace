import { motion } from 'framer-motion';
import { ArrowUpIcon } from '@heroicons/react/24/outline';

interface HomeScrollTopButtonProps {
  onClick: () => void;
}

export default function HomeScrollTopButton({ onClick }: HomeScrollTopButtonProps): JSX.Element {
  return (
    <motion.button
      className="fixed bottom-8 right-8 p-4 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors z-40"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
    >
      <ArrowUpIcon className="w-6 h-6" />
    </motion.button>
  );
}
