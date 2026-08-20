import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import api from '@services/api';
import { useCart } from '@contexts/CartContext';
import { useFavoritos } from '@utils/favoritos';
import { useIdioma } from '@i18n/IdiomaContext';
import '@styles/productos-publicos.css';

interface Producto {
  id_producto: number;
  nombre_producto: string;
  precio_venta_producto: number;
  imagen_url?: string | null;
  id_cate_pr?: number;
  nombre_categoria?: string;
  venta_por_metros?: boolean;
  descuento_activo?: number | null;
  precio_final?: number | null;
  promocion_hasta?: string | null;
  es_nuevo?: boolean;
  stock_producto?: number;
  stock_estado?: 'disponible' | 'bajo' | 'agotado';
  tecnicos_requeridos?: number;
}

interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
  descripcion: string;
}

const METROS_OPCIONES = [10, 20, 30, 40, 50];

const ProductosPublicos = () => {
  const { addItem } = useCart();
  const { t } = useIdioma();
  const { favoritos, toggleFavorito } = useFavoritos();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null);
  const [cartMessage, setCartMessage] = useState('');
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [metros, setMetros] = useState<Record<number, number>>({});

  // Cargar categorías
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await api.get('/productos/categorias');
        setCategorias(res.data);
      } catch (err) {
        console.error('Error cargando categorías:', err);
      }
    };
    fetchCategorias();
  }, []);

  // Cargar productos (todos). Se recarga al volver a la pestaña o cada 30 s
  // para reflejar cambios de stock/precio/visibilidad del administrador.
  const cargarProductos = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const res = await api.get('/productos/?limit=100');
      const productosArray = res.data.data || [];
      setProductos(productosArray);
    } catch (err: any) {
      console.error(err);
      if (!silencioso) setError(err.response?.data?.detail || 'Error al cargar productos');
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    const refetch = () => cargarProductos(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(refetch, 30000);
    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrar productos
  const productosFiltrados = productos.filter(producto => {
    const matchesSearch = producto.nombre_producto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaSeleccionada ? producto.id_cate_pr === categoriaSeleccionada : true;
    return matchesSearch && matchesCategoria;
  });

  // Paginación local
  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProductos = productosFiltrados.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoriaSeleccionada, itemsPerPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const toggleFavoritoProducto = (id: number) => {
    toggleFavorito(id);
  };

  const handleAddToCart = (id: number) => {
    const producto = productos.find(p => p.id_producto === id);
    if (!producto) return;
    const precio = producto.precio_final ?? producto.precio_venta_producto;
    if (producto.venta_por_metros) {
      const m = metros[id] || 10;
      addItem(
        {
          id_producto: producto.id_producto,
          nombre_producto: producto.nombre_producto,
          precio_venta_producto: precio,
          imagen: getImagen(producto),
          venta_por_metros: true,
        },
        1,
        m
      );
      setCartMessage(`${m} m x ${producto.nombre_producto}`);
    } else {
      addItem(
        {
          id_producto: producto.id_producto,
          nombre_producto: producto.nombre_producto,
          precio_venta_producto: precio,
          imagen: getImagen(producto),
        },
        cantidades[id] || 1
      );
      setCartMessage(t('productos.agregadoMsg', { nombre: producto.nombre_producto }));
    }
    setTimeout(() => setCartMessage(''), 3000);
  };

  const disminuirCantidad = (id: number) => {
    setCantidades(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) - 1),
    }));
  };

  const aumentarCantidad = (id: number) => {
    setCantidades(prev => ({
      ...prev,
      [id]: (prev[id] || 1) + 1,
    }));
  };

  const setMetrosProducto = (id: number, metros: number) => {
    setMetros(prev => ({
      ...prev,
      [id]: metros,
    }));
  };

  // Imagen basada en ID
  const getImagen = (producto: Producto) => {
    if (producto.imagen_url) return producto.imagen_url;
    return `/productos/${producto.id_producto}.jpg`;
  };

  const getPageNumbers = (): (number | string)[] => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) range.push(i);
    }
    range.forEach((i) => {
      if (l !== undefined) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    });
    return rangeWithDots;
  };

  if (loading) return <div className="loading">{t('common.cargando')}</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <>
      {cartMessage && <div className="cart-toast">{cartMessage}</div>}
      <main className="productos-page app-glass">
        <section className="productos">
          <div className="productos-header">
            <div>
              <h1>{t('nav.productos')}</h1>
              <p>{t('productos.subtitulo')}</p>
            </div>
          </div>

          <div className="barra-superior">
            <div className="buscador">
              <FaMagnifyingGlass className="icono-buscar" />
              <input type="text" placeholder={t('productos.buscarProducto')} value={searchTerm} onChange={handleSearchChange} />
            </div>
            <div className="controls-right">
              <select className="select-paginas" value={itemsPerPage} onChange={handleItemsPerPageChange}>
                <option value={8}>8 por página</option>
                <option value={16}>16 por página</option>
                <option value={24}>24 por página</option>
              </select>
              <select
                className="select-categoria"
                value={categoriaSeleccionada || ''}
                onChange={(e) => setCategoriaSeleccionada(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre_categoria}</option>
                ))}
              </select>
            </div>
          </div>

          {currentProductos.length === 0 ? (
            <div className="loading">{t('productos.sinResultados')}</div>
          ) : (
            <>
              <div className="productos-grid">
                {currentProductos.map(producto => {
                  const esFavorito = favoritos.has(producto.id_producto);
                  const esPorMetros = Boolean(producto.venta_por_metros);
                  const cantidadMetros = metros[producto.id_producto] || 10;
                  const tieneDescuento = producto.precio_final != null && producto.descuento_activo && producto.descuento_activo > 0;
                  const precioFinal = producto.precio_final ?? producto.precio_venta_producto;
                  return (
                    <div key={producto.id_producto} className="card-producto">
                      <div className="img-contenedor">
                        <div className="corner-badges">
                          {producto.es_nuevo && <span className="nuevo-corner">Nuevo</span>}
                          {tieneDescuento && <span className="promo-corner">Promoción</span>}
                        </div>
                        <button
                          type="button"
                          className={`btn-favorito ${esFavorito ? 'activo' : ''}`}
                          onClick={() => toggleFavoritoProducto(producto.id_producto)}
                          aria-label={esFavorito ? t('productos.quitarFavoritos') : t('productos.agregarFavoritos')}
                          title={esFavorito ? t('productos.quitarFavoritos') : t('productos.agregarFavoritos')}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </button>
                        <div className="img-producto-wrap">
                          <Link to={`/producto/${producto.id_producto}`} aria-label={`Ver detalle de ${producto.nombre_producto}`}>
                            <img
                              src={getImagen(producto)}
                              alt={producto.nombre_producto}
                              className="img-producto"
                              loading="lazy"
                              onError={(e) => (e.currentTarget.src = '/productos/default.png')}
                            />
                          </Link>
                        </div>
                      </div>
                      <div className="info-producto">
                        <Link to={`/producto/${producto.id_producto}`} className="nombre-producto-link">
                          <h3 className="nombre-producto">{producto.nombre_producto}</h3>
                        </Link>
                        {producto.nombre_categoria && (
                          <span className="categoria-producto">{producto.nombre_categoria}</span>
                        )}
                        <span className="categoria-producto">
                          {`Requiere ${producto.tecnicos_requeridos && producto.tecnicos_requeridos > 1 ? producto.tecnicos_requeridos + ' técnicos' : '1 técnico'}`}
                        </span>
                        <div className="precio-producto">
                          {tieneDescuento && (
                            <span className="precio-original">
                              ${(producto.precio_venta_producto * (esPorMetros ? cantidadMetros : 1)).toLocaleString()}
                            </span>
                          )}
                          <span className="precio-monto">
                            ${(precioFinal * (esPorMetros ? cantidadMetros : 1)).toLocaleString()}
                          </span>
                          <span className="precio-sufijo">COP</span>
                          {tieneDescuento && (
                            <span className="badge-descuento">-{producto.descuento_activo}%</span>
                          )}
                        </div>
                        {esPorMetros && (
                          <span className="precio-metro-hint">
                            {precioFinal.toLocaleString()} COP / metro
                          </span>
                        )}
                        <div className="acciones-producto">
                          <div className="cantidad-control">
                            {esPorMetros ? (
                              <select
                                className="metros-select"
                                value={cantidadMetros}
                                onChange={(e) => setMetrosProducto(producto.id_producto, Number(e.target.value))}
                                aria-label="Metros"
                              >
                                {METROS_OPCIONES.map(m => (
                                  <option key={m} value={m}>{m} m</option>
                                ))}
                              </select>
                            ) : (
                              <>
                                <button type="button" onClick={() => disminuirCantidad(producto.id_producto)} aria-label="Reducir cantidad">−</button>
                                <span>{cantidades[producto.id_producto] || 1}</span>
                                <button type="button" onClick={() => aumentarCantidad(producto.id_producto)} aria-label="Aumentar cantidad">+</button>
                              </>
                            )}
                          </div>
                          <button
                            className="btn-agregar"
                            onClick={() => handleAddToCart(producto.id_producto)}
                          >
                            <span>{t('productos.agregarCarrito')}</span>
                            <svg className="icono-carrito" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="9" cy="21" r="1" />
                              <circle cx="20" cy="21" r="1" />
                              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="paginacion">
                  <button className="page-nav" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Página anterior">‹</button>
                  {getPageNumbers().map((item, idx) => (
                    <button
                      key={idx}
                      className={`page-number ${item === currentPage ? 'active' : ''}`}
                      onClick={() => typeof item === 'number' && handlePageChange(item)}
                      disabled={item === '...'}
                    >
                      {item}
                    </button>
                  ))}
                  <button className="page-nav" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Página siguiente">›</button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
};

export default ProductosPublicos;