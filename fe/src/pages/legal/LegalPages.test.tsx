// Semana 8 del bootcamp — páginas legales y plantilla compartida.
// Cubre política, términos y las variantes de LegalPage (numeración, listas y
// tarjetas). Render con enrutador y proveedor de idioma reales.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';
import { FaCircleCheck } from 'react-icons/fa6';

import LegalPage from '@components/legal/LegalPage';
import PoliticaPrivacidad from './PoliticaPrivacidad';
import TerminosUso from './TerminosUso';
import Contacto from './Contacto';

function montar(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <IdiomaProvider>{ui}</IdiomaProvider>
    </MemoryRouter>,
  );
}

describe('Páginas legales', () => {
  it('la política de privacidad muestra título, actualización y secciones', () => {
    // Act
    montar(<PoliticaPrivacidad />);

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText(/Última actualización/i)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByRole('link', { name: /Volver al inicio/i })).toBeTruthy();
    expect(screen.getByText(/Todos los derechos reservados/i)).toBeTruthy();
  });

  it('los términos de uso renderizan sus secciones y listas de obligaciones', () => {
    // Act
    montar(<TerminosUso />);

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(7);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('link', { name: /Volver al inicio/i }).getAttribute('href')).toBe('/');
  });

  it('Contacto muestra canales, horarios y acceso al centro de ayuda', () => {
    montar(<Contacto />);

    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText('soporte@neodomus.com')).toBeTruthy();
    expect(screen.getByText('+57 601 123 4567')).toBeTruthy();
    expect(screen.getByText('Cra 15 #93-47, Bogotá')).toBeTruthy();
    expect(screen.getByRole('link', { name: /centro de ayuda/i }).getAttribute('href')).toBe('/ayuda');
  });

  it('LegalPage admite secciones sin numerar, párrafos y tarjetas', () => {
    // Arrange
    const secciones = [
      {
        titulo: 'Sin número',
        parrafos: ['Un párrafo de prueba'],
        items: [
          { texto: 'Elemento check', tipo: 'check' as const },
          { texto: 'Elemento punto', tipo: 'punto' as const },
        ],
      },
      {
        tarjetas: [
          {
            icono: <FaCircleCheck />,
            titulo: 'Tarjeta',
            valor: 'Valor',
            descripcion: 'Descripción de la tarjeta',
          },
        ],
      },
    ];

    // Act
    const { container } = montar(
      <LegalPage
        icono={<FaCircleCheck />}
        titulo="Documento de prueba"
        actualizacion="Hoy"
        secciones={secciones as any}
        numeradas={false}
      />,
    );

    // Assert
    expect(screen.getByText('Documento de prueba')).toBeTruthy();
    expect(screen.getByText('Un párrafo de prueba')).toBeTruthy();
    expect(screen.getByText('Elemento check')).toBeTruthy();
    expect(screen.getByText('Elemento punto')).toBeTruthy();
    expect(screen.getByText('Tarjeta')).toBeTruthy();
    expect(screen.getByText('Descripción de la tarjeta')).toBeTruthy();
    expect(container.querySelector('.sin-numero')).toBeTruthy();
    expect(container.querySelectorAll('.legal-ic-check').length).toBe(1);
    expect(container.querySelectorAll('.legal-ic-punto').length).toBe(1);
  });
});
