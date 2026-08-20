import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaCalendarCheck,
  FaCircleInfo,
  FaTriangleExclamation,
  FaCircleCheck,
  FaMoneyBillWave,
  FaMagnifyingGlass,
  FaClockRotateLeft,
  FaCalendarPlus,
} from 'react-icons/fa6';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';
import api from '@services/api';
import type { CitaAdmin, TecnicoAdmin, TarifaServicio } from '../../types';
import { nombreCompleto } from '@utils/formatoNombre';
import { useIdioma } from '@i18n/IdiomaContext';

interface TecnicoDisp {
  id_tecnico: number;
  id_usuario: number;
  nombre: string;
  email: string;
  certificacion_t?: string | null;
  cargo_t?: string | null;
}

interface SugerenciaAplazar {
  id_cita: number;
  fecha: string;
  hora: string;
  id_tecnico: number;
  nombre_tecnico: string;
}

const ESTADOS = ['Pendiente', 'Confirmada', 'Finalizada', 'Cancelada'];

const CLASE_ESTADO: Record<string, string> = {
  Pendiente: 'warn',
  Confirmada: 'info',
  Finalizada: 'ok',
  Cancelada: 'err',
};

const CLASE_PAGO: Record<string, string> = {
  aprobado: 'ok',
  pagado: 'ok',
  pendiente: 'warn',
  rechazado: 'err',
};

const ESTADO_TRAD: Record<string, string> = {
  Pendiente: 'adm.instalaciones.estadoPendiente',
  Confirmada: 'adm.instalaciones.estadoConfirmada',
  Finalizada: 'adm.instalaciones.estadoFinalizada',
  Cancelada: 'adm.instalaciones.estadoCancelada',
};

const ESTADO_PAGO_TRAD: Record<string, string> = {
  aprobado: 'adm.instalaciones.pagoAprobado',
  pagado: 'adm.instalaciones.pagoPagado',
  pendiente: 'adm.instalaciones.pagoPendiente',
  rechazado: 'adm.instalaciones.pagoRechazado',
};

const formatoPeso = (value: number) =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const NOMBRE_SERVICIO: Record<string, string> = {
  instalacion: 'adm.instalaciones.servicio.Instalación',
  mantenimiento: 'adm.instalaciones.servicio.Mantenimiento',
  reparacion: 'adm.instalaciones.servicio.Reparación',
  revision: 'adm.instalaciones.servicio.Revisión técnica',
  soporte: 'adm.instalaciones.servicio.Soporte técnico',
};

