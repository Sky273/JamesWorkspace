import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UserFormModal from './UserFormModal';

vi.mock('./Modal', () => ({
  default: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) => (isOpen ? <div><h2>{title}</h2>{children}</div> : null),
}));

describe('UserFormModal', () => {
  const t = (key: string) => key;
  const firms = [
    { id: 'firm-1', name: 'Acme' },
    { id: 'firm-2', name: 'Globex' },
  ];

  it('submits a new admin user with the selected firm', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <UserFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        user={null}
        firms={firms}
        t={t}
      />
    );

    const textInputs = container.querySelectorAll('input');
    const selects = container.querySelectorAll('select');

    fireEvent.change(textInputs[0], { target: { value: 'Lookman' } });
    fireEvent.change(textInputs[1], { target: { value: 'lookman@yopmail.com' } });
    fireEvent.change(textInputs[4], { target: { value: 'Password123!' } });
    fireEvent.change(selects[0], { target: { value: 'firm-1' } });
    fireEvent.change(selects[1], { target: { value: 'admin' } });
    fireEvent.change(selects[2], { target: { value: 'Active' } });

    fireEvent.click(screen.getByRole('button', { name: 'users.management.modal.save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Lookman',
      email: 'lookman@yopmail.com',
      password: 'Password123!',
      firmId: 'firm-1',
      role: 'admin',
      status: 'Active',
    }));
  });

  it('pre-fills an existing user and does not render the password field in edit mode', () => {
    const { container } = render(
      <UserFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        user={{
          id: 'user-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          firmId: 'firm-2',
          role: 'user',
          status: 'active',
        }}
        firms={firms}
        t={t}
      />
    );

    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
    expect((container.querySelectorAll('select')[0] as HTMLSelectElement).value).toBe('firm-2');
    expect((container.querySelectorAll('select')[2] as HTMLSelectElement).value).toBe('Active');
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });
});
