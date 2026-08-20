import { useState, useEffect } from 'react';
import {
  FaBell,
  FaCalendarCheck,
  FaCalendarDays,
  FaCalendarWeek,
  FaCamera,
  FaCircleCheck,
  FaCircleExclamation,
  FaClock,
  FaClockRotateLeft,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaIdCard,
  FaLock,
  FaLocationDot,
  FaMagnifyingGlass,
  FaPhone,
  FaScrewdriverWrench,
  FaStar,
  FaSun,
  FaTrashCan,
  FaTruckFast,
  FaUserTie,
  FaXmark,
} from 'react-icons/fa6';
import { useAuth } from '@contexts/AuthContext';
import { useIdioma } from '@i18n/IdiomaContext';
import api from '@services/api';
import { useTecnicoNotificaciones } from '../../hooks/useTecnicoNotificaciones';
import { ICONO_TIPO } from '../../components/layout/NotificacionesBell';
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
  email?: string | null;
  documento_tipo?: string | null;
  documento_numero?: number | null;
  descripcion?: string | null;
  id_tecnico?: number | null;
  evidencias?: EvidenciaItem[];
  calificacion?: CalificacionCita | null;
}

interface EvidenciaItem {
  id_evidencia: number;
  url: string;
  descripcion?: string | null;
  fecha_subida?: string | null;
}

interface CalificacionCita {
  calificacion: number;
  comentario?: string | null;
  fecha?: string | null;
}

interface Entrega {
  id_pedido: number;
  cliente: string;
  telefono?: number | null;
  email?: string | null;
  direccion?: string | null;
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  estado_entrega?: string | null;
  productos?: { descripcion: string; cantidad: number; subtotal: number }[];
}

interface CalificacionRecibida {
  id_calificacion: number;
  calificacion: number;
  comentario?: string | null;
  cliente?: string;
  created_at?: string | null;
}

interface ResumenCalificaciones {
  promedio?: number | null;
  total?: number;
  calificaciones?: CalificacionRecibida[];
}

type Toast = { msg: string; tipo: 'success' | 'error' } | null;

const ESTADOS_PROGRAMADA = ['Pendiente', 'Confirmada'];

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

const ESTADOS_TECNICO = ['Finalizada'];

const fechaLocal = (): string => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const API_HOST = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');

