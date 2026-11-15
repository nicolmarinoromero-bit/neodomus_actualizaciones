// Semana 7 del bootcamp — modal de nueva novedad (NuevaNovedadModal).
// Cubre los dos pasos, validaciones, prioridad, evidencia opcional, envío,
// carga de la foto y errores del backend. Red simulada y temporizadores reales.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import NuevaNovedadModal from './NuevaNovedadModal';

const propsBase = {
  abierto: true,
  onCerrar: vi.fn(),
  onCreado: vi.fn(),
  tipoOrigen: 'pedido' as const,
  idPedido: 42,
  nombreCliente: 'Ana Torres',
  referenciaLabel: '#42',
};

function montar(overrides: Record<string, unknown> = {}) {
  const props = { ...propsBase, ...overrides };
  const utils = render(
    <IdiomaProvider>
      <NuevaNovedadModal {...(props as any)} />
    </IdiomaProvider>,
  );
  return { ...utils, props };
}

async function completarDetalle() {
  const usuario = userEvent.setup();
  await usuario.selectOptions(screen.getByLabelText('Tipo de novedad *'), 'Otro');
  await usuario.type(
    screen.getByLabelText('Descripcion *'),
    'El cliente no estaba en la dirección indicada.',
  );
  await usuario.click(screen.getByRole('button', { name: /Siguiente/i }));
  return usuario;
}

