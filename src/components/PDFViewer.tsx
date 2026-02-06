/**
 * PDF Viewer Component
 * TypeScript version
 */

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  file: string | File | { url: string };
}

interface DocumentLoadSuccess {
  numPages: number;
}

const PDFViewer = ({ file }: PDFViewerProps): JSX.Element => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  const onDocumentLoadSuccess = ({ numPages }: DocumentLoadSuccess): void => {
    setNumPages(numPages);
  };

  const changePage = (offset: number): void => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = (): void => changePage(-1);
  const nextPage = (): void => changePage(1);
  const zoomIn = (): void => setScale(prevScale => Math.min(prevScale + 0.2, 2.0));
  const zoomOut = (): void => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center space-x-4 mb-4">
        <button onClick={zoomOut} disabled={scale <= 0.5} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">Zoom Out</button>
        <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} disabled={scale >= 2.0} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">Zoom In</button>
      </div>

      <div className="border dark:border-gray-700 rounded-lg overflow-auto max-h-[800px] bg-white dark:bg-gray-800">
        <Document file={file} onLoadSuccess={onDocumentLoadSuccess} className="mx-auto">
          <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} className="page" />
        </Document>
      </div>

      {numPages && numPages > 1 && (
        <div className="flex items-center justify-between w-full mt-4">
          <button onClick={previousPage} disabled={pageNumber <= 1} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">Previous</button>
          <p className="text-sm text-gray-600 dark:text-gray-400">Page {pageNumber} of {numPages}</p>
          <button onClick={nextPage} disabled={pageNumber >= numPages} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
