import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';
import InfoSectionsContainer from './InfoSectionsContainer';

describe('InfoSectionsContainer', () => {
  it('presenta las secciones institucionales y las tres entradas del blog', () => {
    render(
      <IdiomaProvider>
        <InfoSectionsContainer />
      </IdiomaProvider>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(3);
    expect(screen.getByText('Neodomus')).toBeTruthy();
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('24/7')).toBeTruthy();
    expect(screen.getByText('+500')).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });
});
