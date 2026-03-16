/**
 * Tests for Register component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Register from './Register';

// Mock auth context
const mockRegister = vi.fn();
vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        register: mockRegister,
    }),
}));

// Mock apiInterceptor
vi.mock('../utils/apiInterceptor', () => ({
    fetchWithCsrfRetry: vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ authUrl: 'https://accounts.google.com/oauth' }),
    }),
    resetSessionState: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
    default: { error: vi.fn(), success: vi.fn() },
}));

// Mock logger
vi.mock('../utils/logger.frontend', () => ({
    default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const renderRegister = () => {
    return render(
        <BrowserRouter>
            <Register />
        </BrowserRouter>
    );
};

describe('Register Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render registration form fields', () => {
            const { getByPlaceholderText } = renderRegister();

            expect(getByPlaceholderText('auth.register.namePlaceholder')).toBeDefined();
            expect(getByPlaceholderText('auth.register.emailPlaceholder')).toBeDefined();
            expect(getByPlaceholderText('auth.register.passwordPlaceholder')).toBeDefined();
            expect(getByPlaceholderText('auth.register.confirmPasswordPlaceholder')).toBeDefined();
        });

        it('should render submit button', () => {
            const { getByRole } = renderRegister();
            expect(getByRole('button', { name: 'auth.register.registerButton' })).toBeDefined();
        });

        it('should render sign in link', () => {
            const { getByText } = renderRegister();
            expect(getByText('common.signIn')).toBeDefined();
        });

        it('should render Google sign up button', () => {
            const { getByRole } = renderRegister();
            expect(getByRole('button', { name: 'auth.register.registerWithGoogle' })).toBeDefined();
        });
    });

    describe('Form interaction', () => {
        it('should update input values on change', () => {
            const { getByPlaceholderText } = renderRegister();

            const nameInput = getByPlaceholderText('auth.register.namePlaceholder') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: 'John Doe', name: 'name' } });
            expect(nameInput.value).toBe('John Doe');

            const emailInput = getByPlaceholderText('auth.register.emailPlaceholder') as HTMLInputElement;
            fireEvent.change(emailInput, { target: { value: 'john@test.com', name: 'email' } });
            expect(emailInput.value).toBe('john@test.com');
        });

        it('should show error for empty name on submit', async () => {
            const { container, findByText } = renderRegister();

            const form = container.querySelector('form')!;
            fireEvent.submit(form);

            const error = await findByText('errors.required');
            expect(error).toBeDefined();
        });

        it('should show error for short password', async () => {
            const { getByPlaceholderText, getByRole, findByText } = renderRegister();

            fireEvent.change(getByPlaceholderText('auth.register.namePlaceholder'), { target: { value: 'Test', name: 'name' } });
            fireEvent.change(getByPlaceholderText('auth.register.emailPlaceholder'), { target: { value: 'test@test.com', name: 'email' } });
            fireEvent.change(getByPlaceholderText('auth.register.passwordPlaceholder'), { target: { value: 'short', name: 'password' } });
            fireEvent.change(getByPlaceholderText('auth.register.confirmPasswordPlaceholder'), { target: { value: 'short', name: 'confirmPassword' } });

            fireEvent.click(getByRole('button', { name: 'auth.register.registerButton' }));

            const error = await findByText('errors.passwordLength');
            expect(error).toBeDefined();
        });

        it('should show error for password mismatch', async () => {
            const { getByPlaceholderText, getByRole, findByText } = renderRegister();

            fireEvent.change(getByPlaceholderText('auth.register.namePlaceholder'), { target: { value: 'Test', name: 'name' } });
            fireEvent.change(getByPlaceholderText('auth.register.emailPlaceholder'), { target: { value: 'test@test.com', name: 'email' } });
            fireEvent.change(getByPlaceholderText('auth.register.passwordPlaceholder'), { target: { value: 'password123', name: 'password' } });
            fireEvent.change(getByPlaceholderText('auth.register.confirmPasswordPlaceholder'), { target: { value: 'different123', name: 'confirmPassword' } });

            fireEvent.click(getByRole('button', { name: 'auth.register.registerButton' }));

            const error = await findByText('errors.passwordMismatch');
            expect(error).toBeDefined();
        });
    });
});