describe('NuevaNovedadModal', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    propsBase.onCerrar.mockReset();
    propsBase.onCreado.mockReset();
    window.URL.createObjectURL = vi.fn(() => 'blob:evidencia');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cerrado no renderiza nada', () => {
    // Act
    const { container } = montar({ abierto: false });

    // Assert
    expect(container.textContent).toBe('');
  });

  it('muestra el origen, los dos pasos y el botón siguiente deshabilitado', () => {
    // Act
    montar();

    // Assert
    expect(screen.getByText('Agregar novedad')).toBeTruthy();
    expect(screen.getByText(/Pedido #42/)).toBeTruthy();
    expect(screen.getByText('Ana Torres')).toBeTruthy();
    expect(screen.getByText('Detalle')).toBeTruthy();
    expect(screen.getByText('Evidencia')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /Siguiente/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('exige tipo y descripción para avanzar, y permite elegir prioridad', async () => {
    // Arrange
    montar();
    const usuario = userEvent.setup();

    // Act: solo el tipo no habilita el paso.
    await usuario.selectOptions(screen.getByLabelText('Tipo de novedad *'), 'Otro');
    expect(
      (screen.getByRole('button', { name: /Siguiente/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    // Act: descripción con espacios tampoco.
    await usuario.type(screen.getByLabelText('Descripcion *'), '   ');
    expect(
      (screen.getByRole('button', { name: /Siguiente/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    // Act: descripción real y prioridad urgente.
    await usuario.clear(screen.getByLabelText('Descripcion *'));
    await usuario.type(screen.getByLabelText('Descripcion *'), 'Paquete dañado');
    await usuario.click(screen.getByRole('button', { name: 'Urgente' }));

    // Assert
    expect(
      (screen.getByRole('button', { name: /Siguiente/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.getByRole('button', { name: 'Urgente' })).toBeTruthy();
  });

  it('la devolución usa su propio catálogo de tipos', async () => {
    // Act
    montar({ tipoOrigen: 'devolucion', idPedido: undefined, idDevolucion: 7 });
    const select = screen.getByLabelText('Tipo de novedad *');

    // Assert
    expect(within(select).getByRole('option', { name: 'Producto incompleto' })).toBeTruthy();
    expect(screen.getByText(/Devolucion/)).toBeTruthy();
  });

  it('sin evidencia envía la novedad, avisa y cierra al terminar', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: { id_novedad: 10, mensaje: 'ok' } });
    const { props } = montar();
    await completarDetalle();

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Guardar novedad/i }));

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/novedades', {
        tipo_novedad: 'Otro',
        descripcion: 'El cliente no estaba en la dirección indicada.',
        prioridad: 'normal',
        id_pedido: 42,
        id_cita: null,
        id_cliente: null,
        id_devolucion: null,
        lugar_ocurrencia: undefined,
      }),
    );
    expect(await screen.findByText('Novedad registrada correctamente')).toBeTruthy();
    await waitFor(() => expect(props.onCreado).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(props.onCerrar).toHaveBeenCalledTimes(1);
  });

  it('adjunta una foto válida y la sube tras crear la novedad', async () => {
    // Arrange
    apiMock.post
      .mockResolvedValueOnce({ data: { id_novedad: 77, mensaje: 'ok' } })
      .mockResolvedValueOnce({ data: { mensaje: 'evidencia ok' } });
    const { props } = montar();
    await completarDetalle();
    const archivo = new File(['foto'], 'evidencia.png', { type: 'image/png' });

    // Act
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });
    expect(await screen.findByAltText('Evidencia')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: /Guardar novedad/i }));

    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(2));
    const [url, formData, config] = apiMock.post.mock.calls[1];
    expect(url).toBe('/novedades/77/evidencia');
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get('file')).toBe(archivo);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    await waitFor(() => expect(props.onCreado).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('rechaza imágenes de más de 5 MB', async () => {
    // Arrange
    montar();
    await completarDetalle();
    const archivo = new File(['x'], 'grande.png', { type: 'image/png' });
    Object.defineProperty(archivo, 'size', { value: 6 * 1024 * 1024 });

    // Act
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    // Assert
    expect(await screen.findByText('La imagen no puede superar 5 MB')).toBeTruthy();
    expect(screen.queryByAltText('Evidencia')).toBeNull();
  });

  it('rechaza formatos no permitidos y permite quitar la evidencia', async () => {
    // Arrange
    montar();
    await completarDetalle();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

    // Act: formato inválido.
    fireEvent.change(input, { target: { files: [pdf] } });

    // Assert
    expect(
      await screen.findByText('Formato no permitido (JPG, PNG, WEBP o GIF)'),
    ).toBeTruthy();

    // Act: imagen válida y luego eliminarla.
    fireEvent.change(input, {
      target: { files: [new File(['ok'], 'ok.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByAltText('Evidencia')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: /Eliminar/i }));

    // Assert
    expect(screen.queryByAltText('Evidencia')).toBeNull();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:evidencia');
  });

  it('si falla la evidencia la novedad queda creada y se informa', async () => {
    // Arrange
    apiMock.post
      .mockResolvedValueOnce({ data: { id_novedad: 88, mensaje: 'ok' } })
      .mockRejectedValueOnce(new Error('upload'));
    const { props } = montar();
    await completarDetalle();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['ok'], 'ok.png', { type: 'image/png' })] },
    });
    await screen.findByAltText('Evidencia');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Guardar novedad/i }));

    // Assert
    expect(
      await screen.findByText('Novedad creada pero error al subir evidencia'),
    ).toBeTruthy();
    await waitFor(() => expect(props.onCreado).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('si el backend rechaza la novedad muestra el detalle y no cierra', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ response: { data: { detail: 'Pedido inexistente' } } });
    const { props } = montar();
    await completarDetalle();

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Guardar novedad/i }));

    // Assert
    expect(await screen.findByText('Pedido inexistente')).toBeTruthy();
    expect(props.onCreado).not.toHaveBeenCalled();
    expect(props.onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Agregar novedad/i })).toBeTruthy();
  });

  it('atrás vuelve al detalle conservando lo escrito y cancelar cierra', async () => {
    // Arrange
    montar();
    await completarDetalle();

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Atras/i }));

    // Assert
    expect((screen.getByLabelText('Descripcion *') as HTMLTextAreaElement).value).toBe(
      'El cliente no estaba en la dirección indicada.',
    );

    // Act: cancelar desde el paso 1.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert
    expect(propsBase.onCerrar).toHaveBeenCalledTimes(1);
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});