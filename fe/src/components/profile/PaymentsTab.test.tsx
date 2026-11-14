// Semana 7 del bootcamp — métodos de pago del perfil (PaymentsTab).
// Cubre listado, alta, validaciones, edición, predeterminado y borrado con
// persistencia en localStorage. Sin red externa.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

import PaymentsTab from './PaymentsTab';

const TARJETA = {
  id: 'pay-1',
  tipo: 'tarjeta' as const,
  titular: 'Carolina Mendez',
  numero: '4111111111114242',
  expiracion: '12/30',
  predeterminado: true,
};
const NEQUI = {
  id: 'pay-2',
  tipo: 'nequi' as const,
  titular: 'Luis Perez',
  numero: '3001234567',
  expiracion: '12/30',
  predeterminado: false,
};

function montar() {
  const notify = vi.fn();
  const utils = render(
    <IdiomaProvider>
      <PaymentsTab notify={notify} />
    </IdiomaProvider>,
  );
  return { notify, ...utils };
}

function sembrar(metodos: unknown[]) {
  localStorage.setItem('pf_pagos', JSON.stringify(metodos));
}

function leerPagos() {
  return JSON.parse(localStorage.getItem('pf_pagos') || '[]');
}

describe('PaymentsTab', () => {
  beforeEach(() => {
    localStorage.clear();
    // Arranque sin los métodos de ejemplo: cada prueba siembra su escenario.
    sembrar([]);
  });

  it('sin métodos muestra el estado vacío', () => {
    // Arrange: un arreglo vacío explícito evita los métodos de ejemplo.
    sembrar([]);

    // Act
    montar();

    // Assert
    expect(screen.getByText('No tienes métodos de pago registrados.')).toBeTruthy();
  });

  it('lista tarjetas enmascaradas y distingue la predeterminada', () => {
    // Arrange
    sembrar([TARJETA, NEQUI]);

    // Act
    montar();

    // Assert
    expect(screen.getByText('Visa 4111 •••• •••• 4242')).toBeTruthy();
    expect(screen.getByText('Nequi 3001234567')).toBeTruthy();
    expect(screen.getByText('Predeterminado')).toBeTruthy();
    expect(screen.getByText('Vence 12/30')).toBeTruthy();
  });

  it('agrega un método de pago y lo persiste', async () => {
    // Arrange
    const { notify } = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: /Agregar método/i }));

    // Act
    await usuario.type(screen.getByLabelText('Titular'), 'Ana Torres');
    await usuario.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
    await usuario.type(screen.getByLabelText('Fecha de vencimiento'), '11/29');
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Agregar método/i }),
    );

    // Assert
    expect(notify).toHaveBeenCalledWith('Método de pago agregado', 'success');
    await waitFor(() => expect(screen.getByText('Visa 4242 •••• •••• 4242')).toBeTruthy());
    const guardados = leerPagos();
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({
      tipo: 'tarjeta',
      titular: 'Ana Torres',
      numero: '4242424242424242',
      expiracion: '11/29',
      predeterminado: true,
    });
  });

  it('exige titular antes de guardar', async () => {
    // Arrange
    const { notify } = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: /Agregar método/i }));

    // Act
    await usuario.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Agregar método/i }),
    );

    // Assert
    expect(screen.getByText('Ingresa el titular del método de pago')).toBeTruthy();
    expect(notify).not.toHaveBeenCalled();
    expect(leerPagos()).toHaveLength(0);
  });

  it('rechaza números demasiado cortos', async () => {
    // Arrange
    montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: /Agregar método/i }));

    // Act
    await usuario.type(screen.getByLabelText('Titular'), 'Ana Torres');
    await usuario.type(screen.getByLabelText('Número de tarjeta'), '123');
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Agregar método/i }),
    );

    // Assert
    expect(screen.getByText('El número ingresado es demasiado corto')).toBeTruthy();
    expect(leerPagos()).toHaveLength(0);
  });

  it('el tipo Nequi oculta el vencimiento y guarda el celular', async () => {
    // Arrange
    const { notify } = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: /Agregar método/i }));

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Nequi' }));
    expect(screen.queryByLabelText('Fecha de vencimiento')).toBeNull();
    await usuario.type(screen.getByLabelText('Titular'), 'Luis Perez');
    await usuario.type(screen.getByLabelText('Número de celular (Nequi)'), '3001234567');
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Agregar método/i }),
    );

    // Assert
    expect(notify).toHaveBeenCalledWith('Método de pago agregado', 'success');
    expect(screen.getByText('Nequi 3001234567')).toBeTruthy();
    expect(leerPagos()[0].tipo).toBe('nequi');
  });

  it('edita un método existente con el formulario precargado', async () => {
    // Arrange
    sembrar([TARJETA]);
    const { notify } = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByTitle('Editar'));

    // Act
    const titular = screen.getByLabelText('Titular') as HTMLInputElement;
    expect(titular.value).toBe('Carolina Mendez');
    await usuario.clear(titular);
    await usuario.type(titular, 'Carolina M.');
    await usuario.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    // Assert
    expect(notify).toHaveBeenCalledWith('Método de pago actualizado', 'success');
    expect(leerPagos()[0].titular).toBe('Carolina M.');
    expect(screen.getByText('Carolina M.')).toBeTruthy();
  });

  it('cambia el método predeterminado', async () => {
    // Arrange
    sembrar([TARJETA, NEQUI]);
    const { notify } = montar();

    // Act
    await userEvent.setup().click(screen.getAllByTitle('Establecer como predeterminado')[1]);

    // Assert
    expect(notify).toHaveBeenCalledWith('Método de pago predeterminado actualizado', 'success');
    const guardados = leerPagos();
    expect(guardados.find((p: any) => p.id === 'pay-2').predeterminado).toBe(true);
    expect(guardados.find((p: any) => p.id === 'pay-1').predeterminado).toBe(false);
  });

  it('elimina un método y promueve otro como predeterminado', async () => {
    // Arrange
    sembrar([TARJETA, NEQUI]);
    const { notify } = montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getAllByTitle('Eliminar')[0]);

    // Act
    const dialogo = screen.getByRole('dialog', { name: 'Eliminar método de pago' });
    await usuario.click(within(dialogo).getByRole('button', { name: /Eliminar/i }));

    // Assert
    expect(notify).toHaveBeenCalledWith('Método de pago eliminado', 'info');
    await waitFor(() => expect(screen.queryByText('Visa 4111 •••• •••• 4242')).toBeNull());
    expect(screen.getByText('Nequi 3001234567')).toBeTruthy();
    expect(leerPagos()).toHaveLength(1);
    expect(leerPagos()[0].predeterminado).toBe(true);
  });

  it('cancelar el diálogo de borrado conserva el método', async () => {
    // Arrange
    sembrar([TARJETA]);
    montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByTitle('Eliminar'));

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert
    expect(screen.getByText('Visa 4111 •••• •••• 4242')).toBeTruthy();
    expect(leerPagos()).toHaveLength(1);
  });
});