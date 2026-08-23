import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaBoxOpen,
  FaMagnifyingGlass,
  FaCircleCheck,
  FaTriangleExclamation,
  FaRegClock,
  FaCalendarCheck,
  FaXmark,
} from 'react-icons/fa6';
import api from '@services/api';
import { useIdioma } from '@i18n/IdiomaContext';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';

interface PedidoEntrega {
  id_pedido: number;
  cliente: string | null;
  direccion: string | null;
  telefono: number | null;
  fecha_entrega: string | null;
  hora_entrega: string | null;
  estado_entrega: string | null;
  id_tecnico_entrega: number | null;
  nombre_tecnico: string | null;
  productos: string[];
}

interface TecnicoSimple {
  id_tecnico: number;
  first_name: string;
  last_name: string;
  is_active?: boolean;
}

const ESTADO_CLASE: Record<string, string> = {
  Asignada: 'warn',
  'En camino': 'info',
  Entregado: 'ok',
  Cancelada: 'err',
};

const POR_PAGINA = 10;

const AdminPedidos = () => {
  const { t } = useIdioma();
  const [pedidos, setPedidos] = useState<PedidoEntrega[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoSimple[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [pagina, setPagina] = useState(1);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const [entregasRes, tecnicosRes] = await Promise.all([
        api.get<PedidoEntrega[]>('/pedidos/admin/entregas'),
        api.get<TecnicoSimple[]>('/tecnicos'),
      ]);
      setPedidos(entregasRes.data);
      setTecnicos(tecnicosRes.data);
    } catch {
      setToast({ msg: t('adm.pedidos.errorCargar'), tipo: 'err' });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pedidos.filter(
      (p) => {
        if (filtroFecha && p.fecha_entrega !== filtroFecha) return false;
        if (!q) return true;
        return (
          String(p.id_pedido).includes(q) ||
          (p.cliente || '').toLowerCase().includes(q) ||
          p.productos.some((prod) => prod.toLowerCase().includes(q)) ||
          (p.nombre_tecnico || '').toLowerCase().includes(q)
        );
      },
    );
  }, [pedidos, busqueda, filtroFecha]);

  // Filtro por fecha restringido a días hábiles: los domingos no hay
  // entregas, así que la selección se rechaza con un aviso.
  const aplicarFiltroFecha = (valor: string) => {
    if (!valor) {
      setFiltroFecha('');
      setPagina(1);
      return;
    }
    const [año, mes, dia] = valor.split('-').map(Number);
    if (año && new Date(año, mes - 1, dia).getDay() === 0) {
      setToast({ msg: t('adm.pedidos.domingoBloqueado'), tipo: 'err' });
      return;
    }
    setFiltroFecha(valor);
    setPagina(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginaItems = filtrados.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  const formatFechaEntrega = (f: string) => {
    try {
      return new Date(`${f}T00:00:00`).toLocaleDateString('es-CO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return f;
    }
  };

  const cambiarEncargado = async (pedido: PedidoEntrega, valor: string) => {
    setGuardandoId(pedido.id_pedido);
    try {
      await api.put(`/pedidos/admin/${pedido.id_pedido}/entrega`, {
        id_tecnico: valor ? parseInt(valor, 10) : null,
      });
      setToast({ msg: t('adm.pedidos.actualizado'), tipo: 'ok' });
      await cargar();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || t('adm.pedidos.errorActualizar');
      setToast({ msg, tipo: 'err' });
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <motion.section
      className="admin-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="ap-header">
        <div>
          <h1 className="ap-title">{t('adm.pedidos.titulo')}</h1>
          <p className="ap-subtitle">{t('adm.pedidos.desc')}</p>
        </div>
      </div>

      <div className="ap-toolbar">
        <form className="ap-search" onSubmit={(e) => e.preventDefault()}>
          <FaMagnifyingGlass />
          <input
            type="text"
            placeholder={t('adm.pedidos.buscar')}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </form>
        <span className="ap-contador-suave">
          {t('adm.pedidos.total', { n: filtrados.length })}
        </span>
        <div className="ap-filter-date ap-filter-date-derecha">
          <FaCalendarCheck />
          <input
            type="date"
            aria-label={t('adm.pedidos.filtroFecha')}
            title={t('adm.pedidos.filtroFecha')}
            value={filtroFecha}
            onChange={(e) => aplicarFiltroFecha(e.target.value)}
          />
          {filtroFecha && (
            <button
              type="button"
              className="ap-filter-clear"
              aria-label={t('adm.pedidos.limpiarFiltroFecha')}
              onClick={() => aplicarFiltroFecha('')}
            >
              <FaXmark />
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="ap-card">
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('adm.pedidos.cargando')}</h3>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="ap-card">
          <div className="ap-states">
            <div className="ap-states-icon">
              <FaBoxOpen />
            </div>
            <h3>
              {busqueda.trim() || filtroFecha
                ? t('adm.pedidos.sinResultados')
                : t('adm.pedidos.sinPedidos')}
            </h3>
          </div>
        </div>
      ) : (
        <div className="ap-card">
          <div className="ap-table-wrap">
            <table className="ap-table ap-table-citas">
              <thead>
                <tr>
                  <th>{t('adm.pedidos.colPedido')}</th>
                  <th>{t('adm.pedidos.colCliente')}</th>
                  <th>{t('adm.pedidos.colProductos')}</th>
                  <th>{t('adm.pedidos.colDireccion')}</th>
                  <th>{t('adm.pedidos.colEstado')}</th>
                  <th>{t('adm.pedidos.tecnicoEncargado')}</th>
                </tr>
              </thead>
              <tbody>
                {paginaItems.map((p) => {
                  const productosTexto =
                    p.productos.length > 0 ? p.productos.join(', ') : t('adm.pedidos.sinProductos');
                  const direccionTexto = p.direccion || '—';
                  return (
                    <tr key={p.id_pedido}>
                      <td>
                        <strong>#{p.id_pedido}</strong>
                        <div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <FaRegClock />
                          {p.fecha_entrega
                            ? `${formatFechaEntrega(p.fecha_entrega)} · ${p.hora_entrega || '--:--'}`
                            : t('adm.pedidos.sinFecha')}
                        </div>
                      </td>
                      <td>
                        <div className="ap-cell-truncado" title={p.cliente || undefined}>
                          <strong>{p.cliente || '—'}</strong>
                        </div>
                        {p.telefono && (
                          <div className="muted" style={{ fontSize: 12 }}>{p.telefono}</div>
                        )}
                      </td>
                      <td className="ap-col-truncado">
                        <span className="ap-cell-truncado" title={productosTexto}>
                          {productosTexto}
                        </span>
                      </td>
                      <td className="ap-col-truncado">
                        <span className="ap-cell-truncado" title={direccionTexto}>
                          {direccionTexto}
                        </span>
                      </td>
                      <td>
                        <span className={`ap-badge ${ESTADO_CLASE[p.estado_entrega || ''] || 'neutral'}`}>
                          {p.estado_entrega || t('adm.pedidos.sinEstado')}
                        </span>
                      </td>
                      <td>
                        <select
                          aria-label={t('adm.pedidos.tecnicoEncargado')}
                          className="ap-form-select"
                          value={p.id_tecnico_entrega?.toString() || ''}
                          disabled={guardandoId === p.id_pedido}
                          onChange={(e) => cambiarEncargado(p, e.target.value)}
                          style={{ minWidth: 170, width: '100%' }}
                        >
                          <option value="">{t('adm.instalaciones.sinAsignar')}</option>
                          {tecnicos.map((tec) => (
                            <option key={tec.id_tecnico} value={tec.id_tecnico}>
                              {[tec.first_name, tec.last_name].filter(Boolean).join(' ').trim() ||
                                `Técnico #${tec.id_tecnico}`}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="ap-paginacion" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="ap-page-btn"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
              >
                {t('adm.pedidos.paginaAnterior')}
              </button>
              <div className="ap-page-nums">
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`ap-page-btn ${n === paginaActual ? 'active' : ''}`}
                    onClick={() => setPagina(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ap-page-btn"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
              >
                {t('adm.pedidos.paginaSiguiente')}
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className={`ap-toast ${toast.tipo}`}>
          {toast.tipo === 'ok' ? <FaCircleCheck /> : <FaTriangleExclamation />}
          {toast.msg}
        </div>
      )}
    </motion.section>
  );
};

export default AdminPedidos;
