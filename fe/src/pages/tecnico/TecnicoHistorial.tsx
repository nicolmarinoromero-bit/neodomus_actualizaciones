import { useState, useEffect } from 'react';
import {
  FaCalendarDays,
  FaClock,
  FaClockRotateLeft,
  FaLocationDot,
  FaMagnifyingGlass,
  FaScrewdriverWrench,
  FaUserTie,
} from 'react-icons/fa6';
import { useIdioma } from '@i18n/IdiomaContext';
import api from '@services/api';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';

interface Cita {
  id_cita: number;
  fecha: string;
  hora: string;
  estado: string;
  tipo_servicio: string;
  cliente: string;
  direccion: string;
  telefono?: number | null;
  descripcion?: string | null;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  id_tecnico_2?: number | null;
  nombre_tecnico_2?: string | null;
}

type Filtro = 'todas' | 'Finalizada' | 'Cancelada';

const ESTADOS_HISTORIAL = ['Finalizada', 'Cancelada'];

const TIPO_SERVICIO: Record<string, string> = {
  instalacion: 'citas.instalacion',
  reparacion: 'citas.reparacion',
  mantenimiento: 'citas.mantenimiento',
  revision: 'citas.revisionTecnica',
  soporte: 'citas.soporte',
};

const ESTADO_BADGE: Record<string, string> = {
  Pendiente: 'pendiente',
  Confirmada: 'info',
  Finalizada: 'ok',
  Cancelada: 'err',
};

const TecnicoHistorial = () => {
  const { idioma, t } = useIdioma();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');

  const fetchCitas = async () => {
    try {
      const res = await api.get('/tecnicos/mis-citas');
      setCitas(res.data);
    } catch (err) {
      console.error('Error al cargar historial:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCitas();
    const interval = setInterval(fetchCitas, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const historial = citas
    .filter((c) => ESTADOS_HISTORIAL.includes(c.estado))
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));

  const formatFecha = (fecha: string) => {
    const d = new Date(`${fecha}T00:00:00`);
    return d.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const q = busqueda.trim().toLowerCase();
  const visibles = historial.filter((c) => {
    if (filtro !== 'todas' && c.estado !== filtro) return false;
    if (!q) return true;
    const campos = [
      c.cliente,
      c.telefono?.toString() || '',
      formatFecha(c.fecha),
      c.fecha,
      c.hora,
      t(TIPO_SERVICIO[c.tipo_servicio] || 'citas.servicioGeneral'),
      c.descripcion || '',
      c.direccion,
      c.nombre_tecnico || '',
      c.nombre_tecnico_2 || '',
      t(`citas.${c.estado.toLowerCase()}`),
    ];
    return campos.some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div className="admin-panel">
      <header className="ap-header">
        <div>
          <h1 className="ap-title"><FaClockRotateLeft /> {t('tec.historialTitulo')}</h1>
          <p className="ap-subtitle">{t('tec.historialSub')}</p>
        </div>
      </header>

      <form className="ap-search" style={{ marginBottom: 14 }} onSubmit={(e) => e.preventDefault()}>
        <FaMagnifyingGlass />
        <input
          type="text"
          placeholder={t('tec.buscarPlaceholder')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </form>

      <div className="ap-card" style={{ marginTop: 8 }}>
        {loading ? (
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('tec.cargandoCitas')}</h3>
          </div>
        ) : (
          <>
            {historial.length > 0 && (
              <div className="ap-card-head" style={{ flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '0.9rem' }}>{t('tec.historialTitulo')}</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['todas', 'Finalizada', 'Cancelada'] as Filtro[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`ap-btn ${filtro === f ? 'ap-btn-primary' : 'ap-btn-ghost'}`}
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={() => setFiltro(f)}
                    >
                      {f === 'todas'
                        ? t('tec.todas')
                        : t(`citas.${f.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibles.length === 0 ? (
              <div className="ap-states">
                <div className="ap-states-icon"><FaClockRotateLeft /></div>
                <h3>{t('tec.vacioHistorial')}</h3>
                <p>{t('tec.vacioHistorialHint')}</p>
              </div>
            ) : (
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>{t('tec.cliente')}</th>
                      <th>{t('tec.fecha')}</th>
                      <th>{t('tec.hora')}</th>
                      <th>{t('tec.motivo')}</th>
                      <th>{t('tec.estado')}</th>
                      <th>{t('tec.tecnico')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((cita) => (
                      <tr key={cita.id_cita}>
                        <td>
                          <strong>{cita.cliente}</strong>
                          {cita.telefono ? <div className="muted">{cita.telefono}</div> : null}
                        </td>
                        <td>
                          <FaCalendarDays /> {formatFecha(cita.fecha)}
                        </td>
                        <td>
                          <FaClock /> {cita.hora}
                        </td>
                        <td>
                          <FaScrewdriverWrench /> {t(TIPO_SERVICIO[cita.tipo_servicio] || 'citas.servicioGeneral')}
                          {cita.descripcion ? (
                            <div className="muted" style={{ marginTop: 4 }}>{cita.descripcion}</div>
                          ) : null}
                          <div className="muted" style={{ marginTop: 4 }}>
                            <FaLocationDot /> {cita.direccion}
                          </div>
                        </td>
                        <td>
                          <span className={`ap-badge ${ESTADO_BADGE[cita.estado] || 'neutral'}`}>
                            {t(`citas.${cita.estado.toLowerCase()}`)}
                          </span>
                        </td>
                        <td>
                          <FaUserTie /> {cita.nombre_tecnico || t('tec.tecnico')}
                          {cita.nombre_tecnico_2 ? <div className="muted"><FaUserTie /> {cita.nombre_tecnico_2}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TecnicoHistorial;
