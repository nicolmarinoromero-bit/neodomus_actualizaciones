import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useIdioma } from '@i18n/IdiomaContext';
import {
  FaScrewdriverWrench, FaComment, FaCircleCheck, FaArrowLeft,
  FaExclamation, FaCheck, FaChevronDown, FaCalendarDays, FaList,
  FaClock, FaLocationDot, FaPenToSquare, FaXmark, FaCircleXmark,
  FaUserTie, FaCircleCheck as FaCircleCheckFilled, FaPhone, FaEnvelope,
  FaCreditCard, FaBuildingColumns, FaPaypal, FaMoneyBill, FaMoneyBillWave,
  FaFlask, FaStar, FaMagnifyingGlass,
} from 'react-icons/fa6';
import '@styles/citas.css';
import api from '@services/api';
import { tituloNombre } from '@utils/formatoNombre';
import { PF_REDIRECT_AFTER_LOGIN_KEY } from '@utils/profileStorage';
import { useAuthModal } from '@contexts/AuthModalContext';

const formatoPeso = (value: number) =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

type TipoServicio = 'instalacion' | 'reparacion' | 'mantenimiento' | 'revision' | 'soporte';

interface CitaForm {
  tipo_servicio: TipoServicio | '';
  fecha: string;
  hora: string;
  direccion: string;
  descripcion: string;
}

interface Cita {
  id_cita: number;
  tipo_servicio: string;
  fecha: string;
  hora: string;
  direccion: string;
  descripcion?: string | null;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  id_tecnico_2?: number | null;
  nombre_tecnico_2?: string | null;
  tecnico_2_nombre?: string | null;
  tecnico_2_telefono?: number | null;
  tecnico_telefono?: number | null;
  tecnico_email?: string | null;
  tecnico_foto_url?: string | null;
  calificada?: boolean;
  costo_cita?: number | null;
  metodo_pago?: string | null;
  estado_pago?: string | null;
  estado: 'Pendiente' | 'Confirmada' | 'Finalizada' | 'Cancelada';
}

interface Tarifa {
  tipo_servicio: string;
  costo: number;
}

interface Tecnico {
  id: number;
  nombre: string;
  apellido: string;
  foto_url?: string | null;
  especialidad: string;
  anios_experiencia: number;
  calificacion: number;
  disponible: boolean;
}

interface TecnicoPublico {
  id_tecnico: number;
  first_name: string;
  last_name: string;
  certificacion_t?: string | null;
  cargo_t?: string | null;
  is_active: boolean;
  disponible: boolean;
  telefono?: number | null;
  foto_url?: string | null;
  calificacion?: number | null;
}

const TIPO_TRAD: Record<string, string> = {
  instalacion: 'citas.instalacion',
  mantenimiento: 'citas.mantenimiento',
  reparacion: 'citas.reparacion',
  revision: 'citas.revisionTecnica',
  soporte: 'citas.soporte',
};

const FORM_VACIO: CitaForm = {
  tipo_servicio: '',
  fecha: '',
  hora: '',
  direccion: '',
  descripcion: '',
};

const HORAS_48 = 48 * 60 * 60 * 1000;

