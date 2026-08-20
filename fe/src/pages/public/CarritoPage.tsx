import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaArrowLeft, FaTrashCan, FaCartShopping, FaCircleCheck, FaExclamation, FaPen } from 'react-icons/fa6';
import { useCart, type CartItem } from '@contexts/CartContext';
import { useAuth } from '@contexts/AuthContext';
import { useIdioma } from '@i18n/IdiomaContext';
import { PF_REDIRECT_AFTER_LOGIN_KEY } from '@utils/profileStorage';
import '@styles/carrito.css';

const CarritoPage = () => {
  const navigate = useNavigate();
  const { t } = useIdioma();
  const { items, totalItems, totalPrice, updateQuantity, updateMetros, removeItem, clearCart } = useCart();
  const { isAuthenticated, rol } = useAuth();
  const [toast, setToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null);

  const totalTecnicos = Math.max(1, ...items.map((item) => item.tecnicos_requeridos || 1));

  const showToast = (msg: string, tipo: 'success' | 'error' = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditar = (item: CartItem, key: string) => {
    const params = new URLSearchParams();
    params.set('editar', key);
    if (item.color) params.set('color', item.color);
    if (item.metros != null) params.set('metros', String(item.metros));
    if (!item.venta_por_metros) params.set('cantidad', String(item.cantidad));
    navigate(`/producto/${item.id_producto}?${params.toString()}`);
  };

  const handleFinalizar = () => {
    if (items.length === 0) {
      showToast(t('carrito.toastVacio'), 'error');
      return;
    }
    if (isAuthenticated && rol === 'cliente') {
      navigate('/checkout');
      return;
    }
    sessionStorage.setItem(PF_REDIRECT_AFTER_LOGIN_KEY, '/checkout');
    navigate('/login');
  };

  return (
    <div className="carrito-page app-glass">
      {toast && (
        <div className={`carrito-toast ${toast.tipo}`}>
          {toast.tipo === 'success' ? <FaCircleCheck /> : <FaExclamation />}
          <span>{toast.msg}</span>
        </div>
      )}

      <main className="carrito-main">
        <header className="carrito-header">
          <div>
            <h1>{t('carrito.miCarrito')}</h1>
            <p>
              {totalItems > 0
                ? (totalItems === 1 ? t('carrito.unProducto', { n: totalItems }) : t('carrito.variosProductos', { n: totalItems }))
                : t('carrito.aunVacio')}
            </p>
          </div>
          <button type="button" className="carrito-back-btn" onClick={() => navigate('/productos')}>
            <FaArrowLeft /> {t('carrito.volverProductos')}
          </button>
        </header>

        {items.length === 0 ? (
          <div className="carrito-vacio">
            <FaCartShopping className="carrito-vacio-icon" />
            <h2>{t('carrito.vacio')}</h2>
            <p>{t('carrito.vacioExterior')}</p>
            <button type="button" className="carrito-vacio-btn" onClick={() => navigate('/productos')}>
              {t('carrito.explorar')}
            </button>
          </div>
        ) : (
          <div className="carrito-layout">
            <div className="carrito-items">
              {items.map(item => {
                const key = item.color ? `${item.id_producto}-${item.color.toLowerCase()}` : `${item.id_producto}`;
                return (
                  <article key={key} className="carrito-item">
                    <Link to={`/producto/${item.id_producto}`} className="carrito-item-img">
                      <img
                        src={item.imagen}
                        alt={item.nombre_producto}
                        onError={(e) => (e.currentTarget.src = '/productos/default.png')}
                      />
                    </Link>

                    <div className="carrito-item-info">
                      <Link to={`/producto/${item.id_producto}`} className="carrito-item-nombre">
                        {item.nombre_producto}
                      </Link>
                      {item.color && <span className="carrito-item-color">{t('carrito.color', { color: item.color })}</span>}
                      <span className="carrito-item-precio-unit">
                        ${item.precio_venta_producto.toLocaleString()} COP{item.venta_por_metros ? ' / metro' : ` ${t('carrito.unidad')}`}
                      </span>
                      {item.venta_por_metros && item.metros != null && (
                        <span className="carrito-item-metros">{item.metros} m</span>
                      )}
                      {item.tecnicos_requeridos != null && (
                        <span className="carrito-item-tecnicos">
                          {`Requiere ${item.tecnicos_requeridos > 1 ? item.tecnicos_requeridos + ' técnicos' : '1 técnico'}`}
                        </span>
                      )}
                    </div>

                    <div className="carrito-item-controls">
                    <div className="carrito-cantidad">
                      {item.venta_por_metros ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateMetros(key, Math.max(0.5, Number(((item.metros || 1) - 1).toFixed(1))))}
                            aria-label="Reducir metros"
                          >
                            −
                          </button>
                          <span>{item.metros} m</span>
                          <button
                            type="button"
                            onClick={() => updateMetros(key, Number(((item.metros || 1) + 1).toFixed(1)))}
                            aria-label="Aumentar metros"
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => updateQuantity(key, item.cantidad - 1)}
                            aria-label="Reducir cantidad"
                          >
                            −
                          </button>
                          <span>{item.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(key, item.cantidad + 1)}
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </>
                      )}
                    </div>

                      <span className="carrito-item-subtotal">
                        ${(item.precio_venta_producto * (item.venta_por_metros ? item.metros || 0 : item.cantidad)).toLocaleString()} COP
                      </span>

                      <button
                        type="button"
                        className="carrito-item-edit"
                        onClick={() => handleEditar(item, key)}
                        aria-label={t('common.editar')}
                        title={t('common.editar')}
                      >
                        <FaPen />
                      </button>

                      <button
                        type="button"
                        className="carrito-item-remove"
                        onClick={() => removeItem(key)}
                        aria-label={t('carrito.eliminarProducto')}
                        title={t('carrito.eliminar')}
                      >
                        <FaTrashCan />
                      </button>
                    </div>
                  </article>
                );
              })}

              <button type="button" className="carrito-clear" onClick={clearCart}>
                <FaTrashCan />
                {t('carrito.vaciar')}
              </button>
            </div>

            <aside className="carrito-resumen">
              <h2>{t('carrito.resumen')}</h2>
              <div className="carrito-resumen-row">
                <span>{t('carrito.productos')} ({totalItems})</span>
                <span>${totalPrice.toLocaleString()} COP</span>
              </div>
              <div className="carrito-resumen-row">
                <span>{t('carrito.envio')}</span>
                <span>{t('carrito.seCalculaFinalizar')}</span>
              </div>
              {totalTecnicos > 0 && (
                <div className="carrito-resumen-row">
                  <span>{t('carrito.tecnicosNecesarios')}</span>
                  <span>{totalTecnicos === 1 ? '1 técnico' : `${totalTecnicos} técnicos`}</span>
                </div>
              )}
              <div className="carrito-resumen-total">
                <span>{t('carrito.total')}</span>
                <span>${totalPrice.toLocaleString()} COP</span>
              </div>
              <button type="button" className="carrito-finalizar-btn" onClick={handleFinalizar}>
                {t('carrito.finalizarCompra')}
              </button>
              <p className="carrito-resumen-hint">{t('carrito.hintPago')}</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

export default CarritoPage;
