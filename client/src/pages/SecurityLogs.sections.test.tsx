import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ObservabilityOverview,
  SecurityFiltersBar,
  SecurityLogsPagination,
  SecurityLogsTable,
  SecurityStatsGrid,
  SecurityTabs,
} from './SecurityLogs.sections';

function createMotionElement(tag: string) {
  const MotionElement = ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement(tag, props, children);
  MotionElement.displayName = `MockMotion(${tag})`;
  return MotionElement;
}

vi.mock('framer-motion', () => ({
  motion: {
    div: createMotionElement('div'),
    tr: createMotionElement('tr'),
  },
}));

vi.mock('../components/Pagination', () => ({
  default: ({
    currentPage,
    totalPages,
    totalCount,
    onPageChange,
    itemName,
  }: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    itemName: string;
  }) => (
    <div>
      <span>{itemName}:{currentPage}/{totalPages}:{totalCount}</span>
      <button onClick={() => onPageChange(currentPage + 1)}>next-page</button>
    </div>
  ),
}));

const t = ((key: string) => key) as never;

describe('SecurityLogs sections', () => {
  it('renders the stats grid and resets filters from the total card', () => {
    const onResetFilters = vi.fn();

    render(
      <SecurityStatsGrid
        stats={{
          total: 12,
          recent: { lastHour: 2, last24h: 5, last7Days: 0 },
          byLevel: { ERROR: 3, INFO: 9 },
          bySource: {},
          byEvent: {},
        }}
        onResetFilters={onResetFilters}
        t={t}
      />,
    );

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('12'));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('filters, refreshes, and clears the filters bar state', async () => {
    const fetchLogs = vi.fn().mockResolvedValue(undefined);
    const fetchStats = vi.fn().mockResolvedValue(undefined);
    const onAutoRefreshChange = vi.fn();
    const onClearFilters = vi.fn();
    const onFilterChange = vi.fn();
    const setLoading = vi.fn();

    render(
      <SecurityFiltersBar
        autoRefresh={true}
        fetchLogs={fetchLogs}
        fetchStats={fetchStats}
        filters={{ level: 'ERROR', event: '', source: '' }}
        filterOptions={{ levels: ['ERROR'], events: ['auth_failed'], sources: ['security'] }}
        onAutoRefreshChange={onAutoRefreshChange}
        onClearFilters={onClearFilters}
        onFilterChange={onFilterChange}
        setLoading={setLoading}
        t={t}
      />,
    );

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'ERROR' } });
    expect(onFilterChange).toHaveBeenCalledWith({ level: 'ERROR' });

    fireEvent.click(screen.getByText('security.refresh'));
    expect(setLoading).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTitle('common.resetFilters'));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onAutoRefreshChange).toHaveBeenCalledTimes(1);
  });

  it('renders table rows and pagination callbacks', () => {
    const onPageChange = vi.fn();

    render(
      <>
        <SecurityLogsTable
          logs={[
            {
              timestamp: '2026-04-10T10:00:00.000Z',
              source: 'security',
              level: 'ERROR',
              event: 'auth_failed',
              email: 'admin@example.com',
              customer: 'Acme',
              ip: '127.0.0.1',
              action: 'login',
              statusCode: 401,
              message: 'Invalid credentials',
              duration: 120,
              stack: 'Error: Invalid credentials\n    at signin (auth.js:42:1)',
            },
          ]}
          t={t}
        />
        <SecurityLogsPagination
          currentPage={2}
          loading={false}
          onPageChange={onPageChange}
          pageSize={25}
          t={t}
          totalCount={40}
          totalPages={4}
        />
      </>,
    );

    expect(screen.getByText('auth_failed')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByText('security.table.stackTrace')).toBeInTheDocument();
    expect(screen.getByText(/Error: Invalid credentials/)).toBeInTheDocument();
    expect(screen.getByText('security.logs:2/4:40')).toBeInTheDocument();

    fireEvent.click(screen.getByText('next-page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders tabs and observability overview, including the main flow', () => {
    const onTabChange = vi.fn();
    const onRefresh = vi.fn();
    const onCopy = vi.fn();

    render(
      <>
        <SecurityTabs activeTab="observability" onTabChange={onTabChange} t={t} />
        <ObservabilityOverview
          health={{
            status: 'healthy',
            responseTime: '42ms',
            checks: {
              database: { status: 'ok', message: 'Connected' },
              batchWorker: { status: 'ok', activeProcessingCount: 0 },
              ocr: { status: 'ok', preferredEngine: 'tesseract-cli' },
              recentBatchActivity: {
                export: { timestamp: '2026-04-10T10:00:00.000Z', operation: 'generateJobExport', status: 'completed', jobId: 'job-1' },
                textExtraction: { timestamp: '2026-04-10T10:05:00.000Z', operation: 'extractTextFromBuffer', status: 'completed', fileName: 'cv.docx' },
              },
              recentConsentActivity: {
                scheduler: { timestamp: '2026-04-10T10:10:00.000Z', operation: 'purgeExpiredResumes', status: 'completed' },
              },
              recentPipelineActivity: {
                pipeline: { timestamp: '2026-04-10T10:15:00.000Z', operation: 'addToPipeline', status: 'completed', pipelineId: 'pipe-1' },
              },
            },
          }}
          loading={false}
          operationsMetrics={{
            operations: {
              uploads: { total: 0, successful: 0, failed: 0 },
              batchImports: { runs: 14, resumeRecordsCreated: 12, failedRuns: 2, analysisRuns: 11, textExtractionRuns: 13, textExtractionFailures: 1 },
              improvement: { runs: 7, successfulRuns: 6, failedRuns: 1 },
              batchExports: { runs: 4, successfulRuns: 3, failedRuns: 1, generatedFiles: 8, failedFiles: 1 },
            },
          }}
          onRefresh={onRefresh}
          onCopy={onCopy}
          t={t}
        />
      </>,
    );

    fireEvent.click(screen.getByText('security.tabs.logs'));
    expect(onTabChange).toHaveBeenCalledWith('logs');

    expect(screen.getByText('security.observability.title')).toBeInTheDocument();
    expect(screen.getByText('security.observability.mainFlow.title')).toBeInTheDocument();
    expect(screen.getByText('security.observability.mainFlow.import')).toBeInTheDocument();
    expect(screen.getByText('security.observability.mainFlow.analysis')).toBeInTheDocument();
    expect(screen.getByText('security.observability.mainFlow.improvement')).toBeInTheDocument();
    expect(screen.getByText('security.observability.mainFlow.export')).toBeInTheDocument();
    expect(screen.getAllByText('Export batch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0);
    expect(screen.getByText('generateJobExport')).toBeInTheDocument();

    fireEvent.click(screen.getByText('security.observability.copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('security.refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
