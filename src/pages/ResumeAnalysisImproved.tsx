/**
 * Resume Analysis Improved Component
 * TypeScript version
 */

import { useState, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import logger from '../utils/logger.frontend';

const ResumeAnalysisImproved = (): JSX.Element => {
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');

  const handleSave = (): void => {
    if (!content) {
      toast.error('Please add some content before saving');
      return;
    }

    try {
      setSavedContent(content);
      toast.success('Content saved successfully!');
    } catch (error) {
      logger.error('Error saving content:', error);
      toast.error('Error saving content');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Improved Resume Content</h2>
          <textarea value={content} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)} className="w-full h-96 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none" placeholder="Enter your improved resume content here..." />
          <div className="mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Save Content</button>
          </div>
          {savedContent && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Saved Content</h2>
              <div className="prose max-w-none" dangerouslySetInnerHTML={createSafeHtml(savedContent)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalysisImproved;
