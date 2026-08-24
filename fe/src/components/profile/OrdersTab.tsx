import { Fragment, useEffect, useRef, useState } from 'react';
import {
  FaBoxOpen,
  FaChevronDown,
  FaChevronUp,
  FaFilePdf,
  FaCircleCheck,
  FaLocationDot,
  FaRotateLeft,
  FaStar,
} from 'react-icons/fa6';
import api, { descargarFactura } from '@services/api';
import SectionHeader from './SectionHeader';
import { NotifyFn } from './PersonalTab';

interface Detalle {
  id_detalle: number;
  id_producto_d: number | null;
  nombre: string;
  cantidad: number;
  metros: number | null;
  precio_unitario: number;
  subtotal: number;
  es_servicio: boolean;
  fecha_servicio?: string | null;
}

interface Factura {
  id_factura: number;
  numero_factura: string;
  enviada_por_correo: boolean;
  pdf_url?: string;
}

interface Pago {
  id_pago: number;
  metodo_pago?: string;
  metodo_pago_nombre?: string;
  estado: string;
  numero_transaccion?: string | null;
  codigo_punto_pago?: string | null;
  banco?: string | null;
  ultimos_digitos?: string | null;
}

interface Pedido {
  id_pedido: number;
  fecha?: string | null;
  total: number;
  estado: string;
  pago?: Pago | null;
  factura?: Factura | null;
  detalles: Detalle[];
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  hora_entrega_fin?: string | null;
  id_tecnico_entrega?: number | null;
  nombre_tecnico_entrega?: string | null;
  telefono_tecnico_entrega?: string | null;
  foto_tecnico_entrega?: string | null;
  estado_entrega?: string | null;
}

interface PasoSeguimiento {
  paso: string;
  completado: boolean;
}

interface Seguimiento {
  estado_entrega: string;
  pasos: PasoSeguimiento[];
  rango_entrega?: string | null;
  tecnico?: { nombre?: string; telefono?: string; foto?: string } | null;
  ubicacion?: { latitud: number; longitud: number; actualizado_en: string } | null;
}

interface CalificacionProducto {
  id_calificacion_producto: number;
  id_producto: number;
  calificacion: number;
  comentario?: string | null;
}

interface Devolucion {
  id_devolucion: number;
  id_pedido: number | null;
  id_producto: number | null;
  producto?: string | null;
  motivo: string;
  estado: string;
}

const estadoColor: Record<string, string> = {
  Pagado: '#28a745',
  'Pago pendiente': '#d3ac4d',
  'Pago rechazado': '#dc3545',
  Cancelado: '#dc3545',
};

const formatoPeso = (value: number) =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const formatearFecha = (fecha?: string | null) => {
  if (!fecha) return '';
  try {
    return new Date(fecha).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fecha;
  }
};

const pagoEstadoInfo = (estado?: string | null): { texto: string; clase: string } => {
  switch ((estado || '').toLowerCase()) {
    case 'aprobado':
    case 'pagado':
      return { texto: 'Pago aprobado', clase: 'ok' };
    case 'rechazado':
      return { texto: 'Pago rechazado', clase: 'error' };
    case 'pendiente':
      return { texto: 'Pago pendiente', clase: 'pendiente' };
    default:
      return { texto: estado || '—', clase: '' };
  }
};

