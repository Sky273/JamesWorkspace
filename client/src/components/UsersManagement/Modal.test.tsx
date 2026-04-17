import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('UsersManagement Modal', () => {
  it('exposes dialog semantics and a labelled close button', () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Créer un utilisateur">
        <p>Contenu du modal</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Créer un utilisateur' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Fermer Créer un utilisateur' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
