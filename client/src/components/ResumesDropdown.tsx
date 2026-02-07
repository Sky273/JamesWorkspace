/**
 * Resumes Dropdown Component
 * TypeScript version
 */

import { Fragment, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, ChartBarIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useResume } from '../context/ResumeContext';
import { formatDate } from '../utils/dateFormatter';

// Using any for Resume to maintain compatibility with ResumeContext
type Resume = any;

function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default function ResumesDropdown(): JSX.Element {
  const { resumes, fetchResumes, setCurrentResume, loading } = useResume();

  useEffect(() => {
    if (resumes.length === 0 && !loading) {
      fetchResumes();
    }
  }, [resumes.length, loading, fetchResumes]);

  const handleResumeSelect = (resume: Resume): void => {
    setCurrentResume(resume);
  };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          Resumes {loading && '...'}
          <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
        <Menu.Items className="absolute right-0 z-10 mt-2 w-96 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1 max-h-[80vh] overflow-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Loading resumes...</div>
            ) : resumes.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No resumes found</div>
            ) : (
              resumes.map((resume: Resume) => (
                <Menu.Item key={resume.id}>
                  {({ active }) => (
                    <button onClick={() => handleResumeSelect(resume)} className={classNames(active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300', 'w-full text-left px-4 py-3')}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{resume['Resume File']?.[0]?.filename || 'Unnamed Resume'}</p>
                          <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                            {formatDate(resume['Created At'], 'medium') || '-'}
                          </div>
                        </div>
                        <div className="ml-3 flex items-center">
                          <span className={classNames('inline-flex items-center rounded-full px-2 py-1 text-xs font-medium', resume.Status === 'Improved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300')}>
                            {resume.Status || 'New'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center text-sm">
                          <ChartBarIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">
                            Score: {resume['Global Rating'] || '0%'}
                            {resume['Improved Global Rating'] && <span className="text-green-600 dark:text-green-400 ml-1">→ {resume['Improved Global Rating']}</span>}
                          </span>
                        </div>
                      </div>
                      {resume['Key Improvements'] && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {(Object.values(JSON.parse(resume['Key Improvements'])) as string[][]).flat().slice(0, 1).map((improvement, index) => (
                            <div key={index} className="truncate">• {improvement}</div>
                          ))}
                        </div>
                      )}
                    </button>
                  )}
                </Menu.Item>
              ))
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