const urlEvidencia = (url: string) => (url.startsWith('http') ? url : `${API_HOST}${url}`);

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const { idioma, t } = useIdioma();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [calificaciones, setCalificaciones] = useState<ResumenCalificaciones>({});
  const [loading, setLoading] = useState(true);
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updatingEntrega, setUpdatingEntrega] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const { notificaciones, noLeidas, marcarLeida, leerTodas } = useTecnicoNotificaciones();
  const [descEvidencia, setDescEvidencia] = useState('');
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false);
  const [eliminandoEvidencia, setEliminandoEvidencia] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [passOpen, setPassOpen] = useState(false);
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [passMostrar, setPassMostrar] = useState(false);
  const [passGuardando, setPassGuardando] = useState(false);

  useEffect(() => {
    fetchCitas();
    const interval = setInterval(fetchCitas, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCitas = async () => {
    try {
      const res = await api.get('/tecnicos/mis-citas');
      setCitas(res.data);
    } catch (err) {
      console.error('Error al cargar citas:', err);
    } finally {
      setLoading(false);
    }
    try {
      const resE = await api.get('/tecnicos/mis-entregas');
      setEntregas(resE.data || []);
    } catch (err) {
      console.error('Error al cargar entregas:', err);
    }
    try {
      const resC = await api.get('/calificaciones/mis');
      setCalificaciones(resC.data || {});
    } catch (err) {
      console.error('Error al cargar calificaciones:', err);
    }
  };

  const notificar = (msg: string, tipo: 'success' | 'error' = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const actualizarEstado = async (id_cita: number, nuevoEstado: string) => {
    setUpdatingId(id_cita);
    try {
      const res = await api.put<Cita>(`/tecnicos/citas/${id_cita}/estado`, { estado: nuevoEstado });
      const citaActualizada = res.data;
      if (nuevoEstado === 'Finalizada' || nuevoEstado === 'Cancelada') {
        notificar(
          nuevoEstado === 'Cancelada' ? t('tec.citaCancelada') : t('tec.citaCompletada')
        );
        setSelectedCita(null);
        setModalOpen(false);
      } else {
        notificar(
          nuevoEstado === 'Confirmada' ? t('tec.citaConfirmada') : t('tec.citaPendiente')
        );
        setSelectedCita((prev) =>
          prev && prev.id_cita === id_cita ? { ...prev, ...citaActualizada } : prev
        );
      }
      await fetchCitas();
    } catch (err: any) {
      console.error(err);
      notificar(err.response?.data?.detail || t('tec.errorEstado'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const aplicarEvidencias = (id_cita: number, evidencias: EvidenciaItem[]) => {
    setCitas((prev) => prev.map((c) => (c.id_cita === id_cita ? { ...c, evidencias } : c)));
    setSelectedCita((prev) => (prev && prev.id_cita === id_cita ? { ...prev, evidencias } : prev));
  };

  const subirEvidencia = async (id_cita: number, file: File) => {
    if (!file) return;
    setSubiendoEvidencia(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('descripcion', descEvidencia.trim());
      const res = await api.post(`/tecnicos/citas/${id_cita}/evidencias`, fd);
      aplicarEvidencias(id_cita, res.data?.evidencias || []);
      setDescEvidencia('');
      notificar('Evidencia subida correctamente');
    } catch (err: any) {
      console.error(err);
      notificar(err.response?.data?.detail || 'No se pudo subir la evidencia', 'error');
    } finally {
      setSubiendoEvidencia(false);
    }
  };

  const eliminarEvidencia = async (id_cita: number, id_evidencia: number) => {
    setEliminandoEvidencia(id_evidencia);
    try {
      const res = await api.delete(`/tecnicos/citas/${id_cita}/evidencias/${id_evidencia}`);
      aplicarEvidencias(id_cita, res.data?.evidencias || []);
      notificar('Evidencia eliminada');
    } catch (err: any) {
      console.error(err);
      notificar(err.response?.data?.detail || 'No se pudo eliminar la evidencia', 'error');
    } finally {
      setEliminandoEvidencia(null);
    }
  };

  const openModal = (cita: Cita) => {
    setSelectedCita(cita);
    setModalOpen(true);
  };

  const actualizarEntrega = async (pedidoId: number, nuevoEstado: string) => {
    setUpdatingEntrega(pedidoId);
    try {
      await api.put(`/tecnicos/entregas/${pedidoId}/estado`, { estado: nuevoEstado });
      notificar(
        nuevoEstado === 'En camino'
          ? 'El cliente fue notificado de tu llegada inminente'
          : 'Entrega marcada como entregada'
      );
      await fetchCitas();
    } catch (err: any) {
      console.error(err);
      notificar(err.response?.data?.detail || 'No se pudo actualizar la entrega', 'error');
    } finally {
      setUpdatingEntrega(null);
    }
  };

  const hoy = fechaLocal();
  const q = busqueda.trim().toLowerCase();
  const coincideCita = (c: Cita): boolean => {
    if (!q) return true;
    const campos = [
      c.cliente,
      c.telefono?.toString() || '',
      c.email || '',
      c.documento_numero?.toString() || '',
      t(TIPO_SERVICIO[c.tipo_servicio] || 'citas.servicioGeneral'),
      c.fecha,
      c.hora,
      c.direccion,
      t(`citas.${c.estado.toLowerCase()}`),
    ];
    return campos.some((v) => v.toLowerCase().includes(q));
  };
  const coincideEntrega = (e: Entrega): boolean => {
    if (!q) return true;
    const campos = [
      e.cliente,
      String(e.id_pedido),
      e.direccion || '',
      e.fecha_entrega || '',
      e.hora_entrega || '',
    ];
    return campos.some((v) => v.toLowerCase().includes(q));
  };
  const citasHoy = citas.filter((c) => c.fecha === hoy);
  const citasHoyVisibles = citasHoy.filter(coincideCita);
  const citasProximas = citas.filter(
    (c) => c.fecha > hoy && ESTADOS_PROGRAMADA.includes(c.estado) && coincideCita(c)
  );
  const citasProgramadas = citas.filter((c) => ESTADOS_PROGRAMADA.includes(c.estado));
  const citasCompletadas = citas.filter((c) => c.estado === 'Finalizada');
  const historial = citas
    .filter((c) => c.estado === 'Finalizada' || c.estado === 'Cancelada')
    .filter(coincideCita)
    .slice(0, 5);
  const entregasVisibles = entregas.filter(coincideEntrega);

  const fechaHoyTexto = new Date().toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const renderCitaRow = (cita: Cita) => (
    <div key={cita.id_cita} className="novedad-item">
      <div className="novedad-left">
        <div className="icon-circle"><FaUserTie /></div>
        <div>
          <h3>{cita.cliente}</h3>
          <p>
            <FaScrewdriverWrench style={{ marginRight: 6 }} />
            {t(TIPO_SERVICIO[cita.tipo_servicio] || 'citas.servicioGeneral')}
          </p>
          <p>
            <FaLocationDot style={{ marginRight: 6 }} />
            {cita.direccion}
          </p>
          {cita.documento_numero ? (
            <p>
              <FaIdCard style={{ marginRight: 6 }} />
              {cita.documento_tipo || 'CC'} {cita.documento_numero}
            </p>
          ) : null}
          {cita.telefono ? (
            <p>
              <FaPhone style={{ marginRight: 6 }} />
              {cita.telefono}
            </p>
          ) : null}
          {cita.email ? (
            <p>
              <FaEnvelope style={{ marginRight: 6 }} />
              {cita.email}
            </p>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <span className="novedad-fecha">
          <FaClock /> {new Date(`${cita.fecha}T${cita.hora}`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' })} · {cita.hora}
        </span>
        <span className={`ap-badge ${ESTADO_BADGE[cita.estado] || 'neutral'}`}>
          {t(`citas.${cita.estado.toLowerCase()}`)}
        </span>
        <button type="button" className="ap-btn ap-btn-primary" onClick={() => openModal(cita)}>
          {t('tec.ver')}
        </button>
      </div>
    </div>
  );

  const renderEmpty = (icon: React.ReactNode, titulo: string, hint: string) => (
    <div className="ap-states">
      <div className="ap-states-icon">{icon}</div>
      <h3>{titulo}</h3>
      <p>{hint}</p>
    </div>
  );

  const guardarContrasena = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqsValidas =
      nueva.length >= 8 &&
      /[A-Z]/.test(nueva) &&
      /[a-z]/.test(nueva) &&
      /\d/.test(nueva) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(nueva);
    if (!reqsValidas || nueva !== confirmar) {
      setToast({ msg: t('perfil.validacionesContrasena'), tipo: 'error' });
      return;
    }
    setPassGuardando(true);
    try {
      await api.post('/auth/update-password', { new_password: nueva });
      setPassOpen(false);
      setNueva('');
      setConfirmar('');
      setToast({ msg: t('perfil.contrasenaActualizada'), tipo: 'success' });
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      setToast({ msg: typeof msg === 'string' ? msg : t('perfil.errorCambiarContrasena'), tipo: 'error' });
    } finally {
      setPassGuardando(false);
    }
  };

  return (
    <div className="admin-panel">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">
            {t('tec.bienvenida', { nombre: user?.nombre?.split(' ')[0] || t('tec.tecnico') })}
          </h1>
          <p className="ap-subtitle">{t('tec.resumenJornada')}</p>
        </div>

        <div className="ap-header-right">
          <button
            type="button"
            className="ap-btn ap-btn-ghost"
            onClick={() => { setNueva(''); setConfirmar(''); setPassMostrar(false); setPassOpen(true); }}
          >
            <FaLock /> {t('tec.cambiarContrasena')}
          </button>
          <span className="welcome-badge">
            <FaCalendarCheck />
            {fechaHoyTexto}
          </span>
        </div>
      </header>

      <form className="ap-search" style={{ marginBottom: 20 }} onSubmit={(e) => e.preventDefault()}>
        <FaMagnifyingGlass />
        <input
          type="text"
          placeholder={t('tec.buscarPlaceholder')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </form>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><FaCalendarCheck /></div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{citas.length}</div>
            <div className="admin-stat-label">{t('tec.citasAsignadas')}</div>
            <div className="admin-stat-hint">{t('tec.totalAgenda')}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon"><FaSun /></div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{citasHoy.length}</div>
            <div className="admin-stat-label">{t('tec.citasHoy')}</div>
            <div className="admin-stat-hint">{t('tec.agendaDia')}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon"><FaClock /></div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{citasProgramadas.length}</div>
            <div className="admin-stat-label">{t('tec.pendientes')}</div>
            <div className="admin-stat-hint">{t('tec.porAtender')}</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon"><FaCircleCheck /></div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{citasCompletadas.length}</div>
            <div className="admin-stat-label">{t('tec.completadas')}</div>
            <div className="admin-stat-hint">{t('tec.trabajosFinalizados')}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="ap-states">
          <span className="ap-loader" />
          <h3>{t('tec.cargandoCitas')}</h3>
        </div>
      ) : (
        <div className="ap-grid">
          <div className="ap-card" style={{ borderLeft: '4px solid #d4a54b' }}>
            <div className="ap-card-head">
              <h2><FaCalendarDays /> {t('tec.citasDelDia')}</h2>
            </div>

            {citasHoyVisibles.length === 0 ? (
              renderEmpty(
                <FaCalendarDays />,
                t('tec.sinCitasHoy'),
                t('tec.sinCitasHoyHint')
              )
            ) : (
              citasHoyVisibles.map(renderCitaRow)
            )}
          </div>

          <div className="ap-card">
            <div className="ap-card-head">
              <h2><FaCalendarWeek /> {t('tec.proximasCitas')}</h2>
            </div>

            {citasProximas.length === 0 ? (
              renderEmpty(
                <FaCalendarWeek />,
                t('tec.sinProximas'),
                t('tec.sinProximasHint')
              )
            ) : (
              <div className="ap-carrusel">
                {citasProximas.map(renderCitaRow)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ap-card" style={{ marginTop: 20 }}>
        <div className="ap-card-head">
          <h2><FaClockRotateLeft /> {t('tec.historialReciente')}</h2>
        </div>
        {historial.length === 0 ? (
          <p style={{ margin: 0, color: '#bdbdbd' }}>{t('tec.sinHistorial')}</p>
        ) : (
          historial.map(renderCitaRow)
        )}
      </div>

      <div className="ap-card" style={{ marginTop: 20 }}>
        <div className="ap-card-head">
          <h2><FaTruckFast /> {t('tec.misEntregas')}</h2>
        </div>
        {entregasVisibles.length === 0 ? (
          <p style={{ margin: 0, color: '#bdbdbd' }}>{t('tec.sinEntregas')}</p>
        ) : (
          entregasVisibles.map((e) => (
            <div key={e.id_pedido} className="novedad-item">
              <div className="novedad-left">
                <div className="icon-circle"><FaTruckFast /></div>
                <div>
                  <h3>
                    {e.cliente}
                    <span className="muted" style={{ fontWeight: 'normal', marginLeft: 8 }}>
                      Pedido #{e.id_pedido}
                    </span>
                  </h3>
                  <p><FaCalendarDays style={{ marginRight: 6 }} />
                    {e.fecha_entrega ? new Date(e.fecha_entrega).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''} · {e.hora_entrega || ''}
                  </p>
                  <p><FaLocationDot style={{ marginRight: 6 }} />{e.direccion || t('tec.noRegistrado')}</p>
                  <p><FaPhone style={{ marginRight: 6 }} />{e.telefono ?? t('tec.noRegistrado')}</p>
                  {e.email ? <p><FaEnvelope style={{ marginRight: 6 }} />{e.email}</p> : null}
                  {e.productos && e.productos.length > 0 && (
                    <div className="ap-entrega-productos">
                      {e.productos.map((p, idx) => (
                        <span key={idx}>
                          × {p.cantidad} {p.descripcion}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span className={`ap-badge ${e.estado_entrega === 'Entregado' ? 'ok' : e.estado_entrega === 'En camino' ? 'info' : 'pendiente'}`}>
                  {e.estado_entrega || 'Asignada'}
                </span>
                {e.estado_entrega !== 'Entregado' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {e.estado_entrega !== 'En camino' && (
                      <button
                        type="button"
                        className="ap-btn ap-btn-primary"
                        disabled={updatingEntrega === e.id_pedido}
                        onClick={() => actualizarEntrega(e.id_pedido, 'En camino')}
                      >
                        {updatingEntrega === e.id_pedido ? t('tec.procesando') : t('tec.enCamino')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="ap-btn ap-btn-ok"
                      disabled={updatingEntrega === e.id_pedido}
                      onClick={() => actualizarEntrega(e.id_pedido, 'Entregado')}
                    >
                      <FaCircleCheck />
                      {updatingEntrega === e.id_pedido ? t('tec.procesando') : t('tec.entregado')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ap-card" style={{ marginTop: 20 }}>
        <div className="ap-card-head">
          <h2><FaStar /> {t('tec.misCalificaciones')}</h2>
          {calificaciones.promedio != null && (
            <span className="ap-badge ok">
              ★ {Number(calificaciones.promedio).toFixed(1)} · {calificaciones.total ?? 0} {calificaciones.total === 1 ? 'calificación' : 'calificaciones'}
            </span>
          )}
        </div>
        {!calificaciones.calificaciones || calificaciones.calificaciones.length === 0 ? (
          <p style={{ margin: 0, color: '#bdbdbd' }}>{t('tec.sinCalificaciones')}</p>
        ) : (
          calificaciones.calificaciones.map((c) => (
            <div key={c.id_calificacion} className="novedad-item">
              <div className="novedad-left">
                <div className="icon-circle"><FaStar /></div>
                <div>
                  <h3>{c.cliente || 'Cliente'}</h3>
                  <p style={{ color: '#ffc94d' }}>
                    {'★'.repeat(Math.min(5, Math.max(1, c.calificacion)))}
                    <span className="muted" style={{ marginLeft: 8 }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES') : ''}
                    </span>
                  </p>
                  {c.comentario ? <p className="muted">{c.comentario}</p> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ap-card" style={{ marginTop: 20 }}>
        <div className="ap-card-head">
          <h2><FaBell /> {t('tec.notificaciones')}</h2>
          {noLeidas > 0 && (
            <button type="button" className="ap-btn ap-btn-ghost" onClick={leerTodas}>
              {t('tec.marcarTodasLeidas')}
            </button>
          )}
        </div>
        {notificaciones.length === 0 ? (
          <p style={{ margin: 0, color: '#bdbdbd' }}>{t('tec.sinNotificaciones')}</p>
        ) : (
          notificaciones.slice(0, 20).map((n) => (
            <div
              key={n.id}
              className={`novedad-item ap-notif-item ${n.leida ? '' : 'unread'}`}
              onClick={() => {
                if (!n.leida) marcarLeida(n.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="novedad-left">
                <div className="icon-circle">{ICONO_TIPO[n.tipo]}</div>
                <div>
                  <h3>
                    {n.titulo}
                    {!n.leida && (
                      <span className="ap-badge pendiente" style={{ marginLeft: 8 }}>
                        {t('tec.nuevaNotificacion')}
                      </span>
                    )}
                  </h3>
                  <p>{n.mensaje}</p>
                  <p className="muted">{n.fecha}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ap-card" style={{ marginTop: 20, borderLeft: '4px solid #d4a54b' }}>
        <p style={{ margin: 0, color: '#dcdcdc', fontSize: '0.9rem' }}>
          <FaBell style={{ marginRight: 8, color: '#d4a54b' }} />
          {t('tec.tienesPendientes', { n: citasProgramadas.length })}
        </p>
      </div>

      {modalOpen && selectedCita && (
        <div className="ap-modal-overlay">
          <div className="ap-modal ap-cita-modal">
            <div className="ap-cita-modal-head">
              <div>
                <h3>{t('tec.detalleCita')}</h3>
                <p className="ap-cita-modal-fecha">
                  <FaCalendarDays />
                  {new Date(`${selectedCita.fecha}T${selectedCita.hora}`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}
                  {selectedCita.hora}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`ap-badge ${ESTADO_BADGE[selectedCita.estado] || 'neutral'}`}>
                  {t(`citas.${selectedCita.estado.toLowerCase()}`)}
                </span>
                <button type="button" className="ap-modal-x" onClick={() => setModalOpen(false)} aria-label="Cerrar">
                  <FaXmark />
                </button>
              </div>
            </div>

            <div className="ap-def-list">
              <div className="ap-def">
                <div className="ap-def-label">{t('tec.cliente')}</div>
                <div className="ap-def-value"><FaUserTie /> {selectedCita.cliente}</div>
              </div>
              <div className="ap-def">
                <div className="ap-def-label">{t('tec.documento')}</div>
                <div className="ap-def-value">
                  <FaIdCard /> {selectedCita.documento_numero ? `${selectedCita.documento_tipo || 'CC'} ${selectedCita.documento_numero}` : t('tec.noRegistrado')}
                </div>
              </div>
              <div className="ap-def">
                <div className="ap-def-label">{t('tec.telefono')}</div>
                <div className="ap-def-value">
                  <FaPhone /> {selectedCita.telefono ? String(selectedCita.telefono) : t('tec.noRegistrado')}
                </div>
              </div>
              <div className="ap-def">
                <div className="ap-def-label">{t('tec.email')}</div>
                <div className="ap-def-value">
                  <FaEnvelope /> {selectedCita.email || t('tec.noRegistrado')}
                </div>
              </div>
              <div className="ap-def full">
                <div className="ap-def-label">{t('tec.direccion')}</div>
                <div className="ap-def-value"><FaLocationDot /> {selectedCita.direccion}</div>
              </div>
              <div className="ap-def full">
                <div className="ap-def-label">{t('tec.servicio')}</div>
                <div className="ap-def-value">
                  <FaScrewdriverWrench style={{ marginRight: 6 }} />
                  {t(TIPO_SERVICIO[selectedCita.tipo_servicio] || 'citas.servicioGeneral')}
                </div>
              </div>
              {selectedCita.descripcion && (
                <div className="ap-def full">
                  <div className="ap-def-label">{t('tec.descripcion')}</div>
                  <div className="ap-def-value">{selectedCita.descripcion}</div>
                </div>
              )}
            </div>

            {selectedCita.calificacion && (
              <div className="ap-cita-calificacion">
                <div className="ap-cita-calificacion-head">
                  <FaStar style={{ color: '#ffc94d' }} />
                  <span>{t('tec.miCalificacion')}</span>
                  <span className="ap-cita-calificacion-estrellas" style={{ color: '#ffc94d' }}>
                    {'★'.repeat(Math.min(5, Math.max(1, selectedCita.calificacion.calificacion)))}
                  </span>
                </div>
                {selectedCita.calificacion.comentario ? (
                  <p>“{selectedCita.calificacion.comentario}”</p>
                ) : (
                  <p className="muted">El cliente no dejó comentario escrito.</p>
                )}
                {selectedCita.calificacion.fecha && (
                  <span className="ap-cita-calificacion-fecha">
                    {new Date(selectedCita.calificacion.fecha).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES')}
                  </span>
                )}
              </div>
            )}

            <div className="ap-evidencia-seccion">
              <div className="ap-evidencia-seccion-head">
                <h4><FaCamera /> {t('tec.evidencias')}</h4>
                {selectedCita.evidencias && selectedCita.evidencias.length > 0 && (
                  <span className="ap-badge ok">{selectedCita.evidencias.length} subida(s)</span>
                )}
              </div>

              {(!selectedCita.evidencias || selectedCita.evidencias.length === 0) && (
                <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  {t('tec.sinEvidencias')}
                </p>
              )}

              {selectedCita.evidencias && selectedCita.evidencias.length > 0 && (
                <div className="ap-evidencias-grid">
                  {selectedCita.evidencias.map((ev) => (
                    <div key={ev.id_evidencia} className="ap-evidencia-thumb">
                      <img src={urlEvidencia(ev.url)} alt={ev.descripcion || 'Evidencia'} />
                      {ev.descripcion && <span className="ap-evidencia-desc">{ev.descripcion}</span>}
                      {selectedCita.estado !== 'Finalizada' && (
                        <button
                          type="button"
                          className="ap-evidencia-borrar"
                          title="Eliminar evidencia"
                          disabled={eliminandoEvidencia === ev.id_evidencia}
                          onClick={() => eliminarEvidencia(selectedCita.id_cita, ev.id_evidencia)}
                        >
                          <FaTrashCan />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedCita.estado !== 'Finalizada' && (
                <div className="ap-evidencia-upload">
                  <input
                    type="text"
                    className="ap-form-input"
                    placeholder={t('tec.descripcionEvidencia')}
                    value={descEvidencia}
                    onChange={(e) => setDescEvidencia(e.target.value)}
                    disabled={subiendoEvidencia}
                  />
                  <label className={`ap-btn ap-btn-primary ${subiendoEvidencia ? 'disabled' : ''}`}>
                    <FaCamera />
                    {subiendoEvidencia ? t('tec.subiendo') : t('tec.subirEvidencia')}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={subiendoEvidencia}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) subirEvidencia(selectedCita.id_cita, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="ap-modal-actions">
              {selectedCita.estado !== 'Finalizada' && (
                <div className="ap-cita-estados">
                  <span className="ap-form-label">{t('tec.cambiarEstado')}</span>
                  <div className="ap-cita-estados-btns">
                    {ESTADOS_TECNICO.map((est) => {
                      const activo = selectedCita.estado === est;
                      const sinEvidencia = est === 'Finalizada' && !(selectedCita.evidencias || []).length;
                      return (
                        <button
                          key={est}
                          type="button"
                          className={`ap-cita-estado-btn ${activo ? 'activo' : ''} ${est === 'Finalizada' ? 'final' : ''} ${est === 'Cancelada' ? 'cancel' : ''}`}
                          disabled={updatingId === selectedCita.id_cita || sinEvidencia}
                          title={sinEvidencia ? t('tec.evidenciaRequerida') : undefined}
                          onClick={() => actualizarEstado(selectedCita.id_cita, est)}
                        >
                          {t(`citas.${est.toLowerCase()}`)}
                        </button>
                      );
                    })}
                  </div>
                  {updatingId === selectedCita.id_cita && (
                    <span className="ap-form-hint">{t('tec.procesando')}</span>
                  )}
                </div>
              )}

              <button type="button" className="ap-btn ap-btn-ghost" onClick={() => setModalOpen(false)}>
                {t('tec.cerrar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {passOpen && (
        <div className="ap-modal-overlay">
          <div className="ap-modal">
            <div className="ap-cita-modal-head">
              <div>
                <h3><FaLock /> {t('tec.cambiarContrasena')}</h3>
              </div>
              <button type="button" className="ap-modal-x" onClick={() => setPassOpen(false)} aria-label="Cerrar">
                <FaXmark />
              </button>
            </div>
            <form onSubmit={guardarContrasena} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="ap-form-group" style={{ margin: 0 }}>
                <label className="ap-form-label" htmlFor="td-pass-nueva">{t('perfil.nuevaContrasena')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="td-pass-nueva"
                    className="ap-form-input"
                    type={passMostrar ? 'text' : 'password'}
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    aria-label={passMostrar ? t('perfil.ocultarContrasena') : t('perfil.mostrarContrasena')}
                    onClick={() => setPassMostrar((v) => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9f9f9f', cursor: 'pointer' }}
                  >
                    {passMostrar ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div className="ap-form-group" style={{ margin: 0 }}>
                <label className="ap-form-label" htmlFor="td-pass-confirmar">{t('perfil.confirmarNuevaContrasena')}</label>
                <input
                  id="td-pass-confirmar"
                  className="ap-form-input"
                  type={passMostrar ? 'text' : 'password'}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {confirmar && nueva !== confirmar && (
                  <span className="ap-form-hint" style={{ color: '#e07a7a' }}>{t('perfil.contrasenasNoCoinciden')}</span>
                )}
              </div>
              <div className="ap-modal-actions">
                <button type="submit" className="ap-btn ap-btn-primary" disabled={passGuardando}>
                  <FaCheck /> {passGuardando ? t('perfil.actualizandoContrasena') : t('perfil.actualizarContrasena')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`ap-toast ${toast.tipo === 'error' ? 'err' : 'ok'}`}>
          {toast.tipo === 'error' ? <FaCircleExclamation /> : <FaCircleCheck />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboard;
