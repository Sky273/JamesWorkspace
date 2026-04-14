import { useMemo } from 'react';
import { DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ResumeFile {
  filename?: string;
  type?: string;
  url?: string;
}

interface ResumeLike {
  id: string;
  'File Name'?: string;
  'Resume File'?: ResumeFile[];
  [key: string]: unknown;
}

interface OriginalSourcePreviewProps {
  resume: ResumeLike;
  title?: string;
  description?: string;
  frameHeightClassName?: string;
}

const getFileExtension = (filename?: string): string => {
  if (!filename) return '';
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
};

const getPreviewLabel = (filename?: string, mimeType?: string): string => {
  if (mimeType === 'application/pdf' || getFileExtension(filename) === 'pdf') {
    return 'PDF';
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || getFileExtension(filename) === 'docx') {
    return 'DOCX';
  }
  if (mimeType === 'application/msword' || getFileExtension(filename) === 'doc') {
    return 'DOC';
  }
  return 'Document';
};

const OriginalSourcePreview = ({
  resume,
  title = 'Document source original',
  description = 'Prévisualisation visuelle du fichier importé.',
  frameHeightClassName = 'h-[720px]',
}: OriginalSourcePreviewProps): JSX.Element => {
  const primaryFile = resume['Resume File']?.[0];
  const filename = primaryFile?.filename || (resume['File Name'] as string) || 'resume';
  const previewUrl = useMemo(() => `/api/resumes/${resume.id}/preview`, [resume.id]);
  const downloadUrl = primaryFile?.url || `/api/resumes/${resume.id}/download`;
  const previewLabel = getPreviewLabel(filename, primaryFile?.type);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {(title || description) ? (
          <div>
            {title ? <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3> : null}
            {description ? <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
          </div>
        ) : <div />}
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Télécharger l’original
        </a>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-100 p-2 dark:bg-white/5">
              <DocumentTextIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{filename}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{previewLabel} source</p>
            </div>
          </div>
        </div>

        <iframe
          title={`Prévisualisation du document source ${filename}`}
          src={previewUrl}
          className={`w-full border-0 bg-white ${frameHeightClassName}`}
        />
      </div>
    </section>
  );
};

export default OriginalSourcePreview;
