import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/empty-state';

describe('EmptyState', () => {
  it('renders title, description, and optional action', () => {
    render(
      <EmptyState
        title="No books"
        description="Import a CSV to get started."
        action={<button type="button">Import now</button>}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'No books',
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Import a CSV to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import now' })).toBeInTheDocument();
  });
});
