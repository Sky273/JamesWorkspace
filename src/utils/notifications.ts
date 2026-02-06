/**
 * Notifications Service
 * Centralized notification system with different types and actions
 */

import toast from 'react-hot-toast';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface NotificationOptions {
  duration?: number;
  icon?: string;
}

const defaultDurations: Record<NotificationType, number> = {
  success: 3000,
  error: 6000,
  warning: 5000,
  info: 4000,
  loading: Infinity
};

/**
 * Show a notification toast
 */
export const notify = (
  type: NotificationType,
  message: string,
  options: NotificationOptions = {}
): string => {
  const {
    duration = defaultDurations[type],
    icon
  } = options;

  const toastOptions = {
    duration,
    icon,
    style: {
      borderRadius: '8px',
      padding: '12px 16px',
    }
  };

  switch (type) {
    case 'loading':
      return toast.loading(message, toastOptions);
    case 'success':
      return toast.success(message, toastOptions);
    case 'error':
      return toast.error(message, toastOptions);
    case 'warning':
      return toast(message, { ...toastOptions, icon: '⚠️' });
    case 'info':
      return toast(message, { ...toastOptions, icon: 'ℹ️' });
    default:
      return toast(message, toastOptions);
  }
};

/**
 * Shorthand methods
 */
export const notifySuccess = (message: string, options?: NotificationOptions): string => 
  notify('success', message, options);

export const notifyError = (message: string, options?: NotificationOptions): string => 
  notify('error', message, options);

export const notifyWarning = (message: string, options?: NotificationOptions): string => 
  notify('warning', message, options);

export const notifyInfo = (message: string, options?: NotificationOptions): string => 
  notify('info', message, options);

export const notifyLoading = (message: string): string => 
  notify('loading', message);

/**
 * Update an existing toast (useful for loading -> success/error transitions)
 */
export const updateNotification = (
  toastId: string,
  type: NotificationType,
  message: string
): void => {
  toast.dismiss(toastId);
  notify(type, message);
};

/**
 * Dismiss a specific toast or all toasts
 */
export const dismissNotification = (toastId?: string): void => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};

/**
 * Promise-based notification (shows loading, then success/error)
 */
export const notifyPromise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: Error) => string);
  }
): Promise<T> => {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error
  });
};

export default {
  notify,
  success: notifySuccess,
  error: notifyError,
  warning: notifyWarning,
  info: notifyInfo,
  loading: notifyLoading,
  update: updateNotification,
  dismiss: dismissNotification,
  promise: notifyPromise
};