const CitasPage = () => {
  const { isAuthenticated } = useAuth();
  const { openAuth } = useAuthModal();
  const { idioma, t } = useIdioma();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [vista, setVista] = useState<'agendar' | 'mis-citas'>('agendar');
  const [form, setForm] = useState<CitaForm>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [citasLoading, setCitasLoading] = useState(false);
  const [confirmarCancelarId, setConfirmarCancelarId] = useState<number | null>(null);
  const [busquedaCitas, setBusquedaCitas] = useState('');
  const [calificandoCita, setCalificandoCita] = useState<Cita | null>(null);
  const [ratingEstrellas, setRatingEstrellas] = useState(0);
  const [ratingComentario, setRatingComentario] = useState('');
  const [enviandoRating, setEnviandoRating] = useState(false);

  const [tecnicoSel, setTecnicoSel] = useState<{ id: number; nombre: string } | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [tecnicosLoading, setTecnicosLoading] = useState(false);

  const [tarifas, setTarifas] = useState<Record<string, number>>({});
  const [bancos, setBancos] = useState<string[]>([]);
  const [metodoPago, setMetodoPago] = useState('');
  const [pago, setPago] = useState({
    numero: '', titular: '', expiracion: '', cvv: '', banco: '', correo_paypal: '', resultado_simulacion: '', punto_pago: '',
  });

  const [deTecnicosPage, setDeTecnicosPage] = useState(false);
  const [direccionPerfil, setDireccionPerfil] = useState('');

  // Autocompletar el campo de dirección con la dirección guardada en el perfil.
  useEffect(() => {
    api
      .get<{ address?: string | null }>('/clients/me')
      .then((res) => {
        const addr = (res.data.address || '').trim();
        setDireccionPerfil(addr);
        if (addr) {
          setForm((prev) => (prev.direccion.trim() ? prev : { ...prev, direccion: addr }));
        }
      })
      .catch(() => undefined);
  }, []);

  const hoy = new Date().toISOString().split('T')[0];

  // Tarifas fijas por servicio y bancos del simulador de pagos.
  useEffect(() => {
    api.get<Tarifa[]>('/tarifas').then((res) => {
      if (Array.isArray(res.data)) {
        const mapa: Record<string, number> = {};
        res.data.forEach((t) => { mapa[t.tipo_servicio] = t.costo; });
        setTarifas(mapa);
      }
    }).catch(() => undefined);
    api.get('/pedidos/metodos-pago').then((res) => {
      if (res.data?.bancos) setBancos(res.data.bancos);
    }).catch(() => undefined);
  }, []);

  // Si el usuario viene desde la página Técnicos, asocia el técnico
  useEffect(() => {
    const idParam = searchParams.get('tecnico');
    const nombreParam = searchParams.get('nombre');
    if (idParam) {
      const id = Number(idParam);
      if (id) {
        setTecnicoSel({ id, nombre: nombreParam ? decodeURIComponent(nombreParam) : '' });
        setDeTecnicosPage(true);
      }
    }
    // Abrir directamente en "Mis citas" (p. ej. desde una notificación)
    if (searchParams.get('vista') === 'mis-citas') {
      setVista('mis-citas');
    }
  }, [searchParams]);

  // Cargar técnicos según servicio/fecha/hora: el backend filtra por
  // especialidad y marca disponibles según las citas registradas.
  useEffect(() => {
    if (vista !== 'agendar') return;
    let activo = true;
    let primera = true;
    const fetchTecnicos = async () => {
      if (primera) {
        setTecnicosLoading(true);
        primera = false;
      }
      try {
        const params = new URLSearchParams();
        if (form.tipo_servicio) params.set('tipo_servicio', form.tipo_servicio);
        if (form.fecha) params.set('fecha', form.fecha);
        if (form.hora) params.set('hora', form.hora);
        const qs = params.toString();
        const res = await api.get<TecnicoPublico[]>(`/tecnicos/publicos${qs ? `?${qs}` : ''}`);
        const data = Array.isArray(res.data) ? res.data : [];
        if (activo) {
          setTecnicos(
            data.map((t) => ({
              id: t.id_tecnico,
              nombre: tituloNombre(t.first_name),
              apellido: tituloNombre(t.last_name),
              foto_url: t.foto_url,
              especialidad: t.certificacion_t || t.cargo_t || '',
              anios_experiencia: 0,
              calificacion: t.calificacion ?? 0,
              disponible: t.disponible && t.is_active,
            })),
          );
          setTecnicoSel((prev) => {
            if (!prev) return prev;
            const sigue = data.some((t) => t.id_tecnico === prev.id && t.disponible && t.is_active);
            return sigue ? prev : null;
          });
        }
      } catch {
        if (activo) setTecnicos([]);
      } finally {
        if (activo) setTecnicosLoading(false);
      }
    };
    fetchTecnicos();
    // Tiempo real: si otro usuario reserva a un técnico en la misma hora,
    // deja de aparecer como disponible sin recargar la página.
    const interval = setInterval(fetchTecnicos, 10000);
    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, [form.tipo_servicio, form.fecha, form.hora, vista]);

  const cargarCitas = useCallback(async () => {
    if (!isAuthenticated) {
      setCitas([]);
      setCitasLoading(false);
      return;
    }
    setCitasLoading(true);
    try {
      const res = await api.get<Cita[]>('/citas/mis-citas');
      setCitas(res.data);
    } catch (err) {
      console.error('Error cargando citas:', err);
    } finally {
      setCitasLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (vista === 'mis-citas') cargarCitas();
  }, [vista, cargarCitas]);

  // Pre-cargar las citas al montar para que el contador de la pestaña
  // "Mis citas" y la lista estén siempre sincronizados con la base de datos.
  useEffect(() => {
    cargarCitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.fecha || vista !== 'agendar') {
      setHorasDisponibles([]);
      return;
    }
    const [año, mes, dia] = (form.fecha || '').split('-').map(Number);
    const diaSemana = año ? new Date(año, mes - 1, dia).getDay() : -1;
    if (diaSemana === 0 || diaSemana === 6) {
      setHorasDisponibles([]);
      return;
    }
    // Franjas de 1 hora (08:00-18:00): el backend devuelve solo las libres.
    const horas: string[] = [];
    for (let h = 8; h <= 18; h++) {
      horas.push(`${h.toString().padStart(2, '0')}:00`);
    }
    let activo = true;
    const cargarHoras = async () => {
      try {
        const params = new URLSearchParams({ fecha: form.fecha });
        if (tecnicoSel?.id) params.set('tecnico_id', String(tecnicoSel.id));
        // Al editar, se excluye la propia cita para que su hora siga visible.
        if (editandoId !== null) params.set('excluir_cita_id', String(editandoId));
        const res = await api.get<string[]>(`/citas/horas-disponibles?${params.toString()}`);
        const libres = Array.isArray(res.data) ? res.data : [];
        const finales = libres.length > 0 ? libres : horas;
        if (!activo) return;
        setHorasDisponibles(finales);
        if (!finales.includes(form.hora)) setForm((prev) => ({ ...prev, hora: '' }));
      } catch {
        if (!activo) return;
        setHorasDisponibles(horas);
        if (!horas.includes(form.hora)) setForm((prev) => ({ ...prev, hora: '' }));
      }
    };
    cargarHoras();
    // Actualización en tiempo real: si otro usuario agenda/edita una cita con
    // este técnico, las horas ocupadas cambian sin recargar la página.
    const interval = setInterval(cargarHoras, 10000);
    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, [form.fecha, tecnicoSel?.id, vista, editandoId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      sessionStorage.setItem(PF_REDIRECT_AFTER_LOGIN_KEY, `/cliente/citas${window.location.search}`);
      openAuth('ingresar');
      return;
    }
    if (!form.tipo_servicio || !form.fecha || !form.hora || !form.direccion.trim() || !form.descripcion.trim()) {
      setToast({ msg: t('citas.errorCampos'), tipo: 'error' });
      return;
    }
    const datosPago: any = {};
    if (editandoId === null) {
      if (!metodoPago) {
        setToast({ msg: t('citas.errorMetodoPago'), tipo: 'error' });
        return;
      }
      if (pago.resultado_simulacion) datosPago.resultado_simulacion = pago.resultado_simulacion;
      if (pago.punto_pago) datosPago.punto_pago = pago.punto_pago;
      if (metodoPago === 'tarjeta_debito' || metodoPago === 'tarjeta_credito') {
        if (!pago.numero || !pago.titular || !pago.expiracion || !pago.cvv) {
          setToast({ msg: t('citas.errorTarjeta'), tipo: 'error' });
          return;
        }
        if (!pago.resultado_simulacion) {
          setToast({ msg: t('citas.errorResultado'), tipo: 'error' });
          return;
        }
        datosPago.numero = pago.numero;
        datosPago.titular = pago.titular;
        datosPago.expiracion = pago.expiracion;
        datosPago.cvv = pago.cvv;
      } else if (metodoPago === 'pse') {
        if (!pago.banco) {
          setToast({ msg: t('citas.errorBanco'), tipo: 'error' });
          return;
        }
        if (!pago.resultado_simulacion) {
          setToast({ msg: t('citas.errorResultado'), tipo: 'error' });
          return;
        }
        datosPago.banco = pago.banco;
        datosPago.titular = pago.titular;
      } else if (metodoPago === 'paypal') {
        if (!pago.correo_paypal) {
          setToast({ msg: t('citas.errorPaypal'), tipo: 'error' });
          return;
        }
        if (!pago.resultado_simulacion) {
          setToast({ msg: t('citas.errorResultado'), tipo: 'error' });
          return;
        }
        datosPago.correo_paypal = pago.correo_paypal;
      } else if (metodoPago === 'punto_pago') {
        if (!pago.punto_pago) {
          setToast({ msg: t('citas.errorPunto'), tipo: 'error' });
          return;
        }
      }
    }
    const payload = {
      ...form,
      id_tecnico: tecnicoSel?.id ?? null,
      nombre_tecnico: tecnicoSel?.nombre ?? null,
      ...(editandoId === null ? { metodo_pago: metodoPago, datos_pago: datosPago } : {}),
    };
    setSubmitting(true);
    try {
      if (editandoId !== null) {
        await api.put(`/citas/${editandoId}`, payload);
        setToast({ msg: t('citas.exitoActualizada'), tipo: 'success' });
        setEditandoId(null);
        setForm(FORM_VACIO);
        setVista('mis-citas');
      } else {
        const res = await api.post('/citas', payload);
        if (res.data?.redirect_url) {
          setSubmitting(false);
          window.location.href = res.data.redirect_url;
          return;
        }
        setToast({ msg: t('citas.exitoAgendada'), tipo: 'success' });
        setForm(prev => ({ ...prev, fecha: '', hora: '', direccion: direccionPerfil, descripcion: '' }));
        setMetodoPago('');
        setPago({ numero: '', titular: '', expiracion: '', cvv: '', banco: '', correo_paypal: '', resultado_simulacion: '', punto_pago: '' });
        setVista('mis-citas');
      }
      cargarCitas();
    } catch (err: any) {
      console.error(err);
      setToast({ msg: err.response?.data?.detail || t('citas.errorGenerico'), tipo: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const iniciarEdicion = (cita: Cita) => {
    setEditandoId(cita.id_cita);
    if (cita.nombre_tecnico) {
      setTecnicoSel({ id: cita.id_tecnico ?? -1, nombre: cita.nombre_tecnico });
    }
    setForm({
      tipo_servicio: cita.tipo_servicio as TipoServicio,
      fecha: cita.fecha,
      hora: cita.hora,
      direccion: cita.direccion,
      descripcion: cita.descripcion || '',
    });
    setVista('agendar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const cancelarCita = async (id: number) => {
    try {
      await api.delete(`/citas/${id}`);
      setToast({ msg: t('citas.exitoCancelada'), tipo: 'success' });
      cargarCitas();
    } catch (err: any) {
      console.error(err);
      setToast({ msg: err.response?.data?.detail || t('citas.errorGenerico'), tipo: 'error' });
    }
    setConfirmarCancelarId(null);
  };

  const enviarCalificacion = async () => {
    if (!calificandoCita) return;
    if (ratingEstrellas < 1 || ratingEstrellas > 5) {
      setToast({ msg: 'Selecciona una calificación de 1 a 5 estrellas', tipo: 'error' });
      return;
    }
    setEnviandoRating(true);
    try {
      await api.post('/calificaciones', {
        id_cita: calificandoCita.id_cita,
        calificacion: ratingEstrellas,
        comentario: ratingComentario.trim() || undefined,
      });
      setToast({ msg: '¡Gracias por calificar al técnico!', tipo: 'success' });
      setCalificandoCita(null);
      setRatingEstrellas(0);
      setRatingComentario('');
      cargarCitas();
    } catch (err: any) {
      console.error(err);
      setToast({ msg: err.response?.data?.detail || 'No se pudo guardar la calificación', tipo: 'error' });
    } finally {
      setEnviandoRating(false);
    }
  };

  const esEditable = (cita: Cita): boolean => {
    if (cita.estado === 'Finalizada' || cita.estado === 'Cancelada') return false;
    const momento = new Date(`${cita.fecha}T${cita.hora}:00`).getTime();
    return momento - Date.now() >= HORAS_48;
  };

  const tiposServicio: { value: TipoServicio; label: string }[] = [
    { value: 'instalacion', label: t('citas.instalacion') },
    { value: 'mantenimiento', label: t('citas.mantenimiento') },
    { value: 'reparacion', label: t('citas.reparacion') },
    { value: 'revision', label: t('citas.revisionTecnica') },
    { value: 'soporte', label: t('citas.soporte') },
  ];

  const formatDate = (dateStr: string) => {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    if (!y || !m || !d) return dateStr || '';
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const fechaLocalHoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const citaCoincide = (cita: Cita, q: string): boolean => {
    if (!q) return true;
    const campos = [
      t(TIPO_TRAD[cita.tipo_servicio] || 'citas.servicioGeneral'),
      formatDate(cita.fecha),
      cita.fecha,
      cita.hora,
      cita.direccion,
      cita.nombre_tecnico || '',
      cita.nombre_tecnico_2 || cita.tecnico_2_nombre || '',
      t(`citas.${cita.estado.toLowerCase()}`),
    ];
    return campos.some((v) => v.toLowerCase().includes(q));
  };

  const renderBarraTecnico = () => (
    <div className="cita-tecnico-banner">
      <span className="cita-tecnico-banner-icon"><FaUserTie /></span>
      <div>
        <span className="cita-tecnico-banner-label">{t('citas.tecnicoAsociado')}</span>
        <strong>{tecnicoSel?.nombre || t('citas.tecnicoAsignado')}</strong>
      </div>
      {!deTecnicosPage && !editandoId && (
        <button
          type="button"
          className="citas-btn citas-btn-ghost"
          onClick={() => setTecnicoSel(null)}
        >
          <FaXmark /> {t('citas.quitar')}
        </button>
      )}
    </div>
  );

  const renderSeleccionTecnicos = () => (
    <div className="citas-card citas-tecnicos-card">
      <div className="citas-card-title">
        <span className="citas-card-icon"><FaUserTie /></span>
        <div className="citas-card-heading">
          <h2>{t('citas.tituloSeleccionTecnico')}</h2>
          <p>{t('citas.subSeleccionTecnico')}</p>
        </div>
      </div>
      {tecnicosLoading ? (
        <p className="citas-hint">{t('citas.cargandoTecnicos')}</p>
      ) : tecnicos.length === 0 ? (
        <div className="citas-tecnicos-vacio">
          <FaExclamation />
          <p>No hay técnicos disponibles para el servicio y horario seleccionados. Prueba con otro tipo de servicio, fecha u hora.</p>
        </div>
      ) : (
        <div className="citas-tecnicos-list">
          {tecnicos.map((tec) => {
            const seleccionado = tecnicoSel?.id === tec.id;
            return (
              <div
                key={tec.id}
                className={`citas-tecnico-item ${seleccionado ? 'selected' : ''} ${tec.disponible ? '' : 'no-disponible'}`}
              >
                <div className="citas-tecnico-top">
                  <img
                    src={tec.foto_url || '/assets/images/perfil.png'}
                    alt={`${tec.nombre} ${tec.apellido}`}
                    className="citas-tecnico-avatar"
                    onError={(e) => (e.currentTarget.src = '/assets/images/perfil.png')}
                  />
                  <div className="citas-tecnico-info">
                    <strong>{tec.nombre} {tec.apellido}</strong>
                    <span className="citas-tecnico-especialidad">{tec.especialidad}</span>
                  </div>
                </div>
                <div className="citas-tecnico-meta">
                  <span className={`citas-tecnico-estado ${tec.disponible ? 'tec-ok' : 'tec-ocu'}`}>
                    {tec.disponible ? t('citas.tecnicoDisponible') : t('citas.tecnicoOcupado')}
                  </span>
                </div>
                <div className="citas-tecnico-actions">
                  <button
                    type="button"
                    className={`citas-btn ${seleccionado ? 'citas-btn-confirmado' : 'citas-btn-ghost'}`}
                    onClick={() =>
                      setTecnicoSel(seleccionado ? null : { id: tec.id, nombre: `${tec.nombre} ${tec.apellido}` })
                    }
                    disabled={!tec.disponible}
                  >
                    {seleccionado ? (
                      <><FaCircleCheckFilled /> {t('citas.tecnicoSeleccionado')}</>
                    ) : tec.disponible ? (
                      <><FaCheck /> {t('citas.seleccionarTecnico')}</>
                    ) : (
                      t('citas.tecnicoNoDisponible')
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderCitaCard = (cita: Cita) => {
    const editable = esEditable(cita);
    return (
      <article key={cita.id_cita} className="cita-card">
                <div className="cita-card-top">
                  <span className="cita-tipo">
                    <FaScrewdriverWrench /> {t(TIPO_TRAD[cita.tipo_servicio] || 'citas.servicioGeneral')}
                  </span>
                  <span className={`cita-estado estado-${cita.estado.toLowerCase()}`}>{t(`citas.${cita.estado.toLowerCase()}`)}</span>
                </div>
                {cita.costo_cita != null && (
                  <div className="cita-pago-row">
                    <span className="cita-dato"><FaMoneyBillWave /> {formatoPeso(cita.costo_cita)}</span>
                    {cita.estado_pago && (
                      <span className={`cita-pago-badge pago-${cita.estado_pago}`}>
                        {t(`citas.estadoPago.${cita.estado_pago}`)}
                      </span>
                    )}
                  </div>
                )}
                <div className="cita-datos">
                  <span className="cita-dato"><FaCalendarDays /> {formatDate(cita.fecha)}</span>
                  <span className="cita-dato"><FaClock /> {cita.hora}</span>
                  <span className="cita-dato"><FaLocationDot /> {cita.direccion}</span>
                  {cita.nombre_tecnico && (
                    <span className="cita-dato">
                      {cita.tecnico_foto_url ? (
                        <img
                          src={cita.tecnico_foto_url}
                          alt={cita.nombre_tecnico}
                          className="cita-tecnico-foto"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : null}
                      <FaUserTie /> {cita.nombre_tecnico}
                    </span>
                  )}
                  {cita.tecnico_telefono != null && (
                    <span className="cita-dato"><FaPhone /> Tel: {cita.tecnico_telefono}</span>
                  )}
                  {cita.tecnico_email && (
                    <span className="cita-dato"><FaEnvelope /> {cita.tecnico_email}</span>
                  )}
                  {(cita.nombre_tecnico_2 || cita.tecnico_2_nombre) && (
                    <span className="cita-dato"><FaUserTie /> {cita.nombre_tecnico_2 || cita.tecnico_2_nombre} (técnico 2)</span>
                  )}
                </div>
                {cita.descripcion && <p className="cita-desc">{cita.descripcion}</p>}
                <div className="cita-actions">
                  {cita.estado === 'Finalizada' && cita.calificada === false && (
                    <button
                      type="button"
                      className="citas-btn citas-btn-primary"
                      onClick={() => {
                        setCalificandoCita(cita);
                        setRatingEstrellas(0);
                        setRatingComentario('');
                      }}
                    >
                      <FaStar /> Calificar técnico (obligatorio)
                    </button>
                  )}
                  {editable ? (
                    <>
                      <button type="button" className="citas-btn citas-btn-ghost" onClick={() => iniciarEdicion(cita)}>
                        <FaPenToSquare /> {t('citas.editar')}
                      </button>
                      {confirmarCancelarId === cita.id_cita ? (
                        <button type="button" className="citas-btn citas-btn-danger" onClick={() => cancelarCita(cita.id_cita)}>
                          <FaCheck /> {t('citas.preguntaCancelar')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="citas-btn citas-btn-danger"
                          onClick={() => {
                            setConfirmarCancelarId(cita.id_cita);
                            setToast(null);
                          }}
                        >
                          <FaXmark /> {t('citas.cancelar')}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="cita-locked">
                      <FaExclamation />{' '}
                      {cita.estado === 'Finalizada' || cita.estado === 'Cancelada'
                        ? t('citas.yaNoModificable')
                        : t('citas.menos48h')}
                    </p>
                  )}
                </div>
              </article>
    );
  };

  const renderMisCitas = () => {
    const q = busquedaCitas.trim().toLowerCase();
    const hoyLocal = fechaLocalHoy();
    const citasDelDia = citas.filter((c) => c.fecha === hoyLocal && citaCoincide(c, q));
    const citasOtras = citas.filter((c) => c.fecha !== hoyLocal && citaCoincide(c, q));
    const hayResultados = citasDelDia.length > 0 || citasOtras.length > 0;
    return (
      <div className="citas-list-wrap">
        {!isAuthenticated ? (
          <div className="citas-empty">
            <FaCircleXmark />
            <p>{t('citas.sinAutenticar')}</p>
          </div>
        ) : citasLoading ? (
          <div className="citas-empty">
            <FaCalendarDays />
            <p>{t('citas.cargandoCitas')}</p>
          </div>
        ) : citas.length === 0 ? (
          <div className="citas-empty">
            <FaCalendarDays />
            <p>{t('citas.vacias')}</p>
            <p className="citas-empty-hint">{t('citas.vaciasHint')}</p>
          </div>
        ) : (
          <>
            <div className="citas-buscar">
              <FaMagnifyingGlass />
              <input
                type="text"
                placeholder={t('citas.buscarPlaceholder')}
                value={busquedaCitas}
                onChange={(e) => setBusquedaCitas(e.target.value)}
              />
            </div>
            {!hayResultados ? (
              <div className="citas-empty">
                <FaMagnifyingGlass />
                <p>{t('citas.sinResultados')}</p>
              </div>
            ) : (
              <div className="citas-list">
                {citasDelDia.length > 0 && (
                  <>
                    <h3 className="citas-seccion-titulo">
                      <FaCalendarDays /> {t('citas.citasDelDia')}
                    </h3>
                    {citasDelDia.map(renderCitaCard)}
                  </>
                )}
                {citasOtras.length > 0 && (
                  <>
                    <h3 className="citas-seccion-titulo">
                      <FaList /> {t('citas.proximas')}
                    </h3>
                    {citasOtras.map(renderCitaCard)}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="citas-page app-glass">
      <main className="citas-main">
        <header className="citas-header">
          <button className="citas-back-btn" onClick={() => navigate('/productos')}>
            <FaArrowLeft /> {t('citas.volverProductos')}
          </button>
          <div className="citas-header-content">
            <h1 className="citas-title">{t('citas.titulo')}</h1>
            <p className="citas-subtitle">
              {t('citas.subtituloNeodomus')}
            </p>
          </div>
        </header>

        <div className="citas-tabs" role="tablist" aria-label={t('citas.seccionesLabel')}>
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'agendar'}
            className={`citas-tab-btn ${vista === 'agendar' ? 'active' : ''}`}
            onClick={() => setVista('agendar')}
          >
            <FaCalendarDays /> {t('citas.tabNueva')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'mis-citas'}
            className={`citas-tab-btn ${vista === 'mis-citas' ? 'active' : ''}`}
            onClick={() => setVista('mis-citas')}
          >
            <FaList /> {t('citas.tabMis')}
            {citas.length > 0 && <span className="citas-tab-count">{citas.length}</span>}
          </button>
        </div>

        {vista === 'mis-citas' ? (
          renderMisCitas()
        ) : (
          <form onSubmit={handleSubmit} className="citas-form" noValidate>
            {editandoId !== null && (
              <div className="citas-editando">
                <FaPenToSquare />
                <span>{t('citas.editandoCita', { id: editandoId })}</span>
                <button type="button" className="citas-btn citas-btn-ghost" onClick={cancelarEdicion}>
                  <FaXmark /> {t('citas.cancelarEdicion')}
                </button>
              </div>
            )}

            {tecnicoSel !== null && renderBarraTecnico()}

            {/* Tarjeta: detalles del servicio */}
            <div className="citas-card">
              <div className="citas-card-title">
                <span className="citas-card-icon"><FaScrewdriverWrench /></span>
                <div className="citas-card-heading">
                  <h2>{t('citas.detalleServicio')}</h2>
                  <p>{t('citas.detalleServicioSub')}</p>
                </div>
              </div>

              <div className="citas-grid">
                <div className="citas-field">
                  <label className="citas-label" htmlFor="citas-tipo">{t('citas.tipoServicioLabel')}</label>
                  <div className="citas-select-wrap">
                    <select
                      id="citas-tipo"
                      name="tipo_servicio"
                      value={form.tipo_servicio}
                      onChange={handleChange}
                      className="citas-select"
                      required
                      aria-required="true"
                    >
<option value="" disabled>{t('citas.seleccionaTipoServicio')}</option>
                      {tiposServicio.map(tipo => (
                        <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                      ))}
                    </select>
                    <FaChevronDown className="citas-select-chevron" />
                  </div>
                  {form.tipo_servicio && tarifas[form.tipo_servicio] != null && (
                    <p className="citas-hint citas-tarifa">
                      <FaMoneyBillWave /> {t('citas.tarifaServicio')}: <strong>{formatoPeso(tarifas[form.tipo_servicio])}</strong>
                    </p>
                  )}
                </div>

                <div className="citas-field">
                  <label className="citas-label" htmlFor="citas-fecha">{t('citas.fechaCita')}</label>
                  <input
                    type="date"
                    id="citas-fecha"
                    name="fecha"
                    value={form.fecha}
                    onChange={handleChange}
                    min={hoy}
                    className="citas-input"
                    required
                    aria-required="true"
                  />
                  {form.fecha && (
                    <p className="citas-selected-date">
                      <FaCheck /> {formatDate(form.fecha)}
                    </p>
                  )}
                  <p className="citas-hint">{t('citas.horarioLunVie')}</p>
                </div>

                <div className="citas-field">
                  <label className="citas-label" htmlFor="citas-hora">{t('citas.horaCita')}</label>
                  {form.fecha && horasDisponibles.length === 0 ? (
                    <div className="citas-no-horas">
                      <FaExclamation /> {t('citas.noHorarios')}
                    </div>
                  ) : (
                    <div className="citas-horas-grid" role="radiogroup" aria-label={t('citas.horaCita')}>
                      {horasDisponibles.map((hora) => (
                        <button
                          key={hora}
                          type="button"
                          className={`citas-hora-btn ${form.hora === hora ? 'selected' : ''}`}
                          onClick={() => setForm(prev => ({ ...prev, hora }))}
                        >
                          {hora}
                        </button>
                      ))}
                    </div>
                  )}
                  {!form.fecha && <p className="citas-hint">{t('citas.eligeFechaHoras')}</p>}
                </div>

                <div className="citas-field">
                  <label className="citas-label" htmlFor="citas-direccion">{t('citas.direccionServicio')}</label>
                  <input
                    type="text"
                    id="citas-direccion"
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    className="citas-input"
                    required
                    aria-required="true"
                    placeholder={t('citas.placeholderDireccion')}
                  />
                  <p className="citas-hint">{t('citas.lugarServicio')}</p>
                </div>
              </div>
            </div>

            {/* Tarjeta: descripción */}
            <div className="citas-card">
              <div className="citas-card-title">
                <span className="citas-card-icon"><FaComment /></span>
                <div className="citas-card-heading">
                  <h2>{t('citas.describeSolicitud')}</h2>
                  <p>{t('citas.describeSolicitudSub')}</p>
                </div>
              </div>

              <div className="citas-grid">
                <div className="citas-field citas-field-full">
                  <label className="citas-label" htmlFor="citas-descripcion">{t('citas.descripcionLabel')}</label>
                  <div className="citas-textarea-wrap">
                    <textarea
                      id="citas-descripcion"
                      name="descripcion"
                      value={form.descripcion}
                      onChange={handleChange}
                      className="citas-textarea"
                      rows={5}
                      placeholder={t('citas.placeholderDescripcion')}
                      required
                      aria-required="true"
                    />
                    <span className="citas-char-count">{form.descripcion.length} / 500</span>
                  </div>
                  <p className="citas-hint">{t('citas.descripcionHint')}</p>
                </div>
              </div>
            </div>

            {/* Solo si el usuario entró directo a Citas (sin técnico preseleccionado) */}
            {tecnicoSel === null && !editandoId && renderSeleccionTecnicos()}

            {/* Tarjeta: pago de la cita (solo al agendar, no al editar) */}
            {editandoId === null && (
              <div className="citas-card">
                <div className="citas-card-title">
                  <span className="citas-card-icon"><FaCreditCard /></span>
                  <div className="citas-card-heading">
                    <h2>{t('citas.tituloPago')}</h2>
                    <p>{t('citas.subPago')}</p>
                  </div>
                </div>

                {form.tipo_servicio && tarifas[form.tipo_servicio] != null && (
                  <div className="citas-pago-total">
                    <span>{t('citas.totalAPagar')}</span>
                    <strong>{formatoPeso(tarifas[form.tipo_servicio])}</strong>
                  </div>
                )}

                <div className="citas-modo-banner">
                  <FaFlask />
                  {t('citas.modoSimulador')}
                </div>

                <div className="citas-metodos">
                  {[
                    { codigo: 'tarjeta_debito', nombre: t('citas.tarjetaDebito'), icono: FaCreditCard },
                    { codigo: 'tarjeta_credito', nombre: t('citas.tarjetaCredito'), icono: FaCreditCard },
                    { codigo: 'pse', nombre: 'PSE', icono: FaBuildingColumns },
                    { codigo: 'paypal', nombre: 'PayPal', icono: FaPaypal },
                    { codigo: 'punto_pago', nombre: t('citas.puntoPago'), icono: FaMoneyBill },
                  ]
                    .map((m) => {
                    const Icono = m.icono;
                    return (
                      <button
                        key={m.codigo}
                        type="button"
                        className={`citas-metodo-btn ${metodoPago === m.codigo ? 'selected' : ''}`}
                        onClick={() => setMetodoPago(m.codigo)}
                      >
                        <Icono /> {m.nombre}
                      </button>
                    );
                  })}
                </div>

                <div className="citas-grid">
                  {(metodoPago === 'tarjeta_debito' || metodoPago === 'tarjeta_credito') && (
                    <>
                      <div className="citas-field">
                        <label className="citas-label">{t('citas.numeroTarjeta')}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="citas-input"
                          placeholder="4242 4242 4242 4242"
                          value={pago.numero}
                          onChange={(e) => setPago({ ...pago, numero: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                      <div className="citas-field">
                        <label className="citas-label">{t('citas.titularTarjeta')}</label>
                        <input
                          type="text"
                          className="citas-input"
                          placeholder={t('citas.placeholderTitular')}
                          value={pago.titular}
                          onChange={(e) => setPago({ ...pago, titular: e.target.value })}
                        />
                      </div>
                      <div className="citas-field">
                        <label className="citas-label">{t('citas.expiracion')}</label>
                        <input
                          type="text"
                          className="citas-input"
                          placeholder="MM/AA"
                          value={pago.expiracion}
                          onChange={(e) => setPago({ ...pago, expiracion: e.target.value.replace(/[^\d/]/g, '') })}
                        />
                      </div>
                      <div className="citas-field">
                        <label className="citas-label">CVV</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="citas-input"
                          placeholder="123"
                          value={pago.cvv}
                          onChange={(e) => setPago({ ...pago, cvv: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                      <div className="citas-field citas-field-full">
                        <p className="citas-hint">
                          {t('citas.tarjetasPrueba')}: 4242 4242 4242 4242 ({t('citas.aprobada')}) · 4242 4242 4242 0001 ({t('citas.rechazada')})
                        </p>
                      </div>
                    </>
                  )}
                  {(metodoPago === 'tarjeta_debito' || metodoPago === 'tarjeta_credito' || metodoPago === 'pse' || metodoPago === 'paypal') && (
                    <div className="citas-field citas-field-full">
                      <label className="citas-label">{t('citas.resultadoSimulacion')}</label>
                      <div className="citas-select-wrap">
                        <select
                          className="citas-select"
                          value={pago.resultado_simulacion}
                          onChange={(e) => setPago({ ...pago, resultado_simulacion: e.target.value })}
                        >
                          <option value="">{t('citas.seleccionaResultado')}</option>
                          <option value="aprobado">{t('citas.aprobadoSim')}</option>
                          <option value="rechazado">{t('citas.rechazadoSim')}</option>
                          {metodoPago === 'pse' && <option value="pendiente">{t('citas.pendienteSim')}</option>}
                        </select>
                        <FaChevronDown className="citas-select-chevron" />
                      </div>
                      <p className="citas-hint">{t('citas.hintSimulacion')}</p>
                    </div>
                  )}
                  {metodoPago === 'pse' && (
                    <>
                      <div className="citas-field">
                        <label className="citas-label">{t('citas.banco')}</label>
                        <select
                          className="citas-select"
                          value={pago.banco}
                          onChange={(e) => setPago({ ...pago, banco: e.target.value })}
                        >
                          <option value="">{t('citas.seleccionaBanco')}</option>
                          {(bancos.length ? bancos : ['Bancolombia', 'Banco de Bogotá', 'Banco Davivienda']).map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div className="citas-field">
                        <label className="citas-label">{t('citas.titularCuenta')}</label>
                        <input
                          type="text"
                          className="citas-input"
                          value={pago.titular}
                          onChange={(e) => setPago({ ...pago, titular: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  {metodoPago === 'paypal' && (
                    <div className="citas-field">
                      <label className="citas-label">PayPal</label>
                      <input
                        type="email"
                        className="citas-input"
                        placeholder="tucorreo@ejemplo.com"
                        value={pago.correo_paypal}
                        onChange={(e) => setPago({ ...pago, correo_paypal: e.target.value })}
                      />
                    </div>
                  )}
                  {metodoPago === 'punto_pago' && (
                    <div className="citas-field citas-field-full">
                      <label className="citas-label">{t('citas.puntoPago')}</label>
                      <div className="citas-select-wrap">
                        <select
                          className="citas-select"
                          value={pago.punto_pago}
                          onChange={(e) => setPago({ ...pago, punto_pago: e.target.value })}
                        >
                          <option value="">{t('citas.seleccionaPunto')}</option>
                          <option value="Efecty">Efecty</option>
                          <option value="Servientrega">Servientrega</option>
                          <option value="Otro punto de pago">{t('citas.otroPunto')}</option>
                        </select>
                        <FaChevronDown className="citas-select-chevron" />
                      </div>
                      <p className="citas-hint">{t('citas.hintPuntoPago')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="citas-form-actions">
              <button type="button" className="citas-btn citas-btn-ghost" onClick={() => navigate('/productos')}>
                <FaArrowLeft /> {t('common.cancelar')}
              </button>
              <button type="submit" className="citas-btn citas-btn-primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <FaCircleCheck style={{ animation: 'spin 1s linear infinite' }} /> {editandoId !== null ? t('citas.guardando') : t('citas.agendando')}
                  </>
                ) : (
                  <>
                    <FaCircleCheck /> {editandoId !== null ? t('citas.guardarCambios') : t('citas.agendar')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {calificandoCita && (
          <div className="citas-modal-overlay">
            <div className="citas-modal" onClick={(e) => e.stopPropagation()}>
              <h3><FaStar /> Califica al técnico</h3>
              <p className="citas-modal-sub">
                {calificandoCita.nombre_tecnico || 'Técnico'} · {calificandoCita.tipo_servicio}
              </p>
              <div className="citas-rating-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`citas-rating-star ${n <= ratingEstrellas ? 'active' : ''}`}
                    onClick={() => setRatingEstrellas(n)}
                    aria-label={`${n} estrellas`}
                  >
                    <FaStar />
                  </button>
                ))}
              </div>
              <p className="citas-hint">Esta calificación es obligatoria para poder agendar una nueva cita.</p>
              <textarea
                className="citas-textarea"
                rows={4}
                placeholder="Comentario (opcional)..."
                value={ratingComentario}
                onChange={(e) => setRatingComentario(e.target.value)}
                maxLength={500}
              />
              <div className="citas-modal-actions">
                <button
                  type="button"
                  className="citas-btn citas-btn-ghost"
                  disabled={enviandoRating}
                  onClick={() => setCalificandoCita(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="citas-btn citas-btn-primary"
                  disabled={enviandoRating}
                  onClick={enviarCalificacion}
                >
                  {enviandoRating ? <><FaCircleCheck style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</> : <><FaStar /> Enviar calificación</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`citas-toast ${toast.tipo}`}>
            {toast.tipo === 'success' ? <FaCircleCheck /> : <FaExclamation />}
            <span>{toast.msg}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default CitasPage;