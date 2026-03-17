/**
 * Share QR Code Modal Component
 * Displays a QR code for sharing a resume PDF link
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  XMarkIcon,
  ShareIcon,
  ClipboardIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import logger from '../utils/logger.frontend';

interface ShareQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  candidateName?: string;
  isLoading?: boolean;
  warning?: string;
}

const ShareQRCodeModal = ({ 
  isOpen, 
  onClose, 
  url, 
  title,
  candidateName,
  isLoading = false,
  warning
}: ShareQRCodeModalProps): JSX.Element | null => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('[ShareQR] Failed to copy:', err);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    // Create a canvas to convert SVG to PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width * 2; // Higher resolution
      canvas.height = img.height * 2;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `qr-code-${candidateName || 'cv'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ShareIcon className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('share.title', 'Share CV')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">
                {t('share.generating', 'Generating shareable link...')}
              </p>
            </div>
          ) : (
            <>
              {/* Warning message */}
              {warning && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {warning}
                  </p>
                </div>
              )}

              {/* Title */}
              {(title || candidateName) && (
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {title || candidateName}
                  </p>
                </div>
              )}

              {/* QR Code */}
              <div 
                ref={qrRef}
                className="flex justify-center p-6 bg-white rounded-lg border border-gray-200 mb-4"
              >
                <QRCodeSVG
                  value={url}
                  size={200}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#1f2937"
                />
              </div>

              {/* Instructions */}
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                {t('share.scanQR', 'Scan this QR code to access the CV')}
              </p>

              {/* URL display */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                <input
                  type="text"
                  value={url}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 truncate outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title={t('share.copyLink', 'Copy link')}
                >
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <ClipboardIcon className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="h-4 w-4" />
                      {t('share.copied', 'Copied!')}
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="h-4 w-4" />
                      {t('share.copyLink', 'Copy link')}
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadQR}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                  title={t('share.downloadQR', 'Download QR code')}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareQRCodeModal;
