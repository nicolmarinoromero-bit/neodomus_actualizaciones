import { useState, useEffect, useCallback } from 'react';
import {
  FaCalendarCheck,
  FaCalendarDays,
  FaCircleExclamation,
  FaClock,
  FaEnvelope,
  FaIdCard,
  FaLocationDot,
  FaMagnifyingGlass,
  FaPhone,
  FaScrewdriverWrench,
  FaUserTie,
  FaXmark,
} from 'react-icons/fa6';
import { useIdioma } from '@i18n/IdiomaContext';
import api from '@services/api';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';
import '@styles/citas.css';

interface Cita {
  id_cita: number;
  fecha: string;
  hora: string;
  estado: string;
  tipo_servicio: string;
  cliente: string;
  direccion: string;
  telefono?: number | null;
  email?: string | null;
  documento_tipo?: string | null;
  documento_numero?: number | null;
  descripcion?: string | null;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  id_tecnico_2?: number | null;
  id_tecnico_3?: number | null;
  nombre_tecnico_2?: string | null;
  nombre_tecnico_3?: string | null;
  costo_cita?: number | null;
  id_comision_c?: number | null;
  comision_porcentaje?: number | null;
  comision_valor?: number | null;
}

const ESTADOS_ACTIVAS = ['Pendiente', 'Confirmada'];

const POR_PAGINA = 6;

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

