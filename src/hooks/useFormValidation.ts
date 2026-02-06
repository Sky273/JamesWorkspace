/**
 * useFormValidation Hook
 * Simple form validation with real-time feedback
 */

import { useState, useCallback, useMemo } from 'react';

type ValidationRule<T> = {
  validate: (value: T, formData?: Record<string, unknown>) => boolean;
  message: string;
};

type FieldRules<T> = ValidationRule<T>[];

interface ValidationConfig {
  [field: string]: FieldRules<unknown>;
}

interface FieldError {
  message: string;
  touched: boolean;
}

interface UseFormValidationReturn<T extends Record<string, unknown>> {
  values: T;
  errors: Record<keyof T, FieldError | null>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isDirty: boolean;
  setValue: (field: keyof T, value: unknown) => void;
  setValues: (values: Partial<T>) => void;
  setTouched: (field: keyof T) => void;
  validateField: (field: keyof T) => boolean;
  validateAll: () => boolean;
  reset: (newValues?: T) => void;
  getFieldProps: (field: keyof T) => {
    value: unknown;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    error: string | null;
  };
}

export function useFormValidation<T extends Record<string, unknown>>(
  initialValues: T,
  validationConfig: ValidationConfig
): UseFormValidationReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, FieldError | null>>(
    () => Object.keys(initialValues).reduce((acc, key) => ({ ...acc, [key]: null }), {} as Record<keyof T, FieldError | null>)
  );
  const [touched, setTouchedState] = useState<Record<keyof T, boolean>>(
    () => Object.keys(initialValues).reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<keyof T, boolean>)
  );

  const validateField = useCallback((field: keyof T): boolean => {
    const rules = validationConfig[field as string];
    if (!rules) return true;

    const value = values[field];
    for (const rule of rules) {
      if (!rule.validate(value, values as Record<string, unknown>)) {
        setErrors(prev => ({
          ...prev,
          [field]: { message: rule.message, touched: touched[field] }
        }));
        return false;
      }
    }

    setErrors(prev => ({ ...prev, [field]: null }));
    return true;
  }, [values, touched, validationConfig]);

  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newErrors: Record<string, FieldError | null> = {};

    for (const field of Object.keys(validationConfig)) {
      const rules = validationConfig[field];
      const value = values[field as keyof T];
      let fieldError: FieldError | null = null;

      for (const rule of rules) {
        if (!rule.validate(value, values as Record<string, unknown>)) {
          fieldError = { message: rule.message, touched: true };
          isValid = false;
          break;
        }
      }

      newErrors[field] = fieldError;
    }

    setErrors(newErrors as Record<keyof T, FieldError | null>);
    setTouchedState(
      Object.keys(initialValues).reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<keyof T, boolean>)
    );

    return isValid;
  }, [values, validationConfig, initialValues]);

  const setValue = useCallback((field: keyof T, value: unknown) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
  }, []);

  const setTouched = useCallback((field: keyof T) => {
    setTouchedState(prev => ({ ...prev, [field]: true }));
    validateField(field);
  }, [validateField]);

  const reset = useCallback((newValues?: T) => {
    setValuesState(newValues || initialValues);
    setErrors(
      Object.keys(initialValues).reduce((acc, key) => ({ ...acc, [key]: null }), {} as Record<keyof T, FieldError | null>)
    );
    setTouchedState(
      Object.keys(initialValues).reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<keyof T, boolean>)
    );
  }, [initialValues]);

  const getFieldProps = useCallback((field: keyof T) => ({
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValue(field, e.target.value);
    },
    onBlur: () => setTouched(field),
    error: touched[field] && errors[field] ? errors[field]!.message : null
  }), [values, errors, touched, setValue, setTouched]);

  const isValid = useMemo(() => {
    return Object.values(errors).every(error => error === null);
  }, [errors]);

  const isDirty = useMemo(() => {
    return Object.keys(initialValues).some(
      key => values[key as keyof T] !== initialValues[key as keyof T]
    );
  }, [values, initialValues]);

  return {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    setValue,
    setValues,
    setTouched,
    validateField,
    validateAll,
    reset,
    getFieldProps
  };
}

// Common validation rules
export const validators = {
  required: (message = 'Ce champ est requis'): ValidationRule<unknown> => ({
    validate: (value) => value !== null && value !== undefined && value !== '',
    message
  }),

  email: (message = 'Email invalide'): ValidationRule<string> => ({
    validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length >= min,
    message: message || `Minimum ${min} caractères`
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length <= max,
    message: message || `Maximum ${max} caractères`
  }),

  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value) => !value || regex.test(value),
    message
  }),

  min: (minValue: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value === null || value === undefined || value >= minValue,
    message: message || `Minimum ${minValue}`
  }),

  max: (maxValue: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value === null || value === undefined || value <= maxValue,
    message: message || `Maximum ${maxValue}`
  }),

  match: (fieldName: string, message = 'Les champs ne correspondent pas'): ValidationRule<unknown> => ({
    validate: (value, formData) => !formData || value === formData[fieldName],
    message
  })
};

export default useFormValidation;
