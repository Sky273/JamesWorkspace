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

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getViewport: (options: { scale: number }) => { width: number; height: number };
        render: (options: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
      destroy?: () => void;
    }>;
  };
};

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
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([]);
  const [renderingPdf, setRenderingPdf] = useState(false);
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
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
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
          if (isMobileDevice()) {
            setPdfBytes(null);
          } else {
            const buffer = await blob.arrayBuffer();
            setPdfBytes(new Uint8Array(buffer));
          }
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = extractedFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setPdfBytes(null);
        }

        setLoading(false);
      } catch (err) {
        logger.error('[SharedFile] Failed to fetch shared file:', err);
        setError(t('share.fetchError', 'Failed to load file'));
        setLoading(false);
      }
    };

    fetchFile();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [token, type, t]);

  useEffect(() => {
    if (!pdfBytes || isMobile) {
      setPdfPageImages([]);
      setRenderingPdf(false);
      return;
    }

    let cancelled = false;

    const renderPdf = async () => {
      setRenderingPdf(true);
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as PdfJsModule;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

        const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
        const nextImages: string[] = [];
        const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1.25), 2);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Canvas context unavailable');
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvasContext: context, viewport }).promise;
          nextImages.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          setPdfPageImages(nextImages);
        }

        if (typeof pdf.destroy === 'function') {
          pdf.destroy();
        }
      } catch (err) {
        logger.error('[SharedFile] Failed to render PDF preview:', err);
        if (!cancelled) {
          setPdfPageImages([]);
        }
      } finally {
        if (!cancelled) {
          setRenderingPdf(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, isMobile]);

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

  if (pdfBytes && !isMobile) {
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

        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
          {renderingPdf && pdfPageImages.length === 0 ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('share.loading', 'Loading CV...')}
                </p>
              </div>
            </div>
          ) : pdfPageImages.length > 0 ? (
            pdfPageImages.map((pageImage, index) => (
              <div key={`page-${index + 1}`} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <img
                  src={pageImage}
                  alt={`PDF page ${index + 1}`}
                  className="block h-auto w-full"
                />
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="mb-4">{t('share.fetchError', 'Failed to load file')}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleOpenInNewTab}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
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
          )}
        </div>
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
