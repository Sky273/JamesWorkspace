/**
 * Resume Comments Component
 * Displays and manages comments/notes on a resume
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon, 
  TrashIcon, 
  PencilIcon,
  LockClosedIcon,
  UserCircleIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';

interface Comment {
  id: string;
  resume_id: string;
  user_id: string;
  user_name: string;
  content: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

interface ResumeCommentsProps {
  resumeId: string;
  className?: string;
}

const ResumeComments = ({ resumeId, className = '' }: ResumeCommentsProps): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const commentsRequestIdRef = useRef(0);

  const fetchComments = useCallback(async () => {
    if (!resumeId) return;
    const requestId = ++commentsRequestIdRef.current;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth(`/api/resumes/${resumeId}/comments`);
      const data = await response.json();
      if (requestId !== commentsRequestIdRef.current) {
        return;
      }
      if (data.success) {
        setComments(data.comments);
      }
    } catch (err) {
      if (requestId !== commentsRequestIdRef.current) {
        return;
      }
      logger.error('[Comments] Failed to fetch comments:', err);
      setError(t('comments.fetchError', 'Failed to load comments'));
    } finally {
      if (requestId === commentsRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [resumeId, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const options = await createAuthOptionsWithCsrf({
        headers: { 'Content-Type': 'application/json' }
      });
      const response = await fetchWithAuth(`/api/resumes/${resumeId}/comments`, {
        ...options,
        method: 'POST',
        body: JSON.stringify({
          content: newComment.trim(),
          isPrivate
        })
      });
      const data = await response.json();

      if (data.success) {
        commentsRequestIdRef.current += 1;
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        setIsPrivate(false);
      }
    } catch (err) {
      logger.error('[Comments] Failed to add comment:', err);
      setError(t('comments.addError', 'Failed to add comment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const options = await createAuthOptionsWithCsrf({
        headers: { 'Content-Type': 'application/json' }
      });
      const response = await fetchWithAuth(`/api/resumes/${resumeId}/comments/${commentId}`, {
        ...options,
        method: 'PUT',
        body: JSON.stringify({
          content: editContent.trim()
        })
      });
      const data = await response.json();

      if (data.success) {
        commentsRequestIdRef.current += 1;
        setComments(prev => prev.map(c => 
          c.id === commentId ? data.comment : c
        ));
        setEditingId(null);
        setEditContent('');
      }
    } catch (err) {
      logger.error('[Comments] Failed to update comment:', err);
      setError(t('comments.updateError', 'Failed to update comment'));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t('comments.confirmDelete', 'Are you sure you want to delete this comment?'))) {
      return;
    }

    try {
      const options = await createAuthOptionsWithCsrf();
      const response = await fetchWithAuth(`/api/resumes/${resumeId}/comments/${commentId}`, {
        ...options,
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        commentsRequestIdRef.current += 1;
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (err) {
      logger.error('[Comments] Failed to delete comment:', err);
      setError(t('comments.deleteError', 'Failed to delete comment'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOwner = (comment: Comment) => user?.id === comment.user_id;
  const isAdmin = user?.role === 'admin';

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <ChatBubbleLeftIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {t('comments.title', 'Comments')}
        </h3>
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {comments.length} {comments.length === 1 ? t('comments.comment', 'comment') : t('comments.comments', 'comments')}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <UserCircleIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.placeholder', 'Add a comment...')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={2}
              disabled={isSubmitting}
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <LockClosedIcon className="h-4 w-4" />
                {t('comments.private', 'Private (only visible to me)')}
              </label>
              <button
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {isSubmitting ? t('comments.posting', 'Posting...') : t('comments.post', 'Post')}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            {t('comments.loading', 'Loading comments...')}
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <ChatBubbleLeftIcon className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            {t('comments.empty', 'No comments yet. Be the first to add one!')}
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {comment.user_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      {comment.user_name}
                    </span>
                    {comment.is_private && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                        <LockClosedIcon className="h-3 w-3" />
                        {t('comments.privateLabel', 'Private')}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDate(comment.created_at)}
                    </span>
                    {comment.updated_at !== comment.created_at && (
                      <span className="text-xs text-gray-400 italic">
                        ({t('comments.edited', 'edited')})
                      </span>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleEdit(comment.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          <CheckIcon className="h-3 w-3" />
                          {t('comments.save', 'Save')}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditContent('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          <XMarkIcon className="h-3 w-3" />
                          {t('comments.cancel', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  )}

                  {/* Actions */}
                  {(isOwner(comment) || isAdmin) && editingId !== comment.id && (
                    <div className="mt-2 flex gap-2">
                      {isOwner(comment) && (
                        <button
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <PencilIcon className="h-3 w-3" />
                          {t('comments.edit', 'Edit')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <TrashIcon className="h-3 w-3" />
                        {t('comments.delete', 'Delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResumeComments;
