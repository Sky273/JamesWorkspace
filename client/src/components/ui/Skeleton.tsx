/**
 * Skeleton Loader Components
 * Provides visual placeholders while content is loading
 */

import { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

// Base skeleton with pulse animation
export const Skeleton = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div 
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    aria-hidden="true"
  />
);

// Text line skeleton
export const SkeletonText = ({ className = '' }: SkeletonProps): JSX.Element => (
  <Skeleton className={`h-4 ${className}`} />
);

// Title skeleton
export const SkeletonTitle = ({ className = '' }: SkeletonProps): JSX.Element => (
  <Skeleton className={`h-6 w-48 ${className}`} />
);

// Avatar/Image skeleton
export const SkeletonAvatar = ({ className = '' }: SkeletonProps): JSX.Element => (
  <Skeleton className={`h-10 w-10 rounded-full ${className}`} />
);

// Button skeleton
export const SkeletonButton = ({ className = '' }: SkeletonProps): JSX.Element => (
  <Skeleton className={`h-10 w-24 rounded-md ${className}`} />
);

// Card skeleton
export const SkeletonCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
    <div className="animate-pulse space-y-4">
      <div className="flex items-center space-x-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonText className="w-3/4" />
          <SkeletonText className="w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonText className="w-full" />
        <SkeletonText className="w-5/6" />
        <SkeletonText className="w-4/6" />
      </div>
    </div>
  </div>
);

// Table row skeleton
export const SkeletonTableRow = ({ columns = 5 }: { columns?: number }): JSX.Element => (
  <tr className="animate-pulse">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

// Table skeleton
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable = ({ rows = 5, columns = 5, className = '' }: SkeletonTableProps): JSX.Element => (
  <div className={`overflow-hidden ${className}`}>
    <table className="min-w-full">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-700">
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} columns={columns} />
        ))}
      </tbody>
    </table>
  </div>
);

// Grid skeleton for cards
interface SkeletonGridProps {
  items?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const SkeletonGrid = ({ items = 6, columns = 3, className = '' }: SkeletonGridProps): JSX.Element => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

// Resume card skeleton
export const SkeletonResumeCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
    <div className="animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  </div>
);

// Resume list skeleton
export const SkeletonResumeList = ({ count = 6 }: { count?: number }): JSX.Element => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonResumeCard key={i} />
    ))}
  </div>
);

// Page header skeleton
export const SkeletonPageHeader = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`mb-6 ${className}`}>
    <div className="animate-pulse flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <SkeletonButton />
        <SkeletonButton className="w-32" />
      </div>
    </div>
  </div>
);

// Stats card skeleton
export const SkeletonStatsCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
    <div className="animate-pulse">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

// Dashboard stats skeleton
export const SkeletonDashboardStats = ({ count = 4 }: { count?: number }): JSX.Element => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonStatsCard key={i} />
    ))}
  </div>
);

// Form skeleton
export const SkeletonForm = ({ fields = 4 }: { fields?: number }): JSX.Element => (
  <div className="space-y-4 animate-pulse">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i}>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    ))}
    <div className="flex justify-end gap-2 pt-4">
      <SkeletonButton />
      <SkeletonButton className="w-32" />
    </div>
  </div>
);

// Sidebar skeleton
export const SkeletonSidebar = ({ items = 8 }: { items?: number }): JSX.Element => (
  <div className="space-y-2 p-4 animate-pulse">
    <Skeleton className="h-8 w-32 mb-6" />
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

// Mission card skeleton
export const SkeletonMissionCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
    <div className="animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  </div>
);

// Mission list skeleton
export const SkeletonMissionList = ({ count = 6 }: { count?: number }): JSX.Element => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonMissionCard key={i} />
    ))}
  </div>
);

// Client card skeleton
export const SkeletonClientCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
    <div className="animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-20 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  </div>
);

// Client list skeleton
export const SkeletonClientList = ({ count = 6 }: { count?: number }): JSX.Element => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonClientCard key={i} />
    ))}
  </div>
);

// Adaptation card skeleton
export const SkeletonAdaptationCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
    <div className="animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  </div>
);

// Adaptation list skeleton
export const SkeletonAdaptationList = ({ count = 6 }: { count?: number }): JSX.Element => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonAdaptationCard key={i} />
    ))}
  </div>
);

// User row skeleton for admin tables
export const SkeletonUserRow = (): JSX.Element => (
  <tr className="animate-pulse">
    <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-32" /></div></td>
    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
    <td className="px-4 py-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
    <td className="px-4 py-3"><Skeleton className="h-6 w-20 rounded-full" /></td>
    <td className="px-4 py-3"><div className="flex gap-2"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-8 w-8 rounded" /></div></td>
  </tr>
);

// Users table skeleton
export const SkeletonUsersTable = ({ rows = 5 }: { rows?: number }): JSX.Element => (
  <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow">
    <table className="min-w-full">
      <thead className="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
          <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
          <th className="px-4 py-3"><Skeleton className="h-4 w-12" /></th>
          <th className="px-4 py-3"><Skeleton className="h-4 w-14" /></th>
          <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonUserRow key={i} />
        ))}
      </tbody>
    </table>
  </div>
);

// Template card skeleton
export const SkeletonTemplateCard = ({ className = '' }: SkeletonProps): JSX.Element => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}>
    <Skeleton className="h-40 w-full rounded-none" />
    <div className="p-4 animate-pulse">
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-3" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-16 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  </div>
);

// Template list skeleton
export const SkeletonTemplateList = ({ count = 4 }: { count?: number }): JSX.Element => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonTemplateCard key={i} />
    ))}
  </div>
);

export default Skeleton;