const TecnicoCitas = () => {
  const { idioma, t } = useIdioma();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [horaFiltro, setHoraFiltro] = useState('');

  const [reagendando, setReagendando] = useState<Cita | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [enviandoReagendamiento, setEnviandoReagendamiento] = useState(false);
  const [toastReagendar, setToastReagendar] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null);

  const fetchCitas = async () => {
    try {
      const res = await api.get('/tecnicos/mis-citas');
      setCitas(res.data);
    } catch (err) {
      console.error('Error al cargar citas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCitas();
    const interval = setInterval(fetchCitas, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatFecha = (fecha: string) => {
    const d = new Date(`${fecha}T00:00:00`);
    return d.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const cargarHorasDisponibles = useCallback(async (citaId: number, fecha: string) => {
    if (!fecha) {
      setHorasDisponibles([]);
      return;
    }
    setCargandoHoras(true);
    try {
      const res = await api.get<string[]>(`/tecnicos/citas/${citaId}/horas-disponibles`, {
        params: { fecha },
      });
      setHorasDisponibles(res.data);
      setNuevaHora('');
    } catch (err) {
      console.error('Error al cargar horas:', err);
      setHorasDisponibles([]);
    } finally {
      setCargandoHoras(false);
    }
  }, []);

  useEffect(() => {
    if (reagendando && nuevaFecha) {
      cargarHorasDisponibles(reagendando.id_cita, nuevaFecha);
    } else {
      setHorasDisponibles([]);
    }
  }, [reagendando, nuevaFecha, cargarHorasDisponibles]);

  const iniciarReagendar = (cita: Cita) => {
    setReagendando(cita);
    setNuevaFecha(cita.fecha);
    setNuevaHora('');
    setToastReagendar(null);
  };

  const cancelarReagendar = () => {
    setReagendando(null);
    setNuevaFecha('');
    setNuevaHora('');
    setHorasDisponibles([]);
    setToastReagendar(null);
  };

  const confirmarReagendar = async () => {
    if (!reagendando || !nuevaFecha || !nuevaHora) return;
    setEnviandoReagendamiento(true);
    setToastReagendar(null);
    try {
      await api.put(`/tecnicos/citas/${reagendando.id_cita}/reagendar`, {
        fecha: nuevaFecha,
        hora: nuevaHora,
        id_comision: reagendando.id_comision_c ?? 0,
      });
      setToastReagendar({ msg: t('tec.reagendada'), tipo: 'success' });
      fetchCitas();
      setTimeout(() => cancelarReagendar(), 2000);
    } catch (err: any) {
      console.error(err);
      setToastReagendar({
        msg: err.response?.data?.detail || t('tec.errorReagendar'),
        tipo: 'error',
      });
    } finally {
      setEnviandoReagendamiento(false);
    }
  };

  const q = busqueda.trim().toLowerCase();
  const activas = citas
    .filter((c) => ESTADOS_ACTIVAS.includes(c.estado))
    .filter((c) => {
      if (fechaFiltro && c.fecha !== fechaFiltro) return false;
      if (horaFiltro && c.hora !== horaFiltro) return false;
      if (!q) return true;
      const campos = [
        c.cliente,
        c.documento_numero?.toString() || '',
        c.telefono?.toString() || '',
        c.email || '',
        t(TIPO_SERVICIO[c.tipo_servicio] || 'citas.servicioGeneral'),
        formatFecha(c.fecha),
        c.fecha,
        c.hora,
        c.direccion,
        c.nombre_tecnico || '',
        c.nombre_tecnico_2 || '',
        t(`citas.${c.estado.toLowerCase()}`),
      ];
      return campos.some((v) => v.toLowerCase().includes(q));
    })
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  const sinResultados = activas.length === 0 && citas.length > 0;

  const totalPaginas = Math.max(1, Math.ceil(activas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const citasPagina = activas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  const formatMoneda = (valor: number) =>
    valor.toLocaleString(idioma === 'en' ? 'en-US' : 'es-CO', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const hoyMinimo = (() => {
    const h = new Date();
    h.setDate(h.getDate() + 1);
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="admin-panel">
      <header className="ap-header">
        <div>
          <h1 className="ap-title"><FaCalendarCheck /> {t('tec.misCitas')}</h1>
          <p className="ap-subtitle">{t('tec.misCitasSub')}</p>
        </div>
        <div className="ap-header-right">
          <span className="ap-badge info">{activas.length}</span>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <form className="ap-search" style={{ flex: '1 1 240px', minWidth: 240, margin: 0 }} onSubmit={(e) => e.preventDefault()}>
          <FaMagnifyingGlass />
          <input
            type="text"
            placeholder={t('tec.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </form>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          <input
            type="date"
            className="ap-filtro-fecha"
            title={t('tec.filtrarFecha')}
            value={fechaFiltro}
            onChange={(e) => { setFechaFiltro(e.target.value); setPagina(1); }}
          />
          <select
            className="ap-filtro-estado"
            value={horaFiltro}
            onChange={(e) => { setHoraFiltro(e.target.value); setPagina(1); }}
          >
            <option value="">{t('tec.todasHoras')}</option>
            {Array.from({ length: 11 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          {fechaFiltro && (
            <button type="button" className="ap-btn ap-btn-ghost" onClick={() => { setFechaFiltro(''); setPagina(1); }}>
              <FaXmark /> {t('tec.quitarFiltro')}
            </button>
          )}
        </div>
      </div>

      <div className="ap-card" style={{ marginTop: 8 }}>
        {loading ? (
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('tec.cargandoCitas')}</h3>
          </div>
        ) : citas.length === 0 ? (
          <div className="ap-states">
            <div className="ap-states-icon"><FaCalendarDays /></div>
            <h3>{t('tec.vacioCitas')}</h3>
            <p>{t('tec.vacioCitasHint')}</p>
          </div>
        ) : sinResultados ? (
          <div className="ap-states">
            <div className="ap-states-icon"><FaMagnifyingGlass /></div>
            <h3>{t('tec.sinResultadosFiltro')}</h3>
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
<th>{t('tec.comision')}</th>
<th>{t('tec.tecnico')}</th>
<th>{t('tec.estado')}</th>
<th>{t('tec.reagendar')}</th>
                </tr>
              </thead>
              <tbody>
                {citasPagina.map((cita) => (
                  <tr key={cita.id_cita}>
                    <td>
                      <strong>{cita.cliente}</strong>
                      {cita.documento_numero ? (
                        <div className="muted"><FaIdCard /> {cita.documento_tipo || 'CC'} {cita.documento_numero}</div>
                      ) : null}
                      {cita.telefono ? <div className="muted"><FaPhone /> {cita.telefono}</div> : null}
                      {cita.email ? <div className="muted"><FaEnvelope /> {cita.email}</div> : null}
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
                      {cita.costo_cita != null ? (
                        <div className="muted" style={{ marginTop: 4 }}>
                          {formatMoneda(cita.costo_cita)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {cita.comision_valor != null ? (
                        <>
                          <span className="ap-badge ok">
                            {t('tec.comision')} {cita.comision_porcentaje != null ? `${cita.comision_porcentaje}%` : ''}
                          </span>
                          <div className="muted" style={{ marginTop: 4, whiteSpace: 'nowrap' }}>
                            {formatMoneda(cita.comision_valor)}
                          </div>
                        </>
                      ) : (
                        <span className="muted">{t('tec.sinComision')}</span>
                      )}
                    </td>
                    <td>
                      <FaUserTie /> {cita.nombre_tecnico || t('tec.tecnico')}
                      {cita.nombre_tecnico_2 ? <div className="muted"><FaUserTie /> {cita.nombre_tecnico_2}</div> : null}
                      {cita.nombre_tecnico_3 ? <div className="muted"><FaUserTie /> {cita.nombre_tecnico_3}</div> : null}
                    </td>
                    <td>
                      <span className={`ap-badge ${ESTADO_BADGE[cita.estado] || 'neutral'}`}>
                        {t(`citas.${cita.estado.toLowerCase()}`)}
                      </span>
                    </td>
                    <td>
                      {(cita.estado === 'Pendiente' || cita.estado === 'Confirmada') && (
                        <button
                          className="ap-btn ap-btn-secondary ap-btn-small"
                          onClick={() => iniciarReagendar(cita)}
                        >
                          {t('tec.reagendar')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPaginas > 1 && (
          <div className="ap-paginacion">
            <button
              type="button"
              className="ap-page-btn"
              disabled={paginaActual === 1}
              onClick={() => setPagina(paginaActual - 1)}
            >
              ‹ {t('tec.anterior')}
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
              {t('tec.siguiente')} ›
            </button>
          </div>
        )}
      </div>

      {activas.length > 0 && (
        <div className="ap-card" style={{ marginTop: 20, borderLeft: '4px solid #d4a54b' }}>
          <p style={{ margin: 0, color: '#dcdcdc', fontSize: '0.9rem' }}>
            <FaCircleExclamation style={{ marginRight: 8, color: '#d4a54b' }} />
            {t('tec.tienesPendientes', { n: activas.length })}
          </p>
        </div>
      )}

      {reagendando && (
        <div className="citas-modal-overlay" onClick={cancelarReagendar}>
          <div className="citas-modal" onClick={(e) => e.stopPropagation()}>
            <div className="citas-modal-header">
              <h2><FaCalendarDays /> {t('tec.reagendarTitulo')}</h2>
              <button type="button" className="citas-modal-close" onClick={cancelarReagendar}>
                <FaXmark />
              </button>
            </div>

            <p className="citas-modal-sub">{t('tec.reagendarSub')}</p>

            <div className="citas-modal-section">
              <h3><FaIdCard /> {t('tec.datosCita')}</h3>
              <p className="citas-modal-hint"><FaClock /> {t('tec.camposBloqueados')}</p>

              <div className="citas-form-row">
                <div className="citas-form-field">
                  <label>{t('tec.cliente')}</label>
                  <input type="text" value={reagendando.cliente} readOnly />
                </div>
                <div className="citas-form-field">
                  <label>{t('tec.motivo')}</label>
                  <input type="text" value={t(TIPO_SERVICIO[reagendando.tipo_servicio] || 'citas.servicioGeneral')} readOnly />
                </div>
              </div>

              <div className="citas-form-row">
                <div className="citas-form-field">
                  <label>{t('tec.fechaActual')}</label>
                  <input type="text" value={formatFecha(reagendando.fecha)} readOnly />
                </div>
                <div className="citas-form-field">
                  <label>{t('tec.horaActual')}</label>
                  <input type="text" value={reagendando.hora} readOnly />
                </div>
              </div>

              <div className="citas-form-row">
                <div className="citas-form-field">
                  <label>{t('tec.direccion')}</label>
                  <input type="text" value={reagendando.direccion} readOnly />
                </div>
                {reagendando.descripcion && (
                  <div className="citas-form-field">
                    <label>{t('tec.descripcion')}</label>
                    <input type="text" value={reagendando.descripcion} readOnly />
                  </div>
                )}
              </div>

              <div className="citas-form-row">
                <div className="citas-form-field">
                  <label><FaUserTie /> {t('tec.tecnico')}</label>
                  <input type="text" value={reagendando.nombre_tecnico || '-'} readOnly />
                </div>
                {reagendando.nombre_tecnico_2 && (
                  <div className="citas-form-field">
                    <label><FaUserTie /> Técnico 2</label>
                    <input type="text" value={reagendando.nombre_tecnico_2} readOnly />
                  </div>
                )}
              </div>
              {reagendando.nombre_tecnico_3 && (
                <div className="citas-form-row">
                  <div className="citas-form-field">
                    <label><FaUserTie /> Técnico 3</label>
                    <input type="text" value={reagendando.nombre_tecnico_3} readOnly />
                  </div>
                </div>
              )}
            </div>

            <div className="citas-modal-section">
              <h3><FaCalendarDays /> {t('tec.nuevaFecha')}</h3>
              <input
                type="date"
                className="citas-modal-date"
                value={nuevaFecha}
                min={hoyMinimo}
                onChange={(e) => setNuevaFecha(e.target.value)}
              />
            </div>

            <div className="citas-modal-section">
              <h3><FaClock /> {t('tec.nuevaHora')}</h3>
              {!nuevaFecha && (
                <p className="citas-modal-hint">{t('tec.seleccionaFecha')}</p>
              )}
              {nuevaFecha && cargandoHoras && (
                <div className="citas-modal-loading">
                  <span className="ap-loader" />
                </div>
              )}
              {nuevaFecha && !cargandoHoras && horasDisponibles.length === 0 && (
                <p className="citas-modal-hint">{t('tec.sinHorasDisponibles')}</p>
              )}
              {nuevaFecha && !cargandoHoras && horasDisponibles.length > 0 && (
                <div className="citas-horas-grid">
                  {horasDisponibles.map((hora) => (
                    <button
                      key={hora}
                      type="button"
                      className={`citas-hora-btn ${nuevaHora === hora ? 'selected' : ''}`}
                      onClick={() => setNuevaHora(hora)}
                    >
                      {hora}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {toastReagendar && (
              <div className={`citas-toast ${toastReagendar.tipo}`}>
                {toastReagendar.msg}
              </div>
            )}

            <p className="citas-modal-hint" style={{ marginTop: 12 }}>
              <FaCircleExclamation style={{ marginRight: 6 }} />
              {t('tec.reagendarNota')}
            </p>

            <div className="citas-modal-actions">
              <button
                type="button"
                className="citas-btn citas-btn-ghost"
                onClick={cancelarReagendar}
                disabled={enviandoReagendamiento}
              >
                {t('tec.cancelarReagendar')}
              </button>
              <button
                type="button"
                className="citas-btn citas-btn-primary"
                disabled={!nuevaFecha || !nuevaHora || enviandoReagendamiento}
                onClick={confirmarReagendar}
              >
                {enviandoReagendamiento ? t('citas.guardando') : t('tec.confirmarReagendar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TecnicoCitas;
