import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FaBoxOpen } from 'react-icons/fa6';
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
  'En camino': 'warn',
  Entregado: 'ok',
  Cancelada: 'err',
};

const AdminPedidos = () => {
  const { t } = useIdioma();
  const [pedidos, setPedidos] = useState<PedidoEntrega[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoSimple[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
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
    if (!q) return pedidos;
    return pedidos.filter(
      (p) =>
        String(p.id_pedido).includes(q) ||
        (p.cliente || '').toLowerCase().includes(q) ||
        p.productos.some((prod) => prod.toLowerCase().includes(q)) ||
        (p.nombre_tecnico || '').toLowerCase().includes(q),
    );
  }, [pedidos, busqueda]);

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
      <div className="ap-card">
        <div className="ap-card-head">
          <h3>
            <FaBoxOpen /> {t('adm.pedidos.titulo')}
          </h3>
          <p>{t('adm.pedidos.desc')}</p>
        </div>

        <div className="ap-form-group" style={{ maxWidth: 360 }}>
          <input
            type="text"
            className="ap-form-input"
            placeholder={t('adm.pedidos.buscar')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {toast && (
          <p style={{ color: toast.tipo === 'ok' ? '#3d7a3d' : '#a33', fontWeight: 600 }}>
            {toast.msg}
          </p>
        )}

        {cargando ? (
          <p style={{ color: '#9a8f78' }}>{t('adm.pedidos.cargando')}</p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: '#9a8f78' }}>{t('adm.pedidos.sinPedidos')}</p>
        ) : (
          <div className="ap-tarifas-grid">
            {filtrados.map((p) => (
              <div className="ap-tarifa-item" key={p.id_pedido} style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="ap-tarifa-nombre" style={{ display: 'block' }}>
                    #{p.id_pedido} · {p.cliente || '—'}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#9a8f78', display: 'block' }}>
                    {p.productos.length > 0 ? p.productos.join(', ') : t('adm.pedidos.sinProductos')}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#9a8f78', display: 'block' }}>
                    {p.fecha_entrega
                      ? `${p.fecha_entrega} ${p.hora_entrega || ''}${p.direccion ? ` · ${p.direccion}` : ''}`
                      : t('adm.pedidos.sinFecha')}
                  </span>
                </div>
                <div className="ap-tarifa-valor" style={{ alignItems: 'flex-end', gap: 6 }}>
                  <span className={`ap-badge ${ESTADO_CLASE[p.estado_entrega || ''] || 'neutral'}`}>
                    {p.estado_entrega || t('adm.pedidos.sinEstado')}
                  </span>
                  <label
                    className="ap-form-label"
                    htmlFor={`encargado-${p.id_pedido}`}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {t('adm.pedidos.tecnicoEncargado')}
                  </label>
                  <select
                    id={`encargado-${p.id_pedido}`}
                    className="ap-form-select"
                    value={p.id_tecnico_entrega?.toString() || ''}
                    disabled={guardandoId === p.id_pedido}
                    onChange={(e) => cambiarEncargado(p, e.target.value)}
                    style={{ minWidth: 180 }}
                  >
                    <option value="">{t('adm.instalaciones.sinAsignar')}</option>
                    {tecnicos.map((tec) => (
                      <option key={tec.id_tecnico} value={tec.id_tecnico}>
                        {[tec.first_name, tec.last_name].filter(Boolean).join(' ').trim() ||
                          `Técnico #${tec.id_tecnico}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default AdminPedidos;
