import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaUsers, FaCircleInfo, FaMagnifyingGlass } from 'react-icons/fa6';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';
import api from '@services/api';
import { useIdioma } from '@i18n/IdiomaContext';
import type { ClienteAdmin } from '../../types';

const AdminClientes = () => {
  const { t, idioma } = useIdioma();
  const [clientes, setClientes] = useState<ClienteAdmin[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = async () => {
    setCargando(true);
    setError(false);
    try {
      const res = await api.get<ClienteAdmin[]>('/clients');
      setClientes(res.data || []);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = clientes.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.documento_cliente?.toString() || '').includes(q) ||
      (c.telefono_cliente?.toString() || '').includes(q)
    );
  });

  const formatoFecha = (f: string | null | undefined) => {
    if (!f) return '—';
    try {
      return new Date(f).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO');
    } catch {
      return f;
    }
  };

  const formatoTel = (t: number | null | undefined) => (t ? `+${t}` : '—');

  return (
    <motion.section
      className="admin-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="ap-header">
        <div>
          <h1 className="ap-title">{t('adm.clientes.titulo')}</h1>
          <p className="ap-subtitle">
            {clientes.length > 0
              ? t('adm.clientes.subtituloConteo', { n: clientes.length })
              : t('adm.clientes.subtituloVacio')}
          </p>
        </div>
      </div>

      <div className="ap-filters" style={{ marginBottom: 20 }}>
        <form className="ap-search" onSubmit={(e) => e.preventDefault()}>
          <FaMagnifyingGlass />
          <input
            type="text"
            placeholder={t('adm.clientes.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </form>
      </div>

      {cargando ? (
        <div className="ap-card">
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('adm.clientes.cargando')}</h3>
            <p>{t('adm.clientes.cargandoDesc')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="ap-card">
          <div className="ap-states error">
            <div className="ap-states-icon">
              <FaCircleInfo />
            </div>
            <h3>{t('adm.clientes.errorTitulo')}</h3>
            <p>{t('adm.clientes.errorDesc')}</p>
            <button type="button" className="ap-btn ap-btn-ghost" onClick={cargar}>
              {t('adm.clientes.reintentar')}
            </button>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="ap-card">
          <div className="ap-states">
            <div className="ap-states-icon">
              <FaUsers />
            </div>
            <h3>{busqueda ? t('adm.clientes.sinResultados') : t('adm.clientes.noHayClientes')}</h3>
            <p>
              {busqueda
                ? t('adm.clientes.sinResultadosDetalle', { q: busqueda.trim() })
                : t('adm.clientes.vacioDetalle')}
            </p>
          </div>
        </div>
      ) : (
        <div className="ap-card">
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>{t('adm.clientes.colCliente')}</th>
                  <th>{t('adm.clientes.colTelefono')}</th>
                  <th>{t('adm.clientes.colRegistro')}</th>
                  <th>{t('adm.clientes.colPedidos')}</th>
                  <th>{t('adm.clientes.colCitas')}</th>
                  <th>{t('adm.clientes.colCuenta')}</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id_cliente}>
                    <td>
                      <div className="ap-cell-user">
                        <span className="ap-initials" aria-hidden="true">
                          {(c.first_name || '?')[0]}
                          {(c.last_name || '')[0]}
                        </span>
                        <div>
                          <strong>
                            {c.first_name} {c.last_name}
                          </strong>
                          <span>{c.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{formatoTel(c.telefono_cliente)}</td>
                    <td className="muted">{formatoFecha(c.created_at)}</td>
                    <td>
                      <span className="ap-badge info">{t('adm.clientes.pedidos', { n: c.pedidos_count ?? 0 })}</span>
                    </td>
                    <td>
                      <span className="ap-badge neutral">{t('adm.clientes.citas', { n: c.citas_count ?? 0 })}</span>
                    </td>
                    <td>
                      <span className={`ap-badge ${c.is_active ? 'ok' : 'err'}`}>
                        {c.is_active ? t('adm.clientes.activa') : t('adm.clientes.inhabilitada')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.section>
  );
};

export default AdminClientes;