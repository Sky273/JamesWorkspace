/**
 * Component Props Types for ResumeConverter
 */

import type { Resume, Mission, Adaptation, Template, Settings } from './entities';
import type { User } from './auth';

// ============================================
// COMMON COMPONENT PROPS
// ============================================

export interface ChildrenProps {
  children: React.ReactNode;
}

export interface ClassNameProps {
  className?: string;
}

export interface LoadingProps {
  loading?: boolean;
}

// ============================================
// MODAL PROPS
// ============================================

export interface ModalProps extends ChildrenProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'info';
}

// ============================================
// FORM PROPS
// ============================================

export interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export interface InputProps extends FormFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends FormFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export interface TextareaProps extends FormFieldProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

// ============================================
// TABLE/LIST PROPS
// ============================================

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

// ============================================
// STATS CARD PROPS
// ============================================

export interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  iconColor: string;
  label: string;
  value: string | number;
  delay?: number;
}

export interface StatsCardsProps {
  stats: Record<string, number>;
  t: (key: string) => string;
}

// ============================================
// SEARCH AND FILTER PROPS
// ============================================

export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  label?: string;
}

export interface SearchAndActionsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  addButtonText?: string;
  t: (key: string) => string;
}

// ============================================
// RESUME COMPONENT PROPS
// ============================================

export interface ResumeCardProps {
  resume: Resume;
  onView: (resume: Resume) => void;
  onDelete: (id: string) => void;
  onExport?: (resume: Resume) => void;
}

export interface ResumeAnalysisProps {
  resume: Resume;
}

export interface ResumeListProps {
  resumes: Resume[];
  loading: boolean;
  onResumeClick: (resume: Resume) => void;
  onDeleteResume: (id: string) => void;
}

// ============================================
// MISSION COMPONENT PROPS
// ============================================

export interface MissionCardProps {
  mission: Mission;
  onEdit: (mission: Mission) => void;
  onDelete: (id: string) => void;
  onView: (mission: Mission) => void;
}

export interface MissionFormProps {
  mission?: Mission;
  onSubmit: (data: Partial<Mission>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================
// ADAPTATION COMPONENT PROPS
// ============================================

export interface AdaptationCardProps {
  adaptation: Adaptation;
  resumeName: string;
  missionTitle: string;
  onView: (adaptation: Adaptation) => void;
  onExport: (adaptation: Adaptation) => void;
  onDelete: (id: string) => void;
  index: number;
  t: (key: string) => string;
}

// ============================================
// USER MANAGEMENT PROPS
// ============================================

export interface UserFormProps {
  user?: User;
  onSubmit: (data: Partial<User>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  customers?: Array<{ id: string; Name: string }>;
}

export interface UserListProps {
  users: User[];
  loading: boolean;
  onEditUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onChangePassword: (user: User) => void;
}

// ============================================
// SETTINGS COMPONENT PROPS
// ============================================

export interface SettingsTabProps {
  formData: Settings;
  onInputChange: (field: string, value: unknown) => void;
  t: (key: string) => string;
}

export interface WeightsTabProps extends SettingsTabProps {
  totalWeight: number;
}

// ============================================
// TEMPLATE COMPONENT PROPS
// ============================================

export interface TemplateCardProps {
  template: Template;
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
  onPreview: (template: Template) => void;
}

// ============================================
// RATING COMPONENT PROPS
// ============================================

export interface RatingBarProps {
  label: string;
  percentage: number;
  improved?: number | null;
}

export interface CircularRatingProps {
  value: number;
  label: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================
// TAB COMPONENT PROPS
// ============================================

export interface TabConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  content?: React.ReactNode;
}

export interface TabPanelProps extends ChildrenProps {
  isActive: boolean;
}
