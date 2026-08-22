import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaCircleInfo,
  FaMoneyBillWave,
  FaRotate,
  FaRotateLeft,
} from 'react-icons/fa6';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';
import api from '@services/api';
import { useIdioma } from '@i18n/IdiomaContext';

interface DevolucionItem {
  id_devolucion: number;
  id_pedido: number | null;
  id_producto: number | null;
  producto?: string | null;
  cliente?: string | null;
  motivo: string | null;
  estado: string;
  resolucion?: string | null;
  created_at: string | null;
  resuelta_at: string | null;
}

interface ReembolsoItem {
  id_reembolso: number;
  id_cita: number | null;
  referencia: string;
  cliente_nombre: string | null;
  detalle: string | null;
  monto: number;
  estado: string;
  motivo: string | null;
  numero_transaccion_original: string | null;
  numero_transaccion_reembolso: string | null;
  created_at: string;
}

interface CitaElegible {
  id_cita: number;
  etiqueta: string;
  monto_pagado: number;
}

type Vista = 'devoluciones' | 'reembolsos';

const formatoPeso = (value: number) =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const formatFecha = (fecha: string) => {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

const AdminDevoluciones = () => {
  const { t } = useIdioma();
  const [vista, setVista] = useState<Vista>('devoluciones');
  const [devoluciones, setDevoluciones] = useState<DevolucionItem[]>([]);
  const [reembolsos, setReembolsos] = useState<ReembolsoItem[]>([]);
  const [elegibles, setElegibles] = useState<CitaElegible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [procesandoDev, setProcesandoDev] = useState<number | null>(null);
  const [selReembolso, setSelReembolso] = useState('');
  const [montoReembolso, setMontoReembolso] = useState('');
  const [motivoReembolso, setMotivoReembolso] = useState('');
  const [creandoReembolso, setCreandoReembolso] = useState(false);
  const [procesandoReembolso, setProcesandoReembolso] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    window.setTimeout(() => setToast(null), 3200);
  };

  const cargar = async () => {
    setCargando(true);
    setError(false);
    try {
      const [resD, resR, resE] = await Promise.all([
        api.get<DevolucionItem[]>('/devoluciones'),
        api.get<ReembolsoItem[]>('/reembolsos').catch(() => ({ data: [] as ReembolsoItem[] })),
        api.get<CitaElegible[]>('/reembolsos/elegibles').catch(() => ({ data: [] as CitaElegible[] })),
      ]);
      setDevoluciones(resD.data || []);
      setReembolsos(resR.data || []);
      setElegibles(resE.data || []);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const resolverDevolucion = async (
    id: number,
    estado: 'Aprobada' | 'Rechazada',
    resolucion?: 'Reembolso' | 'Cambio',
  ) => {
    setProcesandoDev(id);
    try {
      await api.put(`/devoluciones/${id}/estado`, { estado, resolucion });
      notify(t('adm.devoluciones.resuelta'));
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.devoluciones.errorResolver'), 'err');
    } finally {
      setProcesandoDev(null);
    }
  };

  const seleccionarElegible = (valor: string) => {
    setSelReembolso(valor);
    const elegida = elegibles.find((e) => String(e.id_cita) === valor);
    setMontoReembolso(elegida ? String(elegida.monto_pagado) : '');
  };

  const crearReembolso = async () => {
    if (!selReembolso) {
      notify(t('adm.instalaciones.reembolsoEligeCita'), 'err');
      return;
    }
    const monto = Number(montoReembolso.replace(/\./g, '').replace(',', '.'));
    if (!monto || monto <= 0) {
      notify(t('adm.instalaciones.errorCostoCero'), 'err');
      return;
    }
    setCreandoReembolso(true);
    try {
      await api.post('/reembolsos', {
        id_cita: Number(selReembolso),
        monto,
        motivo: motivoReembolso.trim() || undefined,
      });
      notify(t('adm.instalaciones.reembolsoExito'));
      setSelReembolso('');
      setMontoReembolso('');
      setMotivoReembolso('');
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.reembolsoError'), 'err');
    } finally {
      setCreandoReembolso(false);
    }
  };

  const reprocesarReembolso = async (id: number) => {
    setProcesandoReembolso(id);
    try {
      await api.post(`/reembolsos/${id}/procesar`);
      notify(t('adm.instalaciones.reembolsoExito'));
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.instalaciones.reembolsoError'), 'err');
    } finally {
      setProcesandoReembolso(null);
    }
  };

  const pendientesDev = devoluciones.filter((d) => d.estado === 'Pendiente').length;

  return (
    <motion.div
      className="admin-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="ap-header">
        <div>
          <h1 className="ap-title">{t('adm.devoluciones.titulo')}</h1>
          <p className="ap-subtitle">{t('adm.devoluciones.subtitulo')}</p>
        </div>
        <div className="ap-header-right">
          <button type="button" className="ap-btn ap-btn-ghost" onClick={cargar} disabled={cargando}>
            <FaRotate className={cargando ? 'spin' : ''} /> {t('adm.consultas.actualizar')}
          </button>
        </div>
      </div>

      <div className="ap-tabs" role="tablist" aria-label={t('adm.devoluciones.tabsAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'devoluciones'}
          className={`ap-tab ${vista === 'devoluciones' ? 'active' : ''}`}
          onClick={() => setVista('devoluciones')}
        >
          <FaRotateLeft /> {t('adm.devoluciones.tabDevoluciones')}
          {pendientesDev > 0 && <span className="ap-pill-count">{pendientesDev}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'reembolsos'}
          className={`ap-tab ${vista === 'reembolsos' ? 'active' : ''}`}
          onClick={() => setVista('reembolsos')}
        >
          <FaMoneyBillWave /> {t('adm.devoluciones.tabReembolsos')}
        </button>
      </div>

      {cargando ? (
        <div className="ap-card">
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('adm.consultas.cargandoSolicitudes')}</h3>
          </div>
        </div>
      ) : error ? (
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
      ) : vista === 'devoluciones' ? (
        devoluciones.length === 0 ? (
          <div className="ap-card">
            <div className="ap-states">
              <div className="ap-states-icon">
                <FaRotateLeft />
              </div>
              <h3>{t('adm.devoluciones.sinDevoluciones')}</h3>
              <p>{t('adm.devoluciones.sinDevolucionesSub')}</p>
            </div>
          </div>
        ) : (
          <div className="ap-grid">
            {devoluciones.map((d) => (
              <div className="ap-grid-item" key={d.id_devolucion}>
                <div className="ap-grid-item-top">
                  <span className="ap-initials">
                    {(d.cliente || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span
                    className={`ap-badge ${
                      d.estado === 'Aprobada' ? 'ok' : d.estado === 'Rechazada' ? 'err' : 'warn'
                    }`}
                  >
                    {d.estado}
                  </span>
                </div>
                <h4 style={{ margin: '10px 0 2px', fontSize: '0.95rem' }}>
                  #{d.id_pedido} · {d.producto || `Producto #${d.id_producto ?? '—'}`}
                </h4>
                <p style={{ margin: 0, color: '#9a8f78', fontSize: '0.8rem' }}>
                  {d.cliente || '—'} · {formatFecha(d.created_at || '')}
                </p>
                {d.motivo && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#e8e8e8', overflowWrap: 'anywhere' }}>
                    “{d.motivo}”
                  </p>
                )}
                {d.estado === 'Pendiente' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="ap-btn ap-btn-primary"
                      disabled={procesandoDev === d.id_devolucion}
                      onClick={() => resolverDevolucion(d.id_devolucion, 'Aprobada')}
                    >
                      {t('adm.devoluciones.aprobar')}
                    </button>
                    <button
                      type="button"
                      className="ap-btn ap-btn-ghost"
                      disabled={procesandoDev === d.id_devolucion}
                      onClick={() => resolverDevolucion(d.id_devolucion, 'Rechazada')}
                    >
                      {t('adm.devoluciones.rechazar')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="ap-card ap-tarifas-card">
            <div className="ap-card-head">
              <h3><FaMoneyBillWave /> {t('adm.devoluciones.crearTitulo')}</h3>
              <p>{t('adm.devoluciones.crearDesc')}</p>
            </div>
            <div className="ap-tarifas-grid">
              <div className="ap-tarifa-item" style={{ alignItems: 'stretch', gap: 8 }}>
                <label className="ap-tarifa-nombre" htmlFor="dev-cita">
                  {t('adm.instalaciones.reembolsoCita')}
                </label>
                <select
                  id="dev-cita"
                  className="ap-form-input"
                  value={selReembolso}
                  onChange={(e) => seleccionarElegible(e.target.value)}
                >
                  <option value="">{t('adm.instalaciones.reembolsoSelecciona')}</option>
                  {elegibles.map((e) => (
                    <option key={e.id_cita} value={e.id_cita}>
                      {e.etiqueta} — {formatoPeso(e.monto_pagado)}
                    </option>
                  ))}
                </select>
                <div className="ap-tarifa-editar">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="ap-form-input"
                    placeholder={t('adm.instalaciones.reembolsoMonto')}
                    value={montoReembolso}
                    onChange={(e) => setMontoReembolso(e.target.value)}
                  />
                  <input
                    type="text"
                    className="ap-form-input"
                    placeholder={t('adm.instalaciones.reembolsoMotivo')}
                    value={motivoReembolso}
                    onChange={(e) => setMotivoReembolso(e.target.value)}
                  />
                  <button
                    type="button"
                    className="ap-btn ap-btn-primary"
                    disabled={creandoReembolso || !selReembolso}
                    onClick={crearReembolso}
                  >
                    {creandoReembolso
                      ? t('adm.instalaciones.procesando')
                      : t('adm.instalaciones.reembolsar')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="ap-card">
            <div className="ap-card-head">
              <h3><FaMoneyBillWave /> {t('adm.devoluciones.historialTitulo')}</h3>
              <p>{t('adm.devoluciones.historialDesc')}</p>
            </div>
            <div className="ap-tarifas-grid">
              {reembolsos.length === 0 ? (
                <p style={{ color: '#9a8f78' }}>{t('adm.instalaciones.sinReembolsos')}</p>
              ) : (
                reembolsos.map((r) => (
                  <div className="ap-tarifa-item" key={r.id_reembolso} style={{ alignItems: 'flex-start' }}>
                    <div>
                      <span className="ap-tarifa-nombre" style={{ display: 'block' }}>
                        {r.referencia}
                        {r.cliente_nombre ? ` · ${r.cliente_nombre}` : ''}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#9a8f78' }}>
                        {r.detalle ? `${r.detalle} · ` : ''}
                        {r.numero_transaccion_reembolso || '—'}
                      </span>
                    </div>
                    <div className="ap-tarifa-valor">
                      <strong>{formatoPeso(r.monto)}</strong>
                      <span
                        className={`ap-badge ${
                          r.estado === 'Reembolsado' ? 'ok' : r.estado === 'Rechazado' ? 'err' : 'warn'
                        }`}
                      >
                        {r.estado}
                      </span>
                      {(r.estado === 'Pendiente' || r.estado === 'Rechazado') && (
                        <button
                          type="button"
                          className="ap-btn ap-btn-ghost"
                          disabled={procesandoReembolso === r.id_reembolso}
                          onClick={() => reprocesarReembolso(r.id_reembolso)}
                        >
                          {t('adm.instalaciones.reprocesar')}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`ap-toast ${toast.tipo}`} role="status">
          {toast.msg}
        </div>
      )}
    </motion.div>
  );
};

export default AdminDevoluciones;

