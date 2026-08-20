import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCreditCard,
  FaBuildingColumns,
  FaPaypal,
  FaStore,
  FaTrashCan,
  FaCircleCheck,
  FaExclamation,
  FaEnvelope,
  FaSpinner,
  FaPlus,
  FaLocationDot,
  FaFlask,
  FaXmark,
  FaFilePdf,
  FaUsers,
} from 'react-icons/fa6';
import api, { descargarFactura } from '@services/api';
import { useCart } from '@contexts/CartContext';
import { useAuth } from '@contexts/AuthContext';
import { PF_REDIRECT_AFTER_LOGIN_KEY } from '@utils/profileStorage';
import '@styles/checkout.css';

type Metodo = 'tarjeta_debito' | 'tarjeta_credito' | 'pse' | 'paypal' | 'punto_pago';

const METODOS: { codigo: Metodo; nombre: string; icono: any }[] = [
  { codigo: 'tarjeta_debito', nombre: 'Tarjeta débito', icono: FaCreditCard },
  { codigo: 'tarjeta_credito', nombre: 'Tarjeta crédito', icono: FaCreditCard },
  { codigo: 'pse', nombre: 'PSE (Débito bancario)', icono: FaBuildingColumns },
  { codigo: 'paypal', nombre: 'PayPal (simulado)', icono: FaPaypal },
  { codigo: 'punto_pago', nombre: 'Punto de pago (Efecty)', icono: FaStore },
];

const TIPOS_SERVICIO: { tipo: string; precio: number }[] = [
  { tipo: 'Instalación', precio: 120000 },
  { tipo: 'Mantenimiento', precio: 80000 },
  { tipo: 'Reparación', precio: 90000 },
  { tipo: 'Revisión', precio: 60000 },
  { tipo: 'Soporte técnico', precio: 70000 },
];

interface LineaServicio {
  id: number;
  tipo: string;
  nombre: string;
  precio: number;
  fecha?: string;
  hora?: string;
  id_tecnico?: number | null;
  id_tecnico_2?: number | null;
  modo_tecnico?: 'auto' | 'lista';
  modo_tecnico_2?: 'auto' | 'lista';
}

interface TecnicoCheckout {
  id_tecnico: number;
  first_name?: string;
  last_name?: string;
  telefono?: string | null;
  foto_url?: string | null;
  disponible?: boolean;
  calificacion?: number | null;
}

interface OrdenInstalacion {
  id_cita: number;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  id_tecnico_2?: number | null;
  nombre_tecnico_2?: string | null;
  tipo_servicio?: string;
  fecha?: string | null;
  hora?: string;
  direccion?: string;
  estado?: string;
}

interface ResultadoCheckout {
  tipo: 'aprobado' | 'rechazado' | 'pendiente';
  pedido?: any;
  pago?: any;
  factura?: any;
  pdf_url?: string;
  mensaje?: string;
  ordenes_instalacion?: OrdenInstalacion[];
  entrega?: any;
}

