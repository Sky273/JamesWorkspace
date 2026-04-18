/**
 * Firm Form Modal Component
 * TypeScript version with logo upload support
 */

import { useState, useEffect, FormEvent, ChangeEvent, useRef } from 'react';
import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from './Modal';
import userService from '../../utils/userService';

interface Firm {
  id?: string;
  name?: string;
  logo_url?: string;
}

interface FirmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; logoFile?: File | null }) => void;
  firm: Firm | null;
  t: (key: string) => string;
}

const FirmFormModal = ({ isOpen, onClose, onSubmit, firm, t }: FirmFormModalProps): JSX.Element => {
  const [name, setName] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(firm?.name || '');
    setLogoUrl(firm?.logo_url || '');
    setLogoPreview(firm?.logo_url || '');
    setSelectedFile(null);
  }, [firm, isOpen]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    onSubmit({ name, logoFile: selectedFile });
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setName(e.target.value);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(t('users.management.messages.invalidFileType'));
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('users.management.messages.fileTooLarge'));
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = async (): Promise<void> => {
    if (firm?.id && logoUrl) {
      try {
        setUploading(true);
        await userService.deleteFirmLogo(firm.id);
        setLogoUrl('');
        setLogoPreview('');
        toast.success(t('users.management.messages.logoDeleted'));
      } catch {
        toast.error(t('users.management.messages.logoDeleteFailed'));
      }
      setUploading(false);
    } else {
      setSelectedFile(null);
      setLogoPreview('');
    }
  };

  const triggerFileInput = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={firm ? t('users.management.modal.editFirm') : t('users.management.modal.addFirm')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.management.modal.name')} *
          </label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        {/* Logo upload section */}
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('users.management.modal.logo')}
            </label>
            <div className="flex items-center gap-4">
              {/* Logo preview */}
              <div className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                {logoPreview ? (
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <PhotoIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {/* Upload/Remove buttons */}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={uploading}
                  className={`btn btn-secondary px-3 py-1.5 text-sm ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t('users.management.modal.selectLogo')}
                </button>
                {(logoPreview || selectedFile) && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={uploading}
                    className={`btn btn-secondary px-3 py-1.5 text-sm flex items-center gap-1 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <TrashIcon className="w-4 h-4" />
                    {t('users.management.modal.removeLogo')}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('users.management.modal.logoHint')}
            </p>
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className={`btn btn-secondary px-4 py-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t('users.management.modal.cancel')}
          </button>
          <button
            type="submit"
            disabled={uploading}
            className={`app-primary-action px-4 py-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploading ? t('users.management.modal.uploading') : t('users.management.modal.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default FirmFormModal;
