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

// Detect mobile devices
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const SharedFilePage = (): JSX.Element => {
  const { token, type } = useParams<{ token: string; type: FileType }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('cv.pdf');
  const [isMobile, setIsMobile] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  
  // Use ref to track blob URL for cleanup (avoids stale closure)
  const blobUrlRef = useRef<string | null>(null);

  // Handle download on mobile
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

  // Handle open in new tab (for mobile PDF viewing)
  const handleOpenInNewTab = useCallback(() => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  }, [blobUrl]);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    
    const fetchFile = async () => {
      if (!token || !type) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        // Determine the API endpoint based on type
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

        // Get the content type and filename
        const contentType = response.headers.get('Content-Type') || '';
        const contentDisposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        const extractedFilename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'cv.pdf';
        setFilename(extractedFilename);
        
        // Create blob and URL
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        blobUrlRef.current = url; // Track for cleanup

        // If it's a PDF
        if (contentType.includes('pdf')) {
          // On mobile, show download/open buttons instead of iframe
          if (isMobileDevice()) {
            setPdfUrl(null); // Don't use iframe on mobile
          } else {
            setPdfUrl(url);
          }
        } else {
          // For other file types (Word docs), trigger download directly
          const a = document.createElement('a');
          a.href = url;
          a.download = extractedFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Show success message
          setPdfUrl(null);
        }

        setLoading(false);
      } catch (err) {
        logger.error('[SharedFile] Failed to fetch shared file:', err);
        setError(t('share.fetchError', 'Failed to load file'));
        setLoading(false);
      }
    };

    fetchFile();

    // Cleanup blob URL on unmount using ref (avoids stale closure)
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [token, type, t]);

  // Loading state
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('share.errorTitle', 'Unable to load CV')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  // PDF viewer (desktop)
  if (pdfUrl && !isMobile) {
    return (
      <div className="min-h-screen bg-gray-900">
        <iframe
          src={pdfUrl}
          className="w-full h-screen"
          title="CV PDF"
        />
      </div>
    );
  }

  // Mobile view with download/open buttons
  if (isMobile && blobUrl) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <DocumentArrowDownIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
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

  // Download success (for non-PDF files)
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <DocumentArrowDownIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t('share.downloadStarted', 'Download started')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('share.downloadDescription', 'The CV file is being downloaded to your device.')}
        </p>
      </div>
    </div>
  );
};

export default SharedFilePage;
