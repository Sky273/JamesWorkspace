import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';

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

vi.mock('../AdminFirmSelector', () => ({
  default: ({
    selectedFirmId,
    onFirmChange,
    disabled,
    firms,
    label,
  }: {
    selectedFirmId: string;
    onFirmChange: (firmId: string) => void;
    disabled?: boolean;
    firms?: Array<{ id: string; name: string }>;
    label?: string;
  }) => (
    <div>
      <label htmlFor="firm-selector">{label}</label>
      <select
        id="firm-selector"
        value={selectedFirmId}
        onChange={(event) => onFirmChange(event.target.value)}
        disabled={disabled}
      >
        {firms?.map((firm) => (
          <option key={firm.id} value={firm.id}>
            {firm.name}
          </option>
        ))}
      </select>
    </div>
  ),
}));

const useAuthMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('UserFormModal', () => {
  const t = ((key: string) => key) as TFunction;
  const firms = [
    { id: 'firm-1', name: 'Acme' },
    { id: 'firm-2', name: 'Globex' },
  ];

  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'admin',
        firmId: 'firm-1',
        firmName: 'Acme',
      },
    });
  });

  it('submits a new local admin user with the selected firm and no password field', () => {
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
    fireEvent.change(selects[0], { target: { value: 'firm-1' } });
    fireEvent.change(selects[1], { target: { value: 'localAdmin' } });
    fireEvent.change(selects[2], { target: { value: 'Active' } });

    fireEvent.click(screen.getByRole('button', { name: 'users.management.modal.save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Lookman',
      email: 'lookman@yopmail.com',
      firmId: 'firm-1',
      role: 'localAdmin',
      status: 'Active',
    }));
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });

  it('defaults a new super-admin-created user to the current admin firm', () => {
    const onSubmit = vi.fn();

    render(
      <UserFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        user={null}
        firms={firms}
        t={t}
      />
    );

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Lookman' } });
    fireEvent.change(textboxes[1], { target: { value: 'lookman@yopmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'users.management.modal.save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      firmId: 'firm-1',
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

  it('hides super admin role and locks firm selection when local admin permissions are applied', () => {
    render(
      <UserFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        user={null}
        firms={[firms[0]]}
        canAssignSuperAdmin={false}
        canChangeFirm={false}
        t={t}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const firmSelect = selects[0] as HTMLSelectElement;
    const roleSelect = selects[1] as HTMLSelectElement;

    expect(firmSelect).toBeDisabled();
    expect(firmSelect.value).toBe('firm-1');
    expect(screen.queryByRole('option', { name: 'users.management.roles.admin' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'users.management.roles.localAdmin' })).toBeInTheDocument();
    expect(roleSelect.value).toBe('user');
  });
});
