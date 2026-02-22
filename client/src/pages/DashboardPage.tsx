/**
 * DashboardPage Component
 * TypeScript version
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { tagService } from '../utils/tagService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger.frontend';
import { SkeletonCard } from '../components/ui/Skeleton';

interface Tags {
  [category: string]: string[];
}

const TagsManagement = (): JSX.Element => {
  const [tags, setTags] = useState<Tags>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTags = async (): Promise<void> => {
      try {
        setLoading(true);
        const data = await tagService.getAllTags();
        setTags(data as unknown as Tags);
      } catch (err) {
        setError('Failed to load tags');
        toast.error('Failed to load tags');
        logger.error('Error loading tags:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  const handleRenameTag = async (category: string, oldName: string, newName: string | null): Promise<void> => {
    if (!newName) return;
    try {
      await tagService.renameTag(category, oldName, newName);
      toast.success(`Tag renamed from ${oldName} to ${newName}`);
      setTags(prevTags => ({
        ...prevTags,
        [category]: prevTags[category].map(tag => tag === oldName ? newName : tag)
      }));
    } catch (err) {
      toast.error('Failed to rename tag');
      logger.error('Error renaming tag:', err);
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
  if (error) return <div>{error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Tags Management</h1>
      {Object.entries(tags).map(([category, categoryTags]) => (
        <div key={category} className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{category}</h2>
          <ul className="list-disc pl-5">
            {categoryTags.map(tag => (
              <li key={tag} className="mb-2">
                {tag}
                <button
                  className="ml-4 text-blue-500 hover:underline"
                  onClick={() => handleRenameTag(category, tag, prompt('Enter new tag name:', tag))}
                >
                  Rename
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const DashboardPage = (): JSX.Element => {
  const navigate = useNavigate();

  const handleGoToUsers = (): void => {
    navigate('/dashboard/users');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-8"
    >
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Users</h2>
          <p className="text-gray-600 dark:text-gray-300">Manage user accounts and permissions.</p>
          <motion.button
            whileHover={{ scale: 1.1 }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-500"
            onClick={handleGoToUsers}
          >
            Go to Users
          </motion.button>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Tags</h2>
          <p className="text-gray-600 dark:text-gray-300">Manage tags for resumes.</p>
          <motion.button
            whileHover={{ scale: 1.1 }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-500"
            onClick={() => navigate('/dashboard/tags')}
          >
            Go to Tags
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DashboardPage;
