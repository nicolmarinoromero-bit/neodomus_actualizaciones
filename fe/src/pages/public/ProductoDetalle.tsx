import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaHeart, FaCheck, FaTruckFast, FaShieldHalved, FaRotateLeft, FaUsers } from 'react-icons/fa6';
import api from '@services/api';
import { useCart } from '@contexts/CartContext';
import { useFavoritos } from '@utils/favoritos';
import { useIdioma } from '@i18n/IdiomaContext';
import '@styles/producto-detalle.css';

interface Producto {
  id_producto: number;
  nombre_producto: string;
  marca?: string | null;
  venta_por_metros?: boolean;
  precio_venta_producto: number;
  imagen_url?: string | null;
  id_cate_pr?: number;
  nombre_categoria?: string;
  stock_producto?: number;
  stock_estado?: 'disponible' | 'bajo' | 'agotado';
  descuento_activo?: number | null;
  precio_final?: number | null;
  promocion_hasta?: string | null;
  es_nuevo?: boolean;
  tecnicos_requeridos?: number;
  descripcion_producto?: string | null;
  caracteristicas_producto?: string | null;
  variantes?: {
    id: number;
    nombre: string;
    hex?: string | null;
    imagen_url?: string | null;
    stock: number;
  }[];
}

const METROS_OPCIONES = [10, 20, 30, 40, 50];

const PALETAS: Record<number, string[]> = {
  1: ['Blanco', 'Negro', 'Gris'],
  2: ['Blanco', 'Negro', 'Plata'],
  3: ['Blanco cálido', 'Blanco frío', 'RGB'],
  4: ['Negro', 'Blanco'],
  5: ['Azul', 'Amarillo', 'Negro'],
  6: ['Blanco', 'Negro'],
  7: ['Negro'],
  8: ['Blanco', 'Negro'],
  9: ['Blanco', 'Gris', 'Negro'],
  10: ['Blanco', 'Gris'],
};

const COLOR_HEX: Record<string, string> = {
  'Blanco': '#f5f5f5',
  'Blanco cálido': '#ffe9c7',
  'Blanco frío': '#e8f4ff',
  'Negro': '#1e1e1e',
  'Gris': '#9e9e9e',
  'Plata': '#c0c0c0',
  'Azul': '#2f6fed',
  'Amarillo': '#f6c344',
  'RGB': 'linear-gradient(135deg, #ff4d4d, #ffd700, #2f6fed, #7c4dff)',
};

const CARACTERISTICAS: Record<number, string[]> = {
  1: [
    'Detección precisa de movimiento',
    'Alcance de hasta 8 metros',
    'Ángulo de detección de 90° a 110°',
    'Alimentación de bajo consumo',
    'Fácil instalación sin obras',
  ],
  2: [
    'Control central de todos tus dispositivos',
    'Compatibilidad con protocolos Wi-Fi y Zigbee',
    'App móvil para gestión remota',
    'Escenas y rutinas programables',
    'Actualizaciones de firmware automáticas',
  ],
  3: [
    'Iluminación regulable y personalizable',
    'Colores RGB y tonos de blanco',
    'Control por app y asistentes de voz',
    'Bajo consumo energético',
    'Larga vida útil de los LEDs',
  ],
  4: [
    'Automatización completa del hogar',
    'Programación de escenas por horarios',
    'Integración con sensores y cámaras',
    'Control por voz (Alexa, Google Home)',
    'Instalación guiada paso a paso',
  ],
  5: [
    'Conectividad de alto rendimiento',
    'Transmisión de datos estable y rápida',
    'Material de alta durabilidad',
    'Compatibilidad con routers estándar',
    'Presentaciones y longitudes variadas',
  ],
  6: [
    'Control de encendido y apagado remoto',
    'Monitoreo de consumo eléctrico',
    'Programación de horarios',
    'Protección contra sobrecargas',
    'Compatibilidad con asistentes de voz',
  ],
  7: [
    'Salida de voltaje estable',
    'Protección contra sobrevoltaje',
    'Alta eficiencia energética',
    'Conexión segura de terminales',
    'Uso continuo y confiable',
  ],
  8: [
    'Vigilancia y monitoreo 24/7',
    'Notificaciones en tiempo real',
    'Visión nocturna',
    'Grabación de alta definición',
    'Fácil configuración desde la app',
  ],
  9: [
    'Control de temperatura inteligente',
    'Programación por horarios y zonas',
    'Ahorro energético automático',
    'Control remoto desde la app',
    'Compatibilidad con asistentes de voz',
  ],
  10: [
    'Panel de control táctil intuitivo',
    'Gestión central de todo el hogar',
    'Pantalla de alta resolución',
    'Escenas personalizadas',
    'Interfaz en español',
  ],
};

const ProductoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addItem, removeItem } = useCart();
  const { t } = useIdioma();
  const { esFavorito, toggleFavorito } = useFavoritos();

  const editarKey = searchParams.get('editar');

  const [producto, setProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [color, setColor] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [metros, setMetros] = useState(10);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const variantes = producto?.variantes || [];
  const varianteActiva = variantes.find(v => v.nombre === color) || null;
  const stockDisponible =
    variantes.length > 0
      ? (varianteActiva?.stock ?? 0)
      : (producto?.stock_producto ?? 0);
  const precioFinal = producto?.precio_final ?? producto?.precio_venta_producto ?? 0;
  const tieneDescuento = producto?.precio_final != null && Boolean(producto?.descuento_activo && producto.descuento_activo > 0);
  const imagen =
    varianteActiva?.imagen_url || producto?.imagen_url || `/productos/${producto?.id_producto}.jpg`;

  useEffect(() => {
    const fetchProducto = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/productos/${id}`);
        setProducto(res.data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.detail || 'Producto no encontrado');
      } finally {
        setLoading(false);
      }
    };
    fetchProducto();
  }, [id]);

  useEffect(() => {
    const refetch = () => {
      api.get(`/productos/${id}`).then((res) => setProducto(res.data)).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id]);

  useEffect(() => {
    if (producto) {
      const paleta = (producto.variantes?.length ? producto.variantes.map(v => v.nombre) : PALETAS[producto.id_cate_pr ?? 0]) || ['Blanco', 'Negro', 'Gris'];
      const paramColor = searchParams.get('color');
      const colorInicial = paramColor && paleta.includes(paramColor) ? paramColor : paleta[0];
      setColor(colorInicial);
      const paramMetros = searchParams.get('metros');
      if (producto.venta_por_metros && paramMetros) {
        setMetros(METROS_OPCIONES.includes(Number(paramMetros)) ? Number(paramMetros) : 10);
      }
      const paramCantidad = searchParams.get('cantidad');
      if (!producto.venta_por_metros && paramCantidad) {
        setCantidad(Math.max(1, Number(paramCantidad) || 1));
      }
    }
  }, [producto, searchParams]);

  if (loading) return <div className="detalle-loading">Cargando producto...</div>;
  if (error || !producto)
    return (
      <div className="detalle-error">
        <p>{error || 'Producto no encontrado'}</p>
        <button type="button" className="detalle-back-btn" onClick={() => navigate('/productos')}>
          <FaArrowLeft /> Volver a productos
        </button>
      </div>
    );

  const paleta = variantes.length
    ? variantes.map(v => v.nombre)
    : PALETAS[producto.id_cate_pr ?? 0] || ['Blanco', 'Negro', 'Gris'];
  const caracteristicas = (producto.caracteristicas_producto || '')
    .split('\n')
    .map((c) => c.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);
  const caracteristicasFinal = caracteristicas.length
    ? caracteristicas
    : CARACTERISTICAS[producto.id_cate_pr ?? 0] || CARACTERISTICAS[1];
  const categoria = producto.nombre_categoria || 'Producto';

  const descripcion = producto.descripcion_producto || `El ${producto.nombre_producto} pertenece a la categoría de ${categoria}. Diseñado para integrarse a la perfección en tu hogar inteligente, combina tecnología confiable con una instalación sencilla, garantizando el mejor rendimiento y la máxima comodidad para tu espacio.`;

  const esFav = producto ? esFavorito(producto.id_producto) : false;

  const handleToggleFavorito = () => {
    if (!producto) return;
    toggleFavorito(producto.id_producto);
    showToast(esFav ? 'Producto eliminado de favoritos' : 'Producto agregado a favoritos');
  };

  const handleAgregarAlCarrito = () => {
    if (stockDisponible <= 0) {
      showToast('No hay stock disponible para este color');
      return;
    }
    if (producto.venta_por_metros) {
      if (!metros || metros <= 0) {
        showToast('Ingresa una cantidad de metros válida');
        return;
      }
      if (editarKey) removeItem(editarKey);
      addItem(
        {
          id_producto: producto.id_producto,
          nombre_producto: producto.nombre_producto,
          precio_venta_producto: precioFinal,
          imagen,
          venta_por_metros: true,
          tecnicos_requeridos: producto.tecnicos_requeridos || 1,
        },
        1,
        metros
      );
      if (editarKey) {
        navigate('/carrito');
      } else {
        showToast(`${metros} m x ${producto.nombre_producto} ${t('productos.agregadoAlCarrito')}`);
      }
      return;
    }
    if (editarKey) removeItem(editarKey);
    addItem(
      {
        id_producto: producto.id_producto,
        nombre_producto: producto.nombre_producto,
        precio_venta_producto: precioFinal,
        imagen,
        color,
        tecnicos_requeridos: producto.tecnicos_requeridos || 1,
      },
      cantidad
    );
    if (editarKey) {
      navigate('/carrito');
    } else {
      showToast(`${cantidad} x ${producto.nombre_producto} ${t('productos.agregadoAlCarrito')}`);
    }
  };

  return (
    <div className="detalle-page app-glass">
      {toast && <div className="detalle-toast">{toast}</div>}
      <main className="detalle-main">
        <button type="button" className="detalle-back-btn" onClick={() => navigate(editarKey ? '/carrito' : '/productos')}>
          <FaArrowLeft /> {editarKey ? 'Volver al carrito' : t('carrito.volverProductos')}
        </button>

        <nav className="detalle-breadcrumb" aria-label={t('detalle.ruta')}>
          <Link to="/productos">{t('nav.productos')}</Link>
          <span className="detalle-breadcrumb-sep">/</span>
          <span className="detalle-breadcrumb-cat">{categoria}</span>
          <span className="detalle-breadcrumb-sep">/</span>
          <span>{producto.nombre_producto}</span>
        </nav>

        <div className="detalle-layout">
          <div className="detalle-imagen-card">
            <div className="detalle-corner-badges">
              {tieneDescuento && (
                <span className="detalle-promo-corner">Promoción -{producto.descuento_activo}%</span>
              )}
            </div>
            <button
              type="button"
              className={`detalle-fav-btn ${esFav ? 'activo' : ''}`}
              onClick={handleToggleFavorito}
              aria-label={esFav ? t('productos.quitarFavoritos') : t('productos.agregarFavoritos')}
              title={esFav ? t('productos.quitarFavoritos') : t('productos.agregarFavoritos')}
            >
              <FaHeart />
            </button>
            <img
              src={imagen}
              alt={producto.nombre_producto}
              onError={(e) => (e.currentTarget.src = '/productos/default.png')}
            />
          </div>

          <div className="detalle-info">
            <span className="detalle-categoria">{categoria}</span>
            <h1 className="detalle-nombre">{producto.nombre_producto}</h1>
            {producto.marca && <span className="detalle-marca">Marca: {producto.marca}</span>}

            <div className="detalle-precio">
              {tieneDescuento && (
                <span className="detalle-precio-original">
                  ${(
                    producto.precio_venta_producto *
                    (producto.venta_por_metros ? metros : 1)
                  ).toLocaleString()}
                </span>
              )}
              <span className="detalle-precio-monto">
                ${(
                  precioFinal *
                  (producto.venta_por_metros ? metros : 1)
                ).toLocaleString()}
              </span>
              <span className="detalle-precio-sufijo">COP{producto.venta_por_metros ? ` / metro (${metros} m)` : ''}</span>
              {tieneDescuento && (
                <span className="detalle-badge-descuento">-{producto.descuento_activo}%</span>
              )}
            </div>

            <div className={`detalle-disponibilidad ${stockDisponible <= 0 ? 'agotado' : ''}`}>
              {stockDisponible > 0 ? <FaCheck /> : <FaRotateLeft />}
              {stockDisponible > 0
                ? `Disponible · ${stockDisponible} u.${variantes.length ? ' en este color' : ''}`
                : 'Sin stock de este producto'}
            </div>

            <p className="detalle-descripcion">{descripcion}</p>

            <div className="detalle-caracteristicas">
              <h3>Características principales</h3>
              <ul>
                {caracteristicasFinal.map(f => (
                  <li key={f}>
                    <FaCheck /> {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="detalle-compra">
              <div className="detalle-colores">
                <span className="detalle-label">Color: <strong>{color}</strong></span>
                <div className="detalle-colores-swatches">
                  {paleta.map(c => {
                    const variante = variantes.length ? variantes.find(v => v.nombre === c) : null;
                    const fondo = (variante?.hex || COLOR_HEX[c] || '#ccc').trim();
                    const esDegradado = fondo.startsWith('linear');
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`detalle-swatch ${color === c ? 'activo' : ''}`}
                        onClick={() => setColor(c)}
                        aria-label={`Color ${c}`}
                        title={c}
                      >
                        <span
                          className="detalle-swatch-circle"
                          style={
                            esDegradado
                              ? { background: fondo }
                              : { background: fondo || '#ccc' }
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="detalle-cantidad-row">
                {producto.venta_por_metros ? (
                  <div className="detalle-metros">
                    <span className="detalle-metros-titulo">Elige cuántos metros quieres:</span>
                    <div className="detalle-metros-opciones">
                      {METROS_OPCIONES.map(m => (
                        <button
                          key={m}
                          type="button"
                          className={`detalle-metro-chip ${metros === m ? 'activo' : ''}`}
                          onClick={() => setMetros(m)}
                          aria-label={`${m} metros`}
                        >
                          {m} m
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="detalle-cantidad">
                    <button
                      type="button"
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                      aria-label="Reducir cantidad"
                    >
                      −
                    </button>
                    <span>{cantidad}</span>
                    <button
                      type="button"
                      onClick={() => setCantidad(cantidad + 1)}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                )}

                <button type="button" className="detalle-agregar-btn" onClick={handleAgregarAlCarrito}>
                  Agregar al carrito
                </button>

                <button
                  type="button"
                  className={`detalle-favorito-btn ${esFav ? 'activo' : ''}`}
                  onClick={handleToggleFavorito}
                >
                  <FaHeart />
                </button>
              </div>

              <p className="detalle-subtotal">
                Subtotal:{' '}
                <strong>
                  $
                  {(
                    producto.precio_venta_producto *
                    (producto.venta_por_metros ? metros : cantidad)
                  ).toLocaleString()}{' '}
                  COP
                </strong>
              </p>
            </div>

            <div className="detalle-beneficios">
              <div className="detalle-beneficio">
                <FaTruckFast />
                <span>Envío seguro a todo el país</span>
              </div>
              <div className="detalle-beneficio">
                <FaShieldHalved />
                <span>Garantía oficial Neodomus</span>
              </div>
              <div className="detalle-beneficio">
                <FaUsers />
                <span>
                  {`Requiere ${producto.tecnicos_requeridos && producto.tecnicos_requeridos > 1 ? producto.tecnicos_requeridos + ' técnicos' : '1 técnico'} para su instalación`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductoDetalle;