const OrdersTab = ({ notify }: { notify: NotifyFn }) => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [seguimientoDe, setSeguimientoDe] = useState<number | null>(null);
  const [seguimiento, setSeguimiento] = useState<Seguimiento | null>(null);
  const [califsPorProducto, setCalifsPorProducto] = useState<Record<number, CalificacionProducto>>({});
  const [devoluciones, setDevoluciones] = useState<Record<string, Devolucion>>({});
  const [ratingSel, setRatingSel] = useState<Record<number, number>>({});
  const [comentarioSel, setComentarioSel] = useState<Record<number, string>>({});
  const [guardandoCalif, setGuardandoCalif] = useState<number | null>(null);
  const [motivoDev, setMotivoDev] = useState<{ key: string; texto: string } | null>(null);
  const [preferenciaDev, setPreferenciaDev] = useState<Record<string, string>>({});
  const [enviandoDev, setEnviandoDev] = useState(false);
  const pollRef = useRef<number | null>(null);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      const res = await api.get<Pedido[]>('/pedidos/mis-pedidos');
      setPedidos(res.data || []);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('No se pudieron cargar tus pedidos. Intenta más tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const confirmarPago = async (pedidoId: number) => {
    setConfirmando(pedidoId);
    try {
      await api.post(`/pedidos/${pedidoId}/confirmar-pago`);
      notify(`Pago del pedido #${pedidoId} confirmado. ¡Gracias!`, 'success');
      await cargarPedidos();
    } catch (err: any) {
      const detalle = err.response?.data?.detail || 'No se pudo confirmar el pago.';
      notify(typeof detalle === 'string' ? detalle : 'No se pudo confirmar el pago.', 'error');
    } finally {
      setConfirmando(null);
    }
  };

  const cargarSeguimiento = async (pedidoId: number) => {
    try {
      const res = await api.get<Seguimiento>(`/pedidos/${pedidoId}/seguimiento`);
      setSeguimiento(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      setSeguimiento(null);
      return null;
    }
  };

  const alternarRastreo = async (pedidoId: number) => {
    if (seguimientoDe === pedidoId) {
      setSeguimientoDe(null);
      setSeguimiento(null);
      return;
    }
    setSeguimientoDe(pedidoId);
    await cargarSeguimiento(pedidoId);
  };

  useEffect(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (seguimientoDe == null || seguimiento?.estado_entrega !== 'En camino') return;
    const pid = seguimientoDe;
    pollRef.current = window.setInterval(() => {
      cargarSeguimiento(pid);
    }, 15000);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [seguimientoDe, seguimiento?.estado_entrega]);

  const cargarResenas = async (pedido: Pedido) => {
    if (pedido.estado_entrega !== 'Entregado') return;
    try {
      const res = await api.get<{ calificaciones: CalificacionProducto[] }>(
        `/calificaciones/producto/pedido/${pedido.id_pedido}`,
      );
      const mapa: Record<number, CalificacionProducto> = {};
      (res.data?.calificaciones || []).forEach((c) => {
        mapa[c.id_producto] = c;
      });
      setCalifsPorProducto(mapa);
    } catch (err) {
      console.error(err);
    }
    try {
      const res = await api.get<Devolucion[]>('/devoluciones/mias');
      const mapaD: Record<string, Devolucion> = {};
      (res.data || []).forEach((d) => {
        if (d.id_pedido === pedido.id_pedido && d.id_producto) {
          mapaD[`${pedido.id_pedido}-${d.id_producto}`] = d;
        }
      });
      setDevoluciones(mapaD);
    } catch (err) {
      console.error(err);
    }
  };

  const guardarCalificacion = async (pedido: Pedido, item: Detalle) => {
    if (!item.id_producto_d) return;
    const nota = ratingSel[item.id_producto_d];
    if (!nota) {
      notify('Selecciona una cantidad de estrellas antes de enviar.', 'error');
      return;
    }
    setGuardandoCalif(item.id_producto_d);
    try {
      await api.post('/calificaciones/producto', {
        id_pedido: pedido.id_pedido,
        id_producto: item.id_producto_d,
        calificacion: nota,
        comentario: comentarioSel[item.id_producto_d]?.trim() || undefined,
      });
      notify('¡Gracias por tu calificación!', 'success');
      await cargarResenas(pedido);
    } catch (err: any) {
      const detalle = err.response?.data?.detail;
      notify(typeof detalle === 'string' ? detalle : 'No se pudo enviar tu calificación.', 'error');
    } finally {
      setGuardandoCalif(null);
    }
  };

  const solicitarDevolucion = async (pedido: Pedido, item: Detalle) => {
    if (!item.id_producto_d || !motivoDev || motivoDev.texto.trim().length < 10) {
      notify('Cuéntanos brevemente el motivo de la devolución (mínimo 10 caracteres).', 'error');
      return;
    }
    setEnviandoDev(true);
    try {
      await api.post('/devoluciones', {
        id_pedido: pedido.id_pedido,
        id_producto: item.id_producto_d,
        motivo: motivoDev.texto.trim(),
        preferencia: preferenciaDev[motivoDev.key] || 'dinero',
      });
      notify('Tu solicitud de devolución fue enviada. Te contactaremos pronto.', 'success');
      setMotivoDev(null);
      await cargarResenas(pedido);
    } catch (err: any) {
      const detalle = err.response?.data?.detail;
      notify(typeof detalle === 'string' ? detalle : 'No se pudo enviar la solicitud.', 'error');
    } finally {
      setEnviandoDev(false);
    }
  };

  return (
    <div className="pf-tab">
      <SectionHeader
        icon={<FaBoxOpen />}
        title="Mis pedidos"
        subtitle="Consulta el historial de tus compras, su estado y descarga tus facturas."
      />

      {loading ? (
        <div className="pf-empty"><p>Cargando tus pedidos...</p></div>
      ) : error ? (
        <div className="pf-empty"><p>{error}</p></div>
      ) : pedidos.length === 0 ? (
        <div className="pf-empty">
          <span className="pf-empty-icon"><FaBoxOpen /></span>
          <p>No tienes pedidos todavía. Cuando realices una compra, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="pf-orders-list">
          {pedidos.map((pedido) => {
            const abierto = expanded === pedido.id_pedido;
            const colorEstado = estadoColor[pedido.estado] || '#d3ac4d';
            return (
              <div className="pf-order" key={pedido.id_pedido}>
                <div className="pf-order-top">
                  <div className="pf-order-id-col">
                    <span className="pf-order-id">#{pedido.id_pedido}</span>
                    <span className="pf-order-folio">
                      {pedido.factura?.numero_factura || `Pedido ${pedido.id_pedido}`}
                      {pedido.fecha ? ` · ${formatearFecha(pedido.fecha)}` : ''}
                    </span>
                  </div>
                  <div className="pf-order-stats">
                    <span className="pf-status-badge" style={{ background: colorEstado }}>
                      {pedido.estado}
                    </span>
                    <span className="pf-order-total">{formatoPeso(pedido.total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="pf-order-toggle"
                  onClick={() => {
                    const nuevo = !abierto;
                    setExpanded(nuevo ? pedido.id_pedido : null);
                    if (nuevo && pedido.estado_entrega === 'Entregado') {
                      cargarResenas(pedido);
                      setSeguimientoDe(null);
                      setSeguimiento(null);
                    }
                  }}
                  aria-expanded={abierto}
                >
                  {abierto ? <FaChevronUp /> : <FaChevronDown />}
                  <span>{abierto ? 'Ocultar detalle' : 'Ver detalle del pedido'}</span>
                </button>

                {abierto && (
                  <div className="pf-order-details">
                    <div className="pf-detail-block">
                      <h4 className="pf-detail-title">Productos</h4>
                      <div className="pf-order-items">
                        {pedido.detalles.map((item, idx) => {
                          const esProducto = !item.es_servicio && item.id_producto_d != null;
                          const calif = esProducto ? califsPorProducto[item.id_producto_d!] : undefined;
                          const devKey = `${pedido.id_pedido}-${item.id_producto_d}`;
                          const devolucion = esProducto ? devoluciones[devKey] : undefined;
                          return (
                            <Fragment key={idx}>
                              <div className="pf-order-item">
                                <span className="pf-order-item-name">
                                  {item.nombre}
                                  {item.es_servicio ? ' (servicio)' : ''}
                                </span>
                                <span className="pf-order-item-qty">
                                  {item.metros != null ? `× ${item.metros} m` : `× ${item.cantidad}`}
                                </span>
                                <span className="pf-order-item-price">{formatoPeso(item.subtotal)}</span>
                              </div>
                              {esProducto && pedido.estado_entrega === 'Entregado' && (
                                <div className="pf-resena">
                                  {calif ? (
                                    <div className="pf-resena-guardada">
                                      <span className="pf-stars-static" aria-label={`${calif.calificacion} de 5`}>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <FaStar key={s} className={s <= calif.calificacion ? 'on' : ''} />
                                        ))}
                                      </span>
                                      Tu calificación
                                      {calif.comentario ? <em>“{calif.comentario}”</em> : null}
                                    </div>
                                  ) : (
                                    <div className="pf-resena-form">
                                      <span className="pf-resena-label">Califica este producto:</span>
                                      <span className="pf-stars-picker">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <button
                                            key={s}
                                            type="button"
                                            aria-label={`${s} estrellas`}
                                            className={(ratingSel[item.id_producto_d!] ?? 0) >= s ? 'on' : ''}
                                            onClick={() =>
                                              setRatingSel((prev) => ({ ...prev, [item.id_producto_d!]: s }))
                                            }
                                          >
                                            <FaStar />
                                          </button>
                                        ))}
                                      </span>
                                      <input
                                        type="text"
                                        className="pf-resena-comentario"
                                        placeholder="Cuéntanos tu experiencia (opcional)"
                                        maxLength={500}
                                        value={comentarioSel[item.id_producto_d!] || ''}
                                        onChange={(e) =>
                                          setComentarioSel((prev) => ({
                                            ...prev,
                                            [item.id_producto_d!]: e.target.value,
                                          }))
                                        }
                                      />
                                      <button
                                        type="button"
                                        className="pf-resena-guardar"
                                        disabled={guardandoCalif === item.id_producto_d}
                                        onClick={() => guardarCalificacion(pedido, item)}
                                      >
                                        {guardandoCalif === item.id_producto_d ? 'Enviando...' : 'Enviar'}
                                      </button>
                                    </div>
                                  )}
                                  {devolucion ? (
                                    <span
                                      className={`pf-dev-estado ${
                                        devolucion.estado === 'Aprobada'
                                          ? 'ok'
                                          : devolucion.estado === 'Rechazada'
                                            ? 'err'
                                            : ''
                                      }`}
                                    >
                                      Devolución {devolucion.estado.toLowerCase()}
                                    </span>
                                  ) : (
                                    motivoDev?.key === devKey && (
                                      <div className="pf-dev-form">
                                        <textarea
                                          placeholder="¿Qué pasó con este producto? (mínimo 10 caracteres)"
                                          maxLength={1000}
                                          value={motivoDev.texto}
                                          onChange={(e) =>
                                            setMotivoDev({ key: devKey, texto: e.target.value })
                                          }
                                        />
                                        <div className="pf-dev-pref">
                                          <span>¿Qué prefieres?</span>
                                          <label>
                                            <input
                                              type="radio"
                                              name={`pref-${devKey}`}
                                              checked={(preferenciaDev[devKey] || 'dinero') === 'dinero'}
                                              onChange={() => setPreferenciaDev((p) => ({ ...p, [devKey]: 'dinero' }))}
                                            />{' '}
                                            Devolver mi dinero
                                          </label>
                                          <label>
                                            <input
                                              type="radio"
                                              name={`pref-${devKey}`}
                                              checked={preferenciaDev[devKey] === 'producto'}
                                              onChange={() => setPreferenciaDev((p) => ({ ...p, [devKey]: 'producto' }))}
                                            />{' '}
                                            Cambio de producto
                                          </label>
                                        </div>
                                        <div className="pf-dev-form-actions">
                                          <button
                                            type="button"
                                            className="pf-dev-enviar"
                                            disabled={enviandoDev}
                                            onClick={() => solicitarDevolucion(pedido, item)}
                                          >
                                            {enviandoDev ? 'Enviando...' : 'Enviar solicitud'}
                                          </button>
                                          <button
                                            type="button"
                                            className="pf-dev-cancelar"
                                            onClick={() => setMotivoDev(null)}
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  )}
                                  {!devolucion && motivoDev?.key !== devKey && (
                                    <button
                                      type="button"
                                      className="pf-dev-btn"
                                      onClick={() => setMotivoDev({ key: devKey, texto: '' })}
                                    >
                                      <FaRotateLeft /> Solicitar devolución
                                    </button>
                                  )}
                                </div>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {pedido.pago && (
                      <div className="pf-detail-block">
                        <h4 className="pf-detail-title">Pago</h4>
                        <div className="pf-detail-grid">
                          <div className="pf-detail-row">
                            <span className="pf-detail-label">Estado del pago</span>
                            <span className={`pf-pago-estado ${pagoEstadoInfo(pedido.pago.estado).clase}`}>
                              {pagoEstadoInfo(pedido.pago.estado).texto}
                            </span>
                          </div>
                          {pedido.pago.metodo_pago_nombre || pedido.pago.metodo_pago ? (
                            <div className="pf-detail-row">
                              <span className="pf-detail-label">Método de pago</span>
                              <span className="pf-detail-value">
                                {pedido.pago.metodo_pago_nombre || pedido.pago.metodo_pago}
                              </span>
                            </div>
                          ) : null}
                          {pedido.pago.numero_transaccion && (
                            <div className="pf-detail-row pf-detail-row-wide">
                              <span className="pf-detail-label">Número de transacción</span>
                              <span className="pf-detail-value pf-detail-code">
                                {pedido.pago.numero_transaccion}
                              </span>
                            </div>
                          )}
                          {pedido.pago.codigo_punto_pago && (
                            <div className="pf-detail-row pf-detail-row-wide">
                              <span className="pf-detail-label">Código de pago</span>
                              <span className="pf-detail-value pf-detail-code">
                                {pedido.pago.codigo_punto_pago}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pf-detail-block">
                      <h4 className="pf-detail-title">Entrega y rastreo</h4>
                      <div className="pf-detail-grid">
                        <div className="pf-detail-row">
                          <span className="pf-detail-label">Fecha de entrega</span>
                          <span className="pf-detail-value">
                            {pedido.fecha_entrega
                              ? `${new Date(pedido.fecha_entrega).toLocaleDateString('es-CO')}`
                              : 'Por programar'}
                          </span>
                        </div>
                        {(pedido.hora_entrega || pedido.hora_entrega_fin) && (
                          <div className="pf-detail-row">
                            <span className="pf-detail-label">Franja de entrega</span>
                            <span className="pf-detail-value">
                              {pedido.hora_entrega_fin
                                ? `Entre ${pedido.hora_entrega} y ${pedido.hora_entrega_fin}`
                                : pedido.hora_entrega}
                            </span>
                          </div>
                        )}
                        <div className="pf-detail-row">
                          <span className="pf-detail-label">Estado de la entrega</span>
                          <span className="pf-detail-value">{pedido.estado_entrega || '—'}</span>
                        </div>
                        {pedido.nombre_tecnico_entrega && (
                          <div className="pf-detail-row">
                            <span className="pf-detail-label">Técnico asignado</span>
                            <span className="pf-order-tecnico-entrega">
                              {pedido.foto_tecnico_entrega && (
                                <img
                                  src={pedido.foto_tecnico_entrega}
                                  alt={pedido.nombre_tecnico_entrega}
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                              {pedido.nombre_tecnico_entrega}
                            </span>
                          </div>
                        )}
                        {pedido.telefono_tecnico_entrega && (
                          <div className="pf-detail-row">
                            <span className="pf-detail-label">Teléfono del técnico</span>
                            <span className="pf-detail-value">{pedido.telefono_tecnico_entrega}</span>
                          </div>
                        )}
                      </div>
                      {seguimientoDe === pedido.id_pedido && seguimiento && (
                        <div className="pf-tracker">
                          <div className="pf-tracker-pasos">
                            {seguimiento.pasos.map((p) => (
                              <div key={p.paso} className={`pf-tracker-paso ${p.completado ? 'done' : ''}`}>
                                <span className="pf-tracker-dot">{p.completado ? <FaCircleCheck /> : null}</span>
                                <span>{p.paso}</span>
                              </div>
                            ))}
                          </div>
                          {seguimiento.tecnico?.nombre && (
                            <p className="pf-tracker-tecnico">
                              Tu técnico: {seguimiento.tecnico.nombre}
                              {seguimiento.tecnico.telefono ? ` · ${seguimiento.tecnico.telefono}` : ''}
                            </p>
                          )}
                          {seguimiento.rango_entrega && (
                            <p className="pf-tracker-actualizado">
                              Franja de entrega: {seguimiento.rango_entrega}
                            </p>
                          )}
                          {seguimiento.estado_entrega === 'En camino' &&
                            (seguimiento.ubicacion ? (
                              <>
                                <p className="pf-tracker-actualizado">
                                  Ubicación actualizada a las{' '}
                                  {new Date(seguimiento.ubicacion.actualizado_en).toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                                <iframe
                                  title="Ubicación del técnico"
                                  className="pf-tracker-mapa"
                                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${seguimiento.ubicacion.longitud - 0.008}%2C${seguimiento.ubicacion.latitud - 0.005}%2C${seguimiento.ubicacion.longitud + 0.008}%2C${seguimiento.ubicacion.latitud + 0.005}&layer=mapnik&marker=${seguimiento.ubicacion.latitud}%2C${seguimiento.ubicacion.longitud}`}
                                />
                              </>
                            ) : (
                              <p className="pf-tracker-actualizado">
                                El técnico aún no ha compartido su ubicación.
                              </p>
                            ))}
                        </div>
                      )}
                      {seguimientoDe === pedido.id_pedido && !seguimiento && (
                        <p className="pf-tracker-actualizado">Cargando rastreo...</p>
                      )}
                      <button
                        type="button"
                        className="pf-rastreo-btn"
                        onClick={() => alternarRastreo(pedido.id_pedido)}
                      >
                        <FaLocationDot />
                        {seguimientoDe === pedido.id_pedido ? 'Ocultar rastreo' : 'Rastrear mi pedido'}
                      </button>
                    </div>

                    <div className="pf-order-acciones">
                      {pedido.estado === 'Pago pendiente' && (
                        <button
                          type="button"
                          className="pf-order-confirmar"
                          onClick={() => confirmarPago(pedido.id_pedido)}
                          disabled={confirmando === pedido.id_pedido}
                        >
                          <FaCircleCheck />
                          {confirmando === pedido.id_pedido ? 'Confirmando...' : 'Confirmar pago'}
                        </button>
                      )}
                      {pedido.factura?.pdf_url && (
                        <button
                          type="button"
                          className="pf-order-factura"
                          onClick={() => pedido.factura?.pdf_url && descargarFactura(pedido.factura.pdf_url)}
                        >
                          <FaFilePdf /> Descargar factura PDF
                        </button>
                      )}
                    </div>

                    <div className="pf-order-detail-footer">
                      <strong className="pf-order-total-big">Total: {formatoPeso(pedido.total)}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
