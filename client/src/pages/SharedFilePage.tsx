/**
 * SharedFilePage Component
 * Public page to view/download shared CV files via token
 * This page fetches the file from the backend API and displays it
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentArrowDownIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline';
import logger from '../utils/logger.frontend';

type FileType = 'pdf' | 'file';

const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const SharedFilePage = (): JSX.Element => {
  const { token, type } = useParams<{ token: string; type: FileType }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('cv.pdf');
  const [isMobile, setIsMobile] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [requiresManualDownload, setRequiresManualDownload] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const handleDownload = useCallback(() => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [blobUrl, filename]);

  const handleOpenInNewTab = useCallback(() => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  }, [blobUrl, pdfUrl]);

  useEffect(() => {
    setIsMobile(isMobileDevice());

    const fetchFile = async () => {
      if (!token || !type) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const endpoint = type === 'pdf'
          ? `/api/share/pdf/${token}`
          : `/api/share/file/${token}`;

        const response = await fetch(endpoint);

        if (!response.ok) {
          if (response.status === 404) {
            setError(t('share.notFound', 'File not found or link expired'));
          } else {
            setError(t('share.fetchError', 'Failed to load file'));
          }
          setLoading(false);
          return;
        }

        const contentType = response.headers.get('Content-Type') || '';
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        const extractedFilename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'cv.pdf';
        setFilename(extractedFilename);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        blobUrlRef.current = url;

        if (contentType.includes('pdf')) {
          setPdfUrl(type === 'pdf' ? endpoint : url);
          setRequiresManualDownload(false);
        } else {
          setPdfUrl(null);
          setRequiresManualDownload(true);
        }

        setLoading(false);
      } catch (err) {
        logger.error('[SharedFile] Failed to fetch shared file:', err);
        setError(t('share.fetchError', 'Failed to load file'));
        setLoading(false);
      }
    };

    void fetchFile();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [token, type, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('share.loading', 'Loading CV...')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('share.errorTitle', 'Unable to load CV')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (pdfUrl && !isMobile) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{filename}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenInNewTab}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <EyeIcon className="h-4 w-4" />
                {t('share.openPdf', 'Open PDF')}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                {t('share.downloadPdf', 'Download')}
              </button>
            </div>
          </div>
        </div>

        <iframe
          src={pdfUrl}
          className="h-[calc(100vh-73px)] w-full border-0"
          title={filename}
        />
      </div>
    );
  }

  if (isMobile && blobUrl) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <DocumentArrowDownIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {filename}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('share.mobileDescription', 'Choose how to view this CV')}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleOpenInNewTab}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <EyeIcon className="h-5 w-5" />
              {t('share.openPdf', 'Open PDF')}
            </button>
            <button
              onClick={handleDownload}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              {t('share.downloadPdf', 'Download')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <DocumentArrowDownIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {requiresManualDownload
            ? t('share.fileReadyTitle', 'File ready to download')
            : t('share.downloadStarted', 'Download started')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {requiresManualDownload
            ? t('share.fileReadyDescription', 'Choose whether to open the file in a new tab or start the download.')
            : t('share.downloadDescription', 'The CV file is being downloaded to your device.')}
        </p>
        {requiresManualDownload ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleOpenInNewTab}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <EyeIcon className="h-5 w-5" />
              {t('share.openFile', 'Open file')}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              {t('share.downloadPdf', 'Download')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SharedFilePage;
