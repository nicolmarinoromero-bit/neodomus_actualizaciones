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

  const cargar = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const [entregasRes, tecnicosRes] = await Promise.all([
        api.get<PedidoEntrega[]>('/pedidos/admin/entregas'),
        api.get<TecnicoSimple[]>('/tecnicos'),
      ]);
      setPedidos(entregasRes.data);
      setTecnicos(tecnicosRes.data);
    } catch {
      if (!silencioso) setToast({ msg: t('adm.pedidos.errorCargar'), tipo: 'err' });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // Tiempo real: refresco silencioso cada 30 s para ver datos actuales.
    const intervalo = window.setInterval(() => cargar(true), 30000);
    return () => window.clearInterval(intervalo);
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
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('adm.pedidos.cliente') || 'Cliente'}</th>
                  <th>{t('adm.pedidos.productos') || 'Productos'}</th>
                  <th>{t('adm.pedidos.fechaEntrega') || 'Fecha entrega'}</th>
                  <th>Estado</th>
                  <th>{t('adm.pedidos.tecnicoEncargado')}</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id_pedido}>
                    <td style={{ fontWeight: 600 }}>{p.id_pedido}</td>
                    <td>{p.cliente || '—'}</td>
                    <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.productos.length > 0 ? p.productos.join(', ') : '—'}
                    </td>
                    <td>
                      {p.fecha_entrega
                        ? `${p.fecha_entrega} ${p.hora_entrega || ''}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`ap-badge ${ESTADO_CLASE[p.estado_entrega || ''] || 'neutral'}`}>
                        {p.estado_entrega || t('adm.pedidos.sinEstado')}
                      </span>
                    </td>
                    <td>
                      <select
                        className="ap-form-select"
                        value={p.id_tecnico_entrega?.toString() || ''}
                        disabled={guardandoId === p.id_pedido}
                        onChange={(e) => cambiarEncargado(p, e.target.value)}
                        style={{ minWidth: 160 }}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default AdminPedidos;