const formatoPeso = (value: number) =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { isAuthenticated, rol, loading: authLoading } = useAuth();

  const [metodo, setMetodo] = useState<Metodo>('tarjeta_debito');
  const [pago, setPago] = useState({
    numero: '',
    titular: '',
    expiracion: '',
    cvv: '',
    banco: '',
    correo_paypal: '',
    resultado_simulacion: '',
    punto_pago: '',
    cuotas: 1,
  });
  const [bancos, setBancos] = useState<string[]>([]);
  const [metodosDisponibles, setMetodosDisponibles] = useState<Metodo[] | null>(null);
  const [servicios, setServicios] = useState<LineaServicio[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoCheckout | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [direccionCliente, setDireccionCliente] = useState('');
  const [tecnicosMap, setTecnicosMap] = useState<Record<number, TecnicoCheckout[]>>({});
  const hoyISO = new Date().toISOString().split('T')[0];
  const ahoraLocal = new Date();
  const horaActual = `${String(ahoraLocal.getHours()).padStart(2, '0')}:${String(ahoraLocal.getMinutes()).padStart(2, '0')}`;

  const totalServicios = servicios.reduce((acc, s) => acc + s.precio, 0);
  const total = totalPrice + totalServicios;
  const maxTecnicos = Math.max(1, ...items.map((i) => Number(i.tecnicos_requeridos) || 1));

  useEffect(() => {
    api.get('/pedidos/metodos-pago').then((res) => {
      if (res.data?.bancos) setBancos(res.data.bancos);
      if (res.data?.metodos) {
        setMetodosDisponibles(Object.keys(res.data.metodos) as Metodo[]);
      }
    }).catch(() => undefined);
    api.get('/clients/me').then((res) => {
      setDireccionCliente(res.data?.address || '');
    }).catch(() => undefined);
  }, []);

  const firmaServicios = servicios.map((s) => `${s.id}-${s.tipo}-${s.fecha || ''}-${s.hora || ''}`).join('|');
  useEffect(() => {
    if (servicios.length === 0) return;
    const params = new URLSearchParams();
    servicios.forEach((s) => {
      const tipoNorm = s.tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      params.set('tipo_servicio', tipoNorm);
      if (s.fecha) params.set('fecha', s.fecha);
      if (s.hora) params.set('hora', s.hora);
      api.get(`/tecnicos/publicos?${params.toString()}`)
        .then((res) => {
          setTecnicosMap((prev) => {
            if (prev[s.id] === res.data) return prev;
            return { ...prev, [s.id]: res.data || [] };
          });
        })
        .catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaServicios, servicios.length]);

  const agregarServicio = () => {
    const primero = TIPOS_SERVICIO[0];
    setServicios((prev) => [
      ...prev,
      {
        id: Date.now(),
        tipo: primero.tipo,
        nombre: primero.tipo,
        precio: primero.precio,
        fecha: '',
        hora: '08:00',
        id_tecnico: null,
        id_tecnico_2: null,
        modo_tecnico: 'auto',
        modo_tecnico_2: 'auto',
      },
    ]);
  };

  const cambiarTipoServicio = (id: number, tipo: string) => {
    const info = TIPOS_SERVICIO.find((t) => t.tipo === tipo) || TIPOS_SERVICIO[0];
    setServicios((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, tipo, nombre: tipo, precio: info.precio, fecha: '', hora: '08:00', id_tecnico: null, id_tecnico_2: null, modo_tecnico: 'auto', modo_tecnico_2: 'auto' } : s
      )
    );
  };

  const actualizarServicio = (id: number, campo: keyof LineaServicio, valor: string) => {
    setServicios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [campo]: valor } : s))
    );
  };

  const quitarServicio = (id: number) => {
    setServicios((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePagar = async () => {
    setError('');
    if (items.length === 0) {
      setError('Tu carrito está vacío. Agrega productos antes de finalizar la compra.');
      return;
    }

    const payloadPago: any = { metodo };
    if (pago.resultado_simulacion) payloadPago.resultado_simulacion = pago.resultado_simulacion;
    if (pago.punto_pago) payloadPago.punto_pago = pago.punto_pago;
    payloadPago.cuotas = pago.cuotas;
    if (metodo === 'tarjeta_debito' || metodo === 'tarjeta_credito') {
      payloadPago.numero = pago.numero;
      payloadPago.titular = pago.titular;
      payloadPago.expiracion = pago.expiracion;
      payloadPago.cvv = pago.cvv;
      if (!pago.numero || !pago.titular || !pago.expiracion || !pago.cvv) {
        setError('Completa los datos de la tarjeta.');
        return;
      }
      if (!pago.resultado_simulacion) {
        setError('Selecciona el resultado de simulación (aprobado o rechazado).');
        return;
      }
    } else if (metodo === 'pse') {
      payloadPago.banco = pago.banco;
      payloadPago.titular = pago.titular;
      if (!pago.banco) {
        setError('Selecciona un banco para pagar por PSE.');
        return;
      }
      if (!pago.resultado_simulacion) {
        setError('Selecciona el resultado de simulación (aprobado, rechazado o pendiente).');
        return;
      }
    } else if (metodo === 'paypal') {
      payloadPago.correo_paypal = pago.correo_paypal;
      if (!pago.correo_paypal) {
        setError('Ingresa el correo de tu cuenta PayPal.');
        return;
      }
      if (!pago.resultado_simulacion) {
        setError('Selecciona el resultado de simulación (aprobado o rechazado).');
        return;
      }
    } else if (metodo === 'punto_pago') {
      if (!pago.punto_pago) {
        setError('Selecciona el punto de pago (Efecty, Servientrega u otro).');
        return;
      }
    }

    for (const s of servicios) {
      if (!s.fecha) {
        setError('Selecciona la fecha en que deseas el servicio técnico.');
        return;
      }
      const fechaHora = new Date(`${s.fecha}T${s.hora || '08:00'}:00`);
      if (isNaN(fechaHora.getTime()) || fechaHora.getTime() <= Date.now()) {
        setError('La fecha y hora del servicio debe ser posterior al momento actual.');
        return;
      }
      if (s.modo_tecnico === 'lista' && !s.id_tecnico) {
        setError('Selecciona un técnico de la lista o elige asignación automática.');
        return;
      }
      if (s.modo_tecnico_2 === 'lista' && !s.id_tecnico_2) {
        setError('Selecciona el segundo técnico de la lista o elige asignación automática.');
        return;
      }
    }

    setProcesando(true);
    try {
      const res = await api.post('/pedidos', {
        items: items.map((i) => ({
          id_producto: i.id_producto,
          cantidad: i.venta_por_metros ? 1 : i.cantidad,
          metros: i.venta_por_metros ? i.metros : undefined,
          color: i.color,
        })),
        servicios: servicios.map((s) => ({
          nombre: s.nombre,
          tipo_servicio: s.tipo,
          precio: s.precio,
          fecha: s.fecha || undefined,
          hora: s.hora || '08:00',
          id_tecnico: s.modo_tecnico === 'lista' ? s.id_tecnico ?? undefined : undefined,
          id_tecnico_2: s.modo_tecnico_2 === 'lista' ? s.id_tecnico_2 ?? undefined : undefined,
        })),
        pago: payloadPago,
      });
      const data = res.data;
      if (data.redirect_url) {
        setProcesando(false);
        window.location.href = data.redirect_url;
        return;
      }
      const estadoPago = data.pago?.estado;
      if (estadoPago === 'aprobado') {
        clearCart();
        window.dispatchEvent(new CustomEvent('notificaciones-refresh'));
        setResultado({
          tipo: 'aprobado',
          pedido: data.pedido,
          pago: data.pago,
          factura: data.factura,
          pdf_url: data.pdf_url,
          ordenes_instalacion: data.ordenes_instalacion || [],
          entrega: data.entrega || undefined,
        });
      } else if (estadoPago === 'pendiente') {
        setResultado({
          tipo: 'pendiente',
          pedido: data.pedido,
          pago: data.pago,
          mensaje:
            'Tu pago quedó pendiente. Realiza el pago en el punto físico con el código generado y luego confírmalo aquí.',
        });
      } else {
        setResultado({
          tipo: 'rechazado',
          pedido: data.pedido,
          pago: data.pago,
          mensaje: 'El pago fue rechazado por el sistema. Tu carrito se conserva: revisa los datos e inténtalo de nuevo.',
        });
      }
    } catch (err: any) {
      const detalle = err.response?.data?.detail || err.response?.data?.message || 'No se pudo procesar el pedido. Intenta de nuevo.';
      setError(typeof detalle === 'string' ? detalle : 'No se pudo procesar el pedido. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  const confirmarPago = async () => {
    if (!resultado?.pedido?.id_pedido) return;
    setProcesando(true);
    setError('');
    try {
      const res = await api.post(`/pedidos/${resultado.pedido.id_pedido}/confirmar-pago`);
      const data = res.data;
      clearCart();
      window.dispatchEvent(new CustomEvent('notificaciones-refresh'));
      setResultado({
        tipo: 'aprobado',
        pedido: data.pedido,
        pago: data.pago,
        factura: data.factura,
        pdf_url: data.pdf_url,
        ordenes_instalacion: data.ordenes_instalacion || [],
        entrega: data.entrega || undefined,
      });
    } catch (err: any) {
      const detalle = err.response?.data?.detail || 'No se pudo confirmar el pago. Intenta de nuevo.';
      setError(typeof detalle === 'string' ? detalle : 'No se pudo confirmar el pago.');
    } finally {
      setProcesando(false);
    }
  };

  const descargarFacturaPedido = async () => {
    if (!resultado?.pdf_url) return;
    setDescargando(true);
    try {
      await descargarFactura(resultado.pdf_url);
    } finally {
      setDescargando(false);
    }
  };

  const reiniciar = () => {
    setResultado(null);
    setError('');
    setServicios([]);
    setPago({ numero: '', titular: '', expiracion: '', cvv: '', banco: '', correo_paypal: '', resultado_simulacion: '', punto_pago: '', cuotas: 1 });
  };

  // Pantalla de éxito (modal)
  if (resultado?.tipo === 'aprobado') {
    return (
      <div className="checkout-modal-overlay">
        <main className="checkout-modal app-glass" role="dialog" aria-modal="true" aria-label="Confirmación de compra">
          <header className="checkout-modal-header">
            <div className="checkout-modal-head-left">
              <div className="checkout-modal-icon">
                <FaCircleCheck />
              </div>
              <div className="checkout-modal-titles">
                <h1>¡Pago exitoso!</h1>
                <p>Tu pedido fue registrado correctamente.</p>
              </div>
            </div>
            <button
              type="button"
              className="checkout-modal-close"
              onClick={() => navigate('/productos')}
              aria-label="Cerrar confirmación de compra"
              title="Cerrar"
            >
              <FaXmark />
            </button>
          </header>

          <div className="checkout-modal-body">
            {resultado.factura?.enviada_por_correo ? (
              <p className="checkout-correo-ok">
                <FaEnvelope /> La factura fue enviada correctamente a tu correo electrónico.
              </p>
            ) : (
              <p className="checkout-correo-warn">
                Pago exitoso. Tu factura fue generada correctamente.
              </p>
            )}

            <div className="checkout-success-datos">
              <div><span>Pedido:</span><strong>#{resultado.pedido?.id_pedido}</strong></div>
              <div><span>Factura:</span><strong>{resultado.factura?.numero_factura}</strong></div>
              <div><span>Total:</span><strong>{formatoPeso(resultado.pedido?.total || 0)}</strong></div>
              <div><span>Transacción:</span><strong>{resultado.pago?.numero_transaccion}</strong></div>
            </div>

            {resultado.ordenes_instalacion && resultado.ordenes_instalacion.length > 0 && (
              <div className="checkout-ordenes-instalacion">
                <h2>Instalación agendada</h2>
                {resultado.ordenes_instalacion.map((o, idx) => (
                  <div className="checkout-orden-instalacion" key={idx}>
                    <div><span>Estado:</span><strong>{o.estado}</strong></div>
                    <div><span>Técnico:</span><strong>{o.nombre_tecnico || 'Por asignar'}{o.nombre_tecnico_2 ? ` y ${o.nombre_tecnico_2}` : ''}</strong></div>
                    <div><span>Fecha:</span><strong>{o.fecha ? (() => { const [a, m, d] = o.fecha.split('-').map(Number); return a ? new Date(a, m - 1, d).toLocaleDateString('es-CO') : o.fecha; })() : ''} {o.hora ? ` · ${o.hora}` : ''}</strong></div>
                    <div><span>Dirección:</span><strong>{o.direccion || 'Por definir'}</strong></div>
                  </div>
                ))}
              </div>
            )}

            {resultado.entrega && (
              <div className="checkout-ordenes-instalacion">
                <h2>Entrega programada</h2>
                <div className="checkout-entrega-tecnico">
                  {resultado.entrega.foto_tecnico && (
                    <img
                      src={resultado.entrega.foto_tecnico}
                      alt={resultado.entrega.nombre_tecnico || 'Técnico'}
                      className="checkout-entrega-foto"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div className="checkout-entrega-info">
                    <div><span>Fecha de entrega:</span><strong>{resultado.entrega.fecha_entrega ? new Date(resultado.entrega.fecha_entrega).toLocaleDateString('es-CO') : ''} · {resultado.entrega.hora_entrega || ''}</strong></div>
                    <div><span>Técnico asignado:</span><strong>{resultado.entrega.nombre_tecnico || 'Por asignar'}</strong></div>
                    {resultado.entrega.telefono_tecnico && (
                      <div><span>Teléfono:</span><strong>{resultado.entrega.telefono_tecnico}</strong></div>
                    )}
                  </div>
                </div>
                <p className="checkout-entrega-nota">
                  Verifica la identidad del técnico con la foto y el nombre antes de recibir tu pedido. Recibirás un aviso por correo antes de la entrega.
                </p>
              </div>
            )}
          </div>

          <footer className="checkout-modal-footer">
            <div className="checkout-success-acciones">
              <button type="button" className="checkout-pdf-btn" onClick={() => navigate('/productos')}>
                Seguir comprando
              </button>
              <button
                type="button"
                className="checkout-volver-btn"
                onClick={() => navigate('/carrito')}
              >
                Volver al carrito
              </button>
              {resultado.pdf_url && (
                <button
                  type="button"
                  className="checkout-volver-btn"
                  onClick={descargarFacturaPedido}
                  disabled={descargando}
                >
                  <FaFilePdf /> {descargando ? 'Descargando...' : 'Descargar factura PDF'}
                </button>
              )}
            </div>
          </footer>
        </main>
      </div>
    );
  }

  // Pantalla de pago pendiente
  if (resultado?.tipo === 'pendiente') {
    return (
      <div className="checkout-page app-glass">
        <main className="checkout-main checkout-pendiente">
          <div className="checkout-pendiente-icon"><FaStore /></div>
          <h1>Pago pendiente</h1>
          <p>{resultado.mensaje}</p>

          {resultado.pago?.codigo_punto_pago && (
            <div className="checkout-pendiente-codigo">
              <span className="checkout-pendiente-label">Código de pago</span>
              <strong>{resultado.pago?.codigo_punto_pago}</strong>
              <span className="checkout-pendiente-hint">
                Preséntalo en <strong>{resultado.pago?.punto_pago || 'el punto seleccionado'}</strong> y paga {formatoPeso(resultado.pedido?.total || 0)}.
              </span>
            </div>
          )}

          <div className="checkout-success-datos">
            <div><span>Pedido:</span><strong>#{resultado.pedido?.id_pedido}</strong></div>
            <div><span>Referencia:</span><strong>{resultado.pago?.referencia_pago || resultado.pago?.numero_transaccion}</strong></div>
            {resultado.pago?.punto_pago && (
              <div><span>Punto de pago:</span><strong>{resultado.pago?.punto_pago}</strong></div>
            )}
            <div><span>Valor a pagar:</span><strong>{formatoPeso(resultado.pedido?.total || 0)}</strong></div>
            {resultado.pago?.fecha_limite && (
              <div><span>Fecha límite:</span><strong>
                {new Date(resultado.pago.fecha_limite).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </strong></div>
            )}
            <div><span>Estado:</span><strong>Pendiente</strong></div>
          </div>

          <div className="checkout-success-acciones">
            <button type="button" className="checkout-pdf-btn" onClick={confirmarPago} disabled={procesando}>
              {procesando ? <FaSpinner className="spin" /> : <FaCircleCheck />} Confirmar pago
            </button>
            <button type="button" className="checkout-volver-btn" onClick={reiniciar}>
              Volver al checkout
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Pantalla de pago rechazado
  if (resultado?.tipo === 'rechazado') {
    return (
      <div className="checkout-page app-glass">
        <main className="checkout-main checkout-rechazado">
          <div className="checkout-rechazado-icon"><FaExclamation /></div>
          <h1>Pago rechazado</h1>
          <p>{resultado.mensaje}</p>
          <p className="checkout-rechazado-detalle">
            Tu carrito se mantuvo intacto: los productos siguen disponibles en el checkout.
          </p>
          <div className="checkout-success-acciones">
            <button type="button" className="checkout-pdf-btn" onClick={reiniciar}>
              <FaArrowLeft /> Intentar de nuevo
            </button>
            <button type="button" className="checkout-volver-btn" onClick={() => navigate('/carrito')}>
              Ver mi carrito
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (authLoading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!isAuthenticated || rol !== 'cliente') {
    return (
      <div className="checkout-page app-glass">
        <main className="checkout-main checkout-login">
          <h1>Inicia sesión para continuar</h1>
          <p>Para finalizar tu compra necesitas una cuenta de cliente Neodomus.</p>
          <div className="checkout-success-acciones">
            <Link
              to="/login"
              className="checkout-pdf-btn"
              onClick={() => sessionStorage.setItem(PF_REDIRECT_AFTER_LOGIN_KEY, '/checkout')}
            >
              Iniciar sesión
            </Link>
            <Link to="/register" className="checkout-volver-btn">Crear cuenta</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="checkout-page app-glass">
      {error && <div className="checkout-error"><FaExclamation /> {error}</div>}
      <main className="checkout-main">
        <header className="checkout-header">
          <div>
            <h1>Finalizar compra</h1>
            <p>Confirma los productos y elige cómo quieres pagar.</p>
          </div>
          <button type="button" className="checkout-back-btn" onClick={() => navigate('/carrito')}>
            <FaArrowLeft /> Volver al carrito
          </button>
        </header>

        <div className="checkout-layout">
          <div className="checkout-col-izq">
            {/* Servicios opcionales */}
            <section className="checkout-seccion">
              <div className="checkout-seccion-titulo">
                <h2>Servicios técnicos opcionales</h2>
                <button type="button" className="checkout-add-servicio" onClick={agregarServicio}>
                  <FaPlus /> Agregar servicio
                </button>
              </div>
              {servicios.length === 0 ? (
                <p className="checkout-servicios-vacio">
                  Agrega un servicio de instalación, mantenimiento o soporte junto a tu compra.
                </p>
              ) : (
                <div className="checkout-servicios-lista">
                  {servicios.map((s) => (
                    <div className="checkout-servicio" key={s.id}>
                      <div className="checkout-servicio-fila">
                        <select
                          value={s.tipo}
                          onChange={(e) => cambiarTipoServicio(s.id, e.target.value)}
                        >
                          {TIPOS_SERVICIO.map((t) => (
                            <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                          ))}
                        </select>
                        <span className="checkout-servicio-precio">{formatoPeso(s.precio)}</span>
                        <button type="button" onClick={() => quitarServicio(s.id)} aria-label="Quitar servicio">
                          <FaTrashCan />
                        </button>
                      </div>
                      <div className="checkout-servicio-detalles">
                          {s.tipo === 'Instalación' && (
                            <span className="checkout-tecnicos-aviso">
                              <FaUsers /> Según los productos de tu compra, esta instalación requerirá{' '}
                              {maxTecnicos === 1 ? '1 técnico' : `${maxTecnicos} técnicos`}.
                            </span>
                          )}
                          <input
                            type="date"
                            value={s.fecha || ''}
                            min={hoyISO}
                            onChange={(e) => actualizarServicio(s.id, 'fecha', e.target.value)}
                          />
                          <input
                            type="time"
                            value={s.hora || '08:00'}
                            min={s.fecha === hoyISO ? horaActual : undefined}
                            step={3600}
                            onChange={(e) => actualizarServicio(s.id, 'hora', e.target.value)}
                          />
                          <select
                            className="checkout-tecnico-modo"
                            value={s.modo_tecnico || 'auto'}
                            onChange={(e) => actualizarServicio(s.id, 'modo_tecnico', e.target.value)}
                          >
                            <option value="auto">Técnico 1: asignación automática</option>
                            <option value="lista">Técnico 1: elegir de la lista</option>
                          </select>
                          {s.modo_tecnico === 'lista' && (
                            <select
                              className="checkout-tecnico-select"
                              value={s.id_tecnico ?? ''}
                              onChange={(e) => actualizarServicio(s.id, 'id_tecnico', e.target.value)}
                            >
                              <option value="">Selecciona un técnico</option>
                              {(tecnicosMap[s.id] || []).map((t) => (
                                <option
                                  key={t.id_tecnico}
                                  value={t.id_tecnico}
                                  disabled={t.disponible === false || Number(s.id_tecnico_2) === t.id_tecnico}
                                >
                                  {t.first_name || ''} {t.last_name || ''}
                                  {t.calificacion ? ` (★ ${Number(t.calificacion).toFixed(1)})` : ''}
                                  {t.disponible === false ? ' — ocupado ese día' : ''}
                                </option>
                              ))}
                            </select>
                          )}
                          {s.tipo === 'Instalación' && maxTecnicos >= 2 && (
                            <>
                              <select
                                className="checkout-tecnico-modo"
                                value={s.modo_tecnico_2 || 'auto'}
                                onChange={(e) => actualizarServicio(s.id, 'modo_tecnico_2', e.target.value)}
                              >
                                <option value="auto">Técnico 2: asignación automática</option>
                                <option value="lista">Técnico 2: elegir de la lista</option>
                              </select>
                              {s.modo_tecnico_2 === 'lista' && (
                                <select
                                  className="checkout-tecnico-select"
                                  value={s.id_tecnico_2 ?? ''}
                                  onChange={(e) => actualizarServicio(s.id, 'id_tecnico_2', e.target.value)}
                                >
                                  <option value="">Selecciona un técnico</option>
                                  {(tecnicosMap[s.id] || []).map((t) => (
                                    <option
                                      key={t.id_tecnico}
                                      value={t.id_tecnico}
                                      disabled={t.disponible === false || Number(s.id_tecnico) === t.id_tecnico}
                                    >
                                      {t.first_name || ''} {t.last_name || ''}
                                      {t.calificacion ? ` (★ ${Number(t.calificacion).toFixed(1)})` : ''}
                                      {t.disponible === false ? ' — ocupado ese día' : ''}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </>
                          )}
                          {direccionCliente ? (
                            <span className="checkout-servicio-direccion">
                              <FaLocationDot /> {direccionCliente}
                            </span>
                          ) : (
                            <span className="checkout-servicio-direccion checkout-servicio-direccion-warn">
                              <FaLocationDot /> Agrega tu dirección en tu perfil para indicar dónde se realizará el servicio o la entrega.
                            </span>
                          )}
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Método de pago */}
            <section className="checkout-seccion">
              <h2>Método de pago</h2>
              <div className="checkout-modo-banner">
                <FaFlask />
                Modo de prueba / Simulación: no se realizan cobros reales ni se requiere registro de empresa.
              </div>
              <div className="checkout-metodos">
                {(metodosDisponibles ? METODOS.filter((m) => metodosDisponibles.includes(m.codigo)) : METODOS).map((m) => {
                  const Icono = m.icono;
                  return (
                    <button
                      key={m.codigo}
                      type="button"
                      className={`checkout-metodo ${metodo === m.codigo ? 'activo' : ''}`}
                      onClick={() => setMetodo(m.codigo)}
                    >
                      <Icono /> {m.nombre}
                    </button>
                  );
                })}
              </div>

              <div className="checkout-pago-form">
                {(metodo === 'tarjeta_debito' || metodo === 'tarjeta_credito') && (
                  <>
                    <div className="checkout-field">
                      <label>Número de tarjeta</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="4242 4242 4242 4242"
                        value={pago.numero}
                        onChange={(e) => setPago({ ...pago, numero: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                    <div className="checkout-field">
                      <label>Titular de la tarjeta</label>
                      <input
                        type="text"
                        placeholder="Como aparece en la tarjeta"
                        value={pago.titular}
                        onChange={(e) => setPago({ ...pago, titular: e.target.value })}
                      />
                    </div>
                    <div className="checkout-field-row">
                      <div className="checkout-field">
                        <label>Expiración</label>
                        <input
                          type="text"
                          placeholder="MM/AA"
                          value={pago.expiracion}
                          onChange={(e) => setPago({ ...pago, expiracion: e.target.value.replace(/[^\d/]/g, '') })}
                        />
                      </div>
                      <div className="checkout-field">
                        <label>CVV</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="123"
                          value={pago.cvv}
                          onChange={(e) => setPago({ ...pago, cvv: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                    </div>
                    <p className="checkout-nota">
                      Prueba: 4242 4242 4242 4242 (aprobada) · 4242 4242 4242 0001 (rechazada)
                    </p>
                    <label>Cuotas</label>
                    <select
                      value={pago.cuotas}
                      onChange={(e) => setPago({ ...pago, cuotas: Number(e.target.value) })}
                    >
                      <option value={1}>1 cuota</option>
                      <option value={3}>3 cuotas</option>
                      <option value={6}>6 cuotas</option>
                      <option value={12}>12 cuotas</option>
                    </select>
                  </>
                )}

                {(metodo === 'tarjeta_debito' || metodo === 'tarjeta_credito' || metodo === 'pse' || metodo === 'paypal') && (
                  <div className="checkout-field">
                    <label>Resultado de simulación (entorno de prueba)</label>
                    <select
                      value={pago.resultado_simulacion}
                      onChange={(e) => setPago({ ...pago, resultado_simulacion: e.target.value })}
                    >
                      <option value="">Selecciona el resultado...</option>
                      <option value="aprobado">Aprobado</option>
                      <option value="rechazado">Rechazado</option>
                      {metodo === 'pse' && <option value="pendiente">Pendiente</option>}
                    </select>
                  </div>
                )}

                {metodo === 'pse' && (
                  <>
                    <div className="checkout-field">
                      <label>Banco</label>
                      <select value={pago.banco} onChange={(e) => setPago({ ...pago, banco: e.target.value })}>
                        <option value="">Selecciona tu banco</option>
                        {(bancos.length ? bancos : ['Bancolombia', 'Banco de Bogotá', 'Banco Davivienda']).map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="checkout-field">
                      <label>Titular de la cuenta</label>
                      <input
                        type="text"
                        placeholder="Nombre del titular"
                        value={pago.titular}
                        onChange={(e) => setPago({ ...pago, titular: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {metodo === 'paypal' && (
                  <div className="checkout-field">
                    <label>Correo de PayPal</label>
                    <input
                      type="email"
                      placeholder="tucorreo@ejemplo.com"
                      value={pago.correo_paypal}
                      onChange={(e) => setPago({ ...pago, correo_paypal: e.target.value })}
                    />
                    <p className="checkout-nota">
                      Pago simulado / entorno de prueba: no se conecta ninguna cuenta real de PayPal.
                    </p>
                  </div>
                )}

                {metodo === 'punto_pago' && (
                  <>
                    <div className="checkout-field">
                      <label>Punto de pago</label>
                      <select
                        value={pago.punto_pago}
                        onChange={(e) => setPago({ ...pago, punto_pago: e.target.value })}
                      >
                        <option value="">Selecciona el punto...</option>
                        <option value="Efecty">Efecty</option>
                        <option value="Servientrega">Servientrega</option>
                        <option value="Otro punto de pago">Otro punto de pago</option>
                      </select>
                    </div>
                    <p className="checkout-nota">
                      Al confirmar se generará una referencia y un código de pago en efectivo para
                      el punto seleccionado. El pedido queda pendiente hasta confirmar el pago.
                    </p>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Resumen */}
          <aside className="checkout-resumen">
            <h2>Resumen del pedido</h2>
            <div className="checkout-resumen-items">
              {items.map((item) => {
                const importe = item.precio_venta_producto * (item.venta_por_metros ? item.metros || 0 : item.cantidad);
                const tecnicosReq = Number(item.tecnicos_requeridos) || 1;
                return (
                  <div className="checkout-resumen-item" key={item.id_producto}>
                    <span className="checkout-resumen-nombre">
                      {item.nombre_producto}
                      {item.venta_por_metros
                        ? ` · ${item.metros} m`
                        : item.cantidad > 1
                          ? ` × ${item.cantidad}`
                          : ''}
                      {` (${tecnicosReq} técnico${tecnicosReq > 1 ? 's' : ''})`}
                    </span>
                    <span className="checkout-resumen-precio">{formatoPeso(importe)}</span>
                  </div>
                );
              })}
              {servicios.map((s) => (
                <div className="checkout-resumen-item" key={s.id}>
                  <span className="checkout-resumen-nombre">{s.nombre} (servicio)</span>
                  <span className="checkout-resumen-precio">{formatoPeso(s.precio)}</span>
                </div>
              ))}
            </div>

            <div className="checkout-resumen-row">
              <span>Subtotal</span>
              <span>{formatoPeso(total)}</span>
            </div>
            <div className="checkout-resumen-row">
              <span>Envío</span>
              <span>Calculado al confirmar</span>
            </div>
            <div className="checkout-resumen-total">
              <span>Total a pagar</span>
              <span>{formatoPeso(total)}</span>
            </div>

            <button
              type="button"
              className="checkout-pagar-btn"
              onClick={handlePagar}
              disabled={procesando || items.length === 0}
            >
              {procesando ? <FaSpinner className="spin" /> : <FaCreditCard />}
              {procesando ? 'Procesando pago...' : 'Pagar y confirmar'}
            </button>
            <p className="checkout-resumen-hint">
                Simulación académica: no se realizan cobros reales.
              </p>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default CheckoutPage;

