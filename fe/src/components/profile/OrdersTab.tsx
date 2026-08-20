import { useEffect, useState } from 'react';
import { FaBoxOpen, FaChevronDown, FaChevronUp, FaFilePdf, FaCircleCheck } from 'react-icons/fa6';
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
  id_tecnico_entrega?: number | null;
  nombre_tecnico_entrega?: string | null;
  telefono_tecnico_entrega?: string | null;
  foto_tecnico_entrega?: string | null;
  estado_entrega?: string | null;
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
                  onClick={() => setExpanded(abierto ? null : pedido.id_pedido)}
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
                        {pedido.detalles.map((item, idx) => (
                          <div className="pf-order-item" key={idx}>
                            <span className="pf-order-item-name">
                              {item.nombre}
                              {item.es_servicio ? ' (servicio)' : ''}
                            </span>
                            <span className="pf-order-item-qty">
                              {item.metros != null ? `× ${item.metros} m` : `× ${item.cantidad}`}
                            </span>
                            <span className="pf-order-item-price">{formatoPeso(item.subtotal)}</span>
                          </div>
                        ))}
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

                    {pedido.fecha_entrega && (
                      <div className="pf-detail-block">
                        <h4 className="pf-detail-title">Entrega</h4>
                        <div className="pf-detail-grid">
                          <div className="pf-detail-row">
                            <span className="pf-detail-label">Fecha de entrega</span>
                            <span className="pf-detail-value">
                              {new Date(pedido.fecha_entrega).toLocaleDateString('es-CO')}
                              {pedido.hora_entrega ? ` · ${pedido.hora_entrega}` : ''}
                            </span>
                          </div>
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
                      </div>
                    )}

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