const AdminInstalaciones = () => {
  const { idioma, t } = useIdioma();
  const [citas, setCitas] = useState<CitaAdmin[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoAdmin[]>([]);
  const [tarifas, setTarifas] = useState<TarifaServicio[]>([]);
  const [edicionTarifas, setEdicionTarifas] = useState<Record<string, string>>({});
  const [guardandoTarifa, setGuardandoTarifa] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [edicionComision, setEdicionComision] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [disponibles, setDisponibles] = useState<Record<number, TecnicoDisp[]>>({});
  const [aplazandoId, setAplazandoId] = useState<number | null>(null);
  const [sugerencia, setSugerencia] = useState<SugerenciaAplazar | null>(null);

  const POR_PAGINA = 6;

  const cargar = async () => {
    setCargando(true);
    setError(false);
    try {
      const [res, resT, resTar] = await Promise.all([
        api.get<CitaAdmin[]>('/citas/all-admin'),
        api.get<TecnicoAdmin[]>('/tecnicos'),
        api.get<TarifaServicio[]>('/tarifas'),
      ]);
      setCitas(res.data || []);
      setTecnicos(resT.data || []);
      setTarifas(resTar.data || []);
      const activas = (res.data || []).filter((c) => c.estado === 'Pendiente' || c.estado === 'Confirmada');
      const mapa: Record<number, TecnicoDisp[]> = {};
      await Promise.all(
        activas.map(async (c) => {
          try {
            const rd = await api.get<TecnicoDisp[]>(`/citas/admin/${c.id_cita}/tecnicos-disponibles`);
            mapa[c.id_cita] = rd.data || [];
          } catch {
            mapa[c.id_cita] = [];
          }
        }),
      );
      setDisponibles(mapa);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    window.setTimeout(() => setToast(null), 3200);
  };

  const guardarTarifa = async (tipo: string) => {
    const valor = Number((edicionTarifas[tipo] ?? '').replace(/\./g, '').replace(',', '.'));
    if (!valor || valor <= 0) {
      notify(t('adm.instalaciones.errorCostoCero'), 'err');
      return;
    }
    setGuardandoTarifa(tipo);
    try {
      const res = await api.put<TarifaServicio>(`/tarifas/${tipo}`, { costo: valor });
      setTarifas((prev) => prev.map((t) => (t.tipo_servicio === tipo ? res.data : t)));
      setEdicionTarifas((prev) => {
        const copia = { ...prev };
        delete copia[tipo];
        return copia;
      });
      notify(t('adm.instalaciones.tarifaActualizada'));
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.errorActualizarTarifa'), 'err');
    } finally {
      setGuardandoTarifa(null);
    }
  };

  const actualizar = async (
    cita: CitaAdmin,
    cambios: {
      estado?: string;
      id_tecnico?: number | null;
      id_tecnico_2?: number | null;
      id_comision_c?: number | null;
      comision_porcentaje?: number;
      comision_valor?: number;
    },
  ) => {
    setGuardandoId(cita.id_cita);
    try {
      const payload: Record<string, unknown> = {};
      if (cambios.estado !== undefined) payload.estado = cambios.estado;
      if (cambios.id_tecnico !== undefined) {
        payload.id_tecnico = cambios.id_tecnico;
        const t = tecnicos.find((x) => x.id_tecnico === cambios.id_tecnico);
        payload.nombre_tecnico = t ? nombreCompleto(t.first_name, t.last_name) : null;
      }
      if (cambios.id_tecnico_2 !== undefined) {
        payload.id_tecnico_2 = cambios.id_tecnico_2;
        const t = tecnicos.find((x) => x.id_tecnico === cambios.id_tecnico_2);
        payload.nombre_tecnico_2 = t ? nombreCompleto(t.first_name, t.last_name) : null;
      }
      if (cambios.comision_porcentaje !== undefined) payload.comision_porcentaje = cambios.comision_porcentaje;
      if (cambios.comision_valor !== undefined) payload.comision_valor = cambios.comision_valor;
      if (cambios.id_comision_c !== undefined) payload.id_comision_c = cambios.id_comision_c;
      const res = await api.put<CitaAdmin>(`/citas/admin/${cita.id_cita}`, payload);
      setCitas((prev) => prev.map((c) => (c.id_cita === cita.id_cita ? res.data : c)));
      setEdicionComision((prev) => {
        const copia = { ...prev };
        delete copia[cita.id_cita];
        return copia;
      });
      notify(
        cambios.id_comision_c === null
          ? t('adm.instalaciones.comisionRetirada')
          : t('adm.instalaciones.comisionAplicada'),
      );
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.errorActualizarCita'), 'err');
    } finally {
      setGuardandoId(null);
    }
  };

  const estaInactivo = (cita: CitaAdmin) => {
    if (cita.id_tecnico == null) return false;
    const t = tecnicos.find((x) => x.id_tecnico === cita.id_tecnico);
    return !!t && !t.is_active;
  };

  const reasignar = async (cita: CitaAdmin, idTecnico: number) => {
    setGuardandoId(cita.id_cita);
    try {
      const res = await api.post<CitaAdmin>(`/citas/admin/${cita.id_cita}/reasignar`, {
        id_tecnico: idTecnico,
      });
      setCitas((prev) => prev.map((c) => (c.id_cita === cita.id_cita ? res.data : c)));
      notify(t('adm.instalaciones.reasignada'));
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.errorReasignar'), 'err');
    } finally {
      setGuardandoId(null);
    }
  };

  const sugerirAplazamiento = async (cita: CitaAdmin) => {
    setAplazandoId(cita.id_cita);
    setSugerencia(null);
    try {
      const res = await api.get<Omit<SugerenciaAplazar, 'id_cita'>>(
        `/citas/admin/${cita.id_cita}/proxima-fecha`,
      );
      setSugerencia({ id_cita: cita.id_cita, ...res.data });
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.sinFechaDisponible'), 'err');
    } finally {
      setAplazandoId(null);
    }
  };

  const confirmarAplazamiento = async () => {
    if (!sugerencia) return;
    setGuardandoId(sugerencia.id_cita);
    try {
      const res = await api.post<CitaAdmin>(`/citas/admin/${sugerencia.id_cita}/reasignar`, {
        id_tecnico: sugerencia.id_tecnico,
        fecha: sugerencia.fecha,
        hora: sugerencia.hora,
      });
      setCitas((prev) => prev.map((c) => (c.id_cita === sugerencia.id_cita ? res.data : c)));
      setSugerencia(null);
      notify(t('adm.instalaciones.reasignada'));
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.errorReasignar'), 'err');
    } finally {
      setGuardandoId(null);
    }
  };

  const guardarComision = async (cita: CitaAdmin) => {
    const pct = Number((edicionComision[cita.id_cita] ?? '').replace(',', '.'));
    if (!pct || pct <= 0) {
      notify(t('adm.instalaciones.errorPorcentajeCero'), 'err');
      return;
    }
    await actualizar(cita, { comision_porcentaje: pct });
  };

  const q = busqueda.trim().toLowerCase();
  const filtradas = citas.filter((c) => {
    if (filtro !== 'todas' && c.estado !== filtro) return false;
    if (!q) return true;
    return `${c.cliente_nombre || ''} ${c.cliente_email || ''} ${c.tipo_servicio || ''} ${c.nombre_tecnico || ''} ${c.nombre_tecnico_2 || ''} ${c.direccion || ''} ${c.descripcion || ''} ${c.estado_pago || ''} ${c.metodo_pago || ''} ${c.numero_transaccion || ''}`
      .toLowerCase()
      .includes(q);
  });
  const contadores = ESTADOS.reduce<Record<string, number>>((acc, e) => {
    acc[e] = citas.filter((c) => c.estado === e).length;
    return acc;
  }, {});

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const citasPagina = filtradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  const formatTecnico = (t: TecnicoAdmin) => `${t.first_name || ''} ${t.last_name || ''}`.trim().toUpperCase();

  const formatFecha = (f: string) => {
    try {
      return new Date(`${f}T00:00:00`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return f;
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
          <h1 className="ap-title">{t('adm.instalaciones.titulo')}</h1>
          <p className="ap-subtitle">
            {citas.length > 0
              ? t('adm.instalaciones.subtituloConteo', { n: citas.length })
              : t('adm.instalaciones.subtituloVacio')}
          </p>
        </div>
      </div>

      <div className="ap-pills">
        <button
          type="button"
          className={`ap-pill ${filtro === 'todas' ? 'active' : ''}`}
          onClick={() => {
            setFiltro('todas');
            setPagina(1);
          }}
        >
          {t('adm.instalaciones.todas')} <span className="ap-pill-count">{citas.length}</span>
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            className={`ap-pill ${filtro === e ? 'active' : ''}`}
            onClick={() => {
              setFiltro(e);
              setPagina(1);
            }}
          >
            {t(ESTADO_TRAD[e] || e)} <span className="ap-pill-count">{contadores[e] || 0}</span>
          </button>
        ))}
      </div>

      <div className="ap-toolbar" style={{ marginBottom: 16 }}>
        <form className="ap-search" onSubmit={(e) => e.preventDefault()}>
          <FaMagnifyingGlass />
          <input
            type="text"
            placeholder={t('adm.instalaciones.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </form>
      </div>

      {cargando ? (
        <div className="ap-card">
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('adm.instalaciones.cargando')}</h3>
            <p>{t('adm.instalaciones.cargandoDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="ap-card ap-tarifas-card">
          <div className="ap-card-head">
            <h3><FaMoneyBillWave /> {t('adm.instalaciones.tarifasTitulo')}</h3>
            <p>{t('adm.instalaciones.tarifasDesc')}</p>
          </div>
          <div className="ap-tarifas-grid">
            {tarifas.map((tar) => (
              <div className="ap-tarifa-item" key={tar.tipo_servicio}>
                <span className="ap-tarifa-nombre">
                  {t(NOMBRE_SERVICIO[tar.tipo_servicio] || tar.tipo_servicio)}
                </span>
                {edicionTarifas[tar.tipo_servicio] !== undefined ? (
                  <div className="ap-tarifa-editar">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="ap-form-input"
                      value={edicionTarifas[tar.tipo_servicio]}
                      onChange={(e) =>
                        setEdicionTarifas((prev) => ({ ...prev, [tar.tipo_servicio]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarTarifa(tar.tipo_servicio);
                        if (e.key === 'Escape') {
                          setEdicionTarifas((prev) => {
                            const copia = { ...prev };
                            delete copia[tar.tipo_servicio];
                            return copia;
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ap-btn ap-btn-primary"
                      disabled={guardandoTarifa === tar.tipo_servicio}
                      onClick={() => guardarTarifa(tar.tipo_servicio)}
                    >
                      {t('adm.instalaciones.guardar')}
                    </button>
                  </div>
                ) : (
                  <div className="ap-tarifa-valor">
                    <strong>{formatoPeso(tar.costo)}</strong>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost"
                      onClick={() => setEdicionTarifas((prev) => ({ ...prev, [tar.tipo_servicio]: String(tar.costo) }))}
                    >
                      {t('adm.instalaciones.editar')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="ap-card">
          <div className="ap-states error">
            <div className="ap-states-icon">
              <FaCircleInfo />
            </div>
            <h3>{t('adm.instalaciones.errorTitulo')}</h3>
            <p>{t('adm.instalaciones.errorDesc')}</p>
            <button type="button" className="ap-btn ap-btn-ghost" onClick={cargar}>
              {t('adm.instalaciones.reintentar')}
            </button>
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="ap-card">
          <div className="ap-states">
            <div className="ap-states-icon">
              <FaCalendarCheck />
            </div>
            <h3>
              {q
                ? t('adm.instalaciones.sinResultados')
                : filtro === 'todas'
                  ? t('adm.instalaciones.noHayCitas')
                  : t('adm.instalaciones.sinCitasEstado', { estado: t(ESTADO_TRAD[filtro] || filtro) })}
            </h3>
            <p>
              {q
                ? t('adm.instalaciones.sinResultadosDetalle')
                : filtro === 'todas'
                  ? t('adm.instalaciones.noHayCitasDetalle')
                  : t('adm.instalaciones.sinCitasEstadoDetalle', { estado: t(ESTADO_TRAD[filtro] || filtro) })}
            </p>
          </div>
        </div>
      ) : (
        <div className="ap-grid">
          {citasPagina.map((cita) => (
            <div className="ap-grid-item" key={cita.id_cita}>
              <div className="ap-grid-item-top">
                <span className="ap-initials">
                  {(cita.cliente_nombre || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className={`ap-badge ${CLASE_ESTADO[cita.estado] || 'neutral'}`}>{t(ESTADO_TRAD[cita.estado] || cita.estado)}</span>
              </div>
              <div>
                <h3>{cita.cliente_nombre || t('adm.instalaciones.cliente')}</h3>
                <p>{cita.cliente_email}</p>
              </div>

              <div className="ap-def-list" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.instalaciones.colServicio')}</div>
                  <div className="ap-def-value">{t(NOMBRE_SERVICIO[cita.tipo_servicio] || cita.tipo_servicio)}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.instalaciones.colFecha')}</div>
                  <div className="ap-def-value">{formatFecha(cita.fecha)}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.instalaciones.colHora')}</div>
                  <div className="ap-def-value">{cita.hora}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.instalaciones.colPago')}</div>
                  <div className="ap-def-value">
                    {cita.costo_cita != null ? formatoPeso(cita.costo_cita) : '—'}
                    {cita.estado_pago && (
                      <span
                        className={`ap-badge ${CLASE_PAGO[cita.estado_pago] || 'neutral'}`}
                        style={{ marginLeft: 8 }}
                      >
                        {t(ESTADO_PAGO_TRAD[cita.estado_pago] || cita.estado_pago)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.instalaciones.colComision')}</div>
                  <div className="ap-def-value">
                    {cita.comision_valor != null ? (
                      <>
                        <span className="ap-badge ok">
                          {cita.comision_porcentaje != null ? `${cita.comision_porcentaje}%` : t('adm.instalaciones.comision')}
                        </span>
                        <span style={{ marginLeft: 6 }}>
                          {formatoPeso(cita.comision_valor)}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                {cita.metodo_pago && (
                  <div className="ap-def">
                    <div className="ap-def-label">{t('adm.instalaciones.colMetodo')}</div>
                    <div className="ap-def-value" style={{ fontSize: '0.8rem' }}>
                      {cita.metodo_pago.replace(/_/g, ' ')}
                    </div>
                  </div>
                )}
                {cita.numero_transaccion && (
                  <div className="ap-def">
                    <div className="ap-def-label">{t('adm.instalaciones.colTransaccion')}</div>
                    <div className="ap-def-value" style={{ fontSize: '0.78rem' }}>
                      {cita.numero_transaccion}
                    </div>
                  </div>
                )}
                <div className="ap-def full">
                  <div className="ap-def-label">{t('adm.instalaciones.colDireccion')}</div>
                  <div className="ap-def-value" style={{ fontSize: '0.82rem' }}>
                    {cita.direccion}
                  </div>
                </div>
                {cita.descripcion && (
                  <div className="ap-def full">
                    <div className="ap-def-label">{t('adm.instalaciones.colDescripcion')}</div>
                    <div className="ap-def-value" style={{ fontSize: '0.82rem' }}>
                      {cita.descripcion}
                    </div>
                  </div>
                )}
              </div>

              {estaInactivo(cita) && (
                <div className="ap-reasignar-aviso" style={{ marginTop: 12 }}>
                  <FaTriangleExclamation />
                  <div>
                    <strong>{t('adm.instalaciones.reasignarAvisoTitulo')}</strong>
                    <span>
                      {t('adm.instalaciones.reasignarAviso', {
                        tecnico: cita.nombre_tecnico || 'Técnico',
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ap-btn ap-btn-ghost"
                    disabled={aplazandoId === cita.id_cita || guardandoId === cita.id_cita}
                    onClick={() => sugerirAplazamiento(cita)}
                  >
                    <FaClockRotateLeft /> {t('adm.instalaciones.aplazar')}
                  </button>
                </div>
              )}

              {sugerencia && sugerencia.id_cita === cita.id_cita && (
                <div className="ap-reasignar-sugerencia" style={{ marginTop: 12 }}>
                  <FaCalendarPlus />
                  <div>
                    <strong>{t('adm.instalaciones.sugerenciaTitulo')}</strong>
                    <span>
                      {t('adm.instalaciones.sugerencia', {
                        fecha: formatFecha(sugerencia.fecha),
                        hora: sugerencia.hora,
                        tecnico: sugerencia.nombre_tecnico,
                      })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="ap-btn ap-btn-primary"
                      disabled={guardandoId === cita.id_cita}
                      onClick={confirmarAplazamiento}
                    >
                      {guardandoId === cita.id_cita
                        ? t('adm.instalaciones.aplicando')
                        : t('adm.instalaciones.confirmarAplazar')}
                    </button>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost"
                      disabled={guardandoId === cita.id_cita}
                      onClick={() => setSugerencia(null)}
                    >
                      {t('adm.instalaciones.cancelar')}
                    </button>
                  </div>
                </div>
              )}

              <div className="ap-form-grid" style={{ marginTop: 8 }}>
                <div className="ap-form-group">
                  <label className="ap-form-label">{t('adm.instalaciones.estadoLabel')}</label>
                  <select
                    className="ap-form-select"
                    value={cita.estado}
                    disabled={guardandoId === cita.id_cita}
                    onChange={(e) => actualizar(cita, { estado: e.target.value })}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {t(ESTADO_TRAD[e] || e)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label">{t('adm.instalaciones.tecnicoLabel')}</label>
                  <select
                    className="ap-form-select"
                    value={cita.id_tecnico?.toString() || ''}
                    disabled={guardandoId === cita.id_cita}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) reasignar(cita, parseInt(v, 10));
                    }}
                  >
                    <option value="">{t('adm.instalaciones.sinAsignar')}</option>
                    {estaInactivo(cita) && (
                      <option value={cita.id_tecnico?.toString()} disabled>
                        {cita.nombre_tecnico || 'Técnico'} ({t('adm.instalaciones.inhabilitado')})
                      </option>
                    )}
                    {disponibles[cita.id_cita] === undefined
                      ? tecnicos.map((tec) => (
                          <option key={tec.id_tecnico} value={tec.id_tecnico}>
                            {formatTecnico(tec)}
                          </option>
                        ))
                      : disponibles[cita.id_cita].length === 0
                        ? (
                          <option value="" disabled>
                            {t('adm.instalaciones.sinTecnicosDia')}
                          </option>
                        )
                        : disponibles[cita.id_cita].map((tec) => (
                            <option key={tec.id_tecnico} value={tec.id_tecnico}>
                              {tec.nombre.toUpperCase()}
                            </option>
                          ))}
                  </select>
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label">{t('adm.instalaciones.tecnicoLabel2')}</label>
                  <select
                    className="ap-form-select"
                    value={cita.id_tecnico_2?.toString() || ''}
                    disabled={guardandoId === cita.id_cita}
                    onChange={(e) =>
                      actualizar(cita, { id_tecnico_2: e.target.value ? parseInt(e.target.value, 10) : null })
                    }
                  >
                    <option value="">{t('adm.instalaciones.sinAsignar')}</option>
                    {tecnicos
                      .filter((tec) => tec.id_tecnico !== cita.id_tecnico)
                      .map((tec) => (
                        <option key={tec.id_tecnico} value={tec.id_tecnico}>
                          {formatTecnico(tec)}
                        </option>
                      ))}
                  </select>
                </div>
                {!estaInactivo(cita) && (
                  <div className="ap-form-group">
                    <label className="ap-form-label">&nbsp;</label>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost ap-aplazar-btn"
                      disabled={aplazandoId === cita.id_cita || guardandoId === cita.id_cita}
                      onClick={() => sugerirAplazamiento(cita)}
                    >
                      {aplazandoId === cita.id_cita ? (
                        <span className="ap-loader" />
                      ) : (
                        <FaClockRotateLeft />
                      )}
                      {t('adm.instalaciones.aplazar')}
                    </button>
                  </div>
                )}
              </div>

              <div className="ap-comision" style={{ marginTop: 12 }}>
                {cita.comision_valor != null && edicionComision[cita.id_cita] === undefined ? (
                  <>
                    <span className="ap-badge ok">
                      {cita.comision_porcentaje != null
                        ? `${cita.comision_porcentaje}%`
                        : t('adm.instalaciones.comision')}{' '}
                      · {formatoPeso(cita.comision_valor)}
                    </span>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost"
                      disabled={guardandoId === cita.id_cita}
                      onClick={() =>
                        setEdicionComision((prev) => ({
                          ...prev,
                          [cita.id_cita]: String(cita.comision_porcentaje ?? 5),
                        }))
                      }
                    >
                      {t('adm.instalaciones.cambiarPorcentaje')}
                    </button>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost"
                      disabled={guardandoId === cita.id_cita}
                      onClick={() => actualizar(cita, { id_comision_c: null })}
                    >
                      {t('adm.instalaciones.quitar')}
                    </button>
                  </>
                ) : edicionComision[cita.id_cita] !== undefined ? (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="ap-form-input"
                      style={{ width: 90 }}
                      placeholder="%"
                      value={edicionComision[cita.id_cita]}
                      disabled={guardandoId === cita.id_cita}
                      onChange={(e) =>
                        setEdicionComision((prev) => ({ ...prev, [cita.id_cita]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarComision(cita);
                        if (e.key === 'Escape') {
                          setEdicionComision((prev) => {
                            const copia = { ...prev };
                            delete copia[cita.id_cita];
                            return copia;
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ap-btn ap-btn-primary"
                      disabled={guardandoId === cita.id_cita}
                      onClick={() => guardarComision(cita)}
                    >
                      {t('adm.instalaciones.aplicar')}
                    </button>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost"
                      disabled={guardandoId === cita.id_cita}
                      onClick={() =>
                        setEdicionComision((prev) => {
                          const copia = { ...prev };
                          delete copia[cita.id_cita];
                          return copia;
                        })
                      }
                    >
                      {t('adm.instalaciones.cancelar')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ap-btn ap-btn-primary"
                    disabled={guardandoId === cita.id_cita}
                    onClick={() =>
                      setEdicionComision((prev) => ({ ...prev, [cita.id_cita]: '5' }))
                    }
                  >
                    {t('adm.instalaciones.agregarComision')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!cargando && !error && totalPaginas > 1 && (
        <div className="ap-paginacion">
          <button
            type="button"
            className="ap-page-btn"
            disabled={paginaActual === 1}
            onClick={() => setPagina(paginaActual - 1)}
          >
            {t('adm.instalaciones.anterior')}
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
            {t('adm.instalaciones.siguiente')}
          </button>
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

export default AdminInstalaciones;