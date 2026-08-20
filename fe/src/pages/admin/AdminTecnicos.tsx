import { useEffect, useState } from 'react';
import { useIdioma } from '@i18n/IdiomaContext';
import { motion } from 'framer-motion';
import {
  FaUserGear,
  FaCircleInfo,
  FaPlus,
  FaMagnifyingGlass,
  FaPen,
  FaUserSlash,
  FaKey,
  FaTriangleExclamation,
  FaCircleCheck,
  FaIdCard,
  FaXmark,
} from 'react-icons/fa6';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';
import api from '@services/api';
import type { TecnicoAdmin } from '../../types';

interface FormTecnico {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  telefono: string;
  documento: string;
  certificacion: string;
  cargo: string;
  is_active: boolean;
}

const VACIO: FormTecnico = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  telefono: '',
  documento: '',
  certificacion: '',
  cargo: 'Junior',
  is_active: true,
};

const CARGOS = ['Junior', 'Semi Senior', 'Senior'];

const SERVICIOS_LABEL: Record<string, string> = {
  instalacion: 'adm.tecnicos.servInstalacion',
  mantenimiento: 'adm.tecnicos.servMantenimiento',
  reparacion: 'adm.tecnicos.servReparacion',
  revision: 'adm.tecnicos.servRevision',
  soporte: 'adm.tecnicos.servSoporte',
};

const CARGOS_LABEL: Record<string, string> = {
  Junior: 'adm.tecnicos.cargoJunior',
  'Semi Senior': 'adm.tecnicos.cargoSemiSenior',
  Senior: 'adm.tecnicos.cargoSenior',
};

const AdminTecnicos = () => {
  const { idioma, t } = useIdioma();
  const [tecnicos, setTecnicos] = useState<TecnicoAdmin[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<null | 'crear' | 'editar'>(null);
  const [editando, setEditando] = useState<TecnicoAdmin | null>(null);
  const [form, setForm] = useState<FormTecnico>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [cambiarPass, setCambiarPass] = useState(false);
  const [desactivando, setDesactivando] = useState<TecnicoAdmin | null>(null);
  const [hastaFecha, setHastaFecha] = useState('');
  const [motivoDesactivar, setMotivoDesactivar] = useState('');
  const [guardandoDesactivar, setGuardandoDesactivar] = useState(false);

  const cargar = async () => {
    setCargando(true);
    setError(false);
    try {
      const res = await api.get<TecnicoAdmin[]>('/tecnicos');
      setTecnicos(res.data || []);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const abierto = modal !== null || desactivando !== null;
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal, desactivando]);

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    window.setTimeout(() => setToast(null), 3200);
  };

  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...VACIO });
    setCambiarPass(false);
    setShowPassword(false);
    setModal('crear');
  };

  const cerrarModal = () => {
    setEditando(null);
    setForm({ ...VACIO });
    setCambiarPass(false);
    setShowPassword(false);
    setModal(null);
  };

  const abrirEditar = (t: TecnicoAdmin) => {
    setEditando(t);
    setCambiarPass(false);
    setShowPassword(false);
    setForm({
      first_name: t.first_name,
      last_name: t.last_name,
      email: t.email,
      password: '',
      telefono: t.telefono_usuario?.toString() || '',
      documento: t.documento_usuario?.toString() || '',
      certificacion: t.certificacion_t || '',
      cargo: t.cargo_t || 'Junior',
      is_active: t.is_active,
    });
    setModal('editar');
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.telefono.trim() && !/^\d{10}$/.test(form.telefono.trim())) {
      notify(t('adm.tecnicos.telefonoInvalido'), 'err');
      return;
    }
    setGuardando(true);
    try {
      if (modal === 'crear') {
        if (form.password.length < 6) {
          notify(t('adm.tecnicos.passCorta'), 'err');
          setGuardando(false);
          return;
        }
        const payload: Record<string, unknown> = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          password: form.password,
          id_rol: 2,
        };
        if (form.telefono.trim()) payload.telefono_usuario = parseInt(form.telefono.replace(/\D/g, ''), 10);
        if (form.documento.trim()) payload.documento_usuario = parseInt(form.documento.replace(/\D/g, ''), 10);
        if (form.certificacion.trim()) payload.certificacion = form.certificacion.trim();
        if (form.cargo.trim()) payload.cargo = form.cargo.trim();
        await api.post('/users', payload);
        notify(t('adm.tecnicos.registradoOk', { email: form.email }));
      } else if (editando) {
        if (cambiarPass && form.password.length < 6) {
          notify(t('adm.tecnicos.passCorta'), 'err');
          setGuardando(false);
          return;
        }
        const payload: Record<string, unknown> = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          certificacion: form.certificacion.trim() || null,
          cargo: form.cargo.trim() || null,
        };
        if (cambiarPass) payload.password = form.password;
        if (form.telefono.trim()) payload.telefono_usuario = parseInt(form.telefono.replace(/\D/g, ''), 10);
        if (form.documento.trim()) payload.documento_usuario = parseInt(form.documento.replace(/\D/g, ''), 10);
        await api.put(`/users/${editando.id_usuario}`, payload);
        notify(t('adm.tecnicos.actualizadoOk'));
      }
      cerrarModal();
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.tecnicos.errorGuardar'), 'err');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (t: TecnicoAdmin) => {
    setHastaFecha('');
    setMotivoDesactivar('');
    setDesactivando(t);
  };

  const confirmarDesactivar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desactivando) return;
    if (!motivoDesactivar.trim()) {
      notify(t('adm.tecnicos.motivoRequerido'), 'err');
      return;
    }
    setGuardandoDesactivar(true);
    try {
      const payload: Record<string, unknown> = { is_active: false, motivo: motivoDesactivar.trim() };
      if (hastaFecha) {
        payload.desactivado_hasta = new Date(hastaFecha).toISOString();
      } else {
        payload.desactivado_hasta = null;
      }
      await api.put(`/users/${desactivando.id_usuario}`, payload);
      notify(
        hastaFecha
          ? t('adm.tecnicos.desactivadoHastaOk', {
              nombre: nombreMayus(desactivando),
              fecha: new Date(hastaFecha).toLocaleString(idioma === 'en' ? 'en-US' : 'es-CO'),
            })
          : t('adm.tecnicos.desactivadoOk', { nombre: nombreMayus(desactivando) }),
        'err',
      );
      setDesactivando(null);
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.tecnicos.errorDesactivar'), 'err');
    } finally {
      setGuardandoDesactivar(false);
    }
  };

  const habilitar = async (tecnico: TecnicoAdmin) => {
    try {
      await api.put(`/users/${tecnico.id_usuario}`, { is_active: true });
      notify(t('adm.tecnicos.habilitadoOk', { nombre: nombreMayus(tecnico) }));
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.tecnicos.errorHabilitar'), 'err');
    }
  };

  const formatearHasta = (t: TecnicoAdmin) => {
    if (!t.desactivado_hasta) return null;
    try {
      return new Date(t.desactivado_hasta).toLocaleString(idioma === 'en' ? 'en-US' : 'es-CO');
    } catch {
      return null;
    }
  };

  const filtrados = tecnicos.filter((t) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      t.first_name.toLowerCase().includes(q) ||
      t.last_name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.certificacion_t || '').toLowerCase().includes(q)
    );
  });

  const iniciales = (t: TecnicoAdmin) =>
    `${(t.first_name || '?')[0]}${(t.last_name || '')[0]}`.toUpperCase();

  const nombreMayus = (t: TecnicoAdmin) => `${t.first_name || ''} ${t.last_name || ''}`.trim().toUpperCase();

  return (
    <motion.section
      className="admin-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="ap-header">
        <div>
          <h1 className="ap-title">{t('adm.tecnicos.titulo')}</h1>
          <p className="ap-subtitle">
            {tecnicos.length > 0
              ? t('adm.tecnicos.conteo', { n: tecnicos.length })
              : t('adm.tecnicos.subtituloVacio')}
          </p>
        </div>
        <div className="ap-header-right">
          <button type="button" className="ap-btn ap-btn-primary" onClick={abrirCrear}>
            <FaPlus /> {t('adm.tecnicos.btnRegistrar')}
          </button>
        </div>
      </div>

      <div className="ap-filters" style={{ marginBottom: 20 }}>
        <form className="ap-search" onSubmit={(e) => e.preventDefault()}>
          <FaMagnifyingGlass />
          <input
            type="text"
            placeholder={t('adm.tecnicos.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </form>
      </div>

      {cargando ? (
        <div className="ap-card">
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('adm.tecnicos.cargando')}</h3>
            <p>{t('adm.tecnicos.cargandoDesc')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="ap-card">
          <div className="ap-states error">
            <div className="ap-states-icon">
              <FaCircleInfo />
            </div>
            <h3>{t('adm.tecnicos.errorTitulo')}</h3>
            <p>{t('adm.tecnicos.errorDesc')}</p>
            <button type="button" className="ap-btn ap-btn-ghost" onClick={cargar}>
              {t('adm.tecnicos.reintentar')}
            </button>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="ap-card">
          <div className="ap-states">
            <div className="ap-states-icon">
              <FaUserGear />
            </div>
            <h3>{busqueda ? t('adm.tecnicos.sinResultados') : t('adm.tecnicos.noHayTecnicos')}</h3>
            <p>
              {busqueda
                ? t('adm.tecnicos.sinResultadosDetalle', { q: busqueda.trim() })
                : t('adm.tecnicos.vacioDetalle')}
            </p>
            {!busqueda && (
              <button type="button" className="ap-btn ap-btn-primary" onClick={abrirCrear}>
                <FaPlus /> {t('adm.tecnicos.btnRegistrar')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="ap-grid">
          {filtrados.map((tecnico) => (
            <div className="ap-grid-item" key={tecnico.id_tecnico}>
              <div className="ap-grid-item-top">
                <span className="ap-initials">{iniciales(tecnico)}</span>
                <span className={`ap-badge ${tecnico.is_active ? 'ok' : 'err'}`}>
                  {tecnico.is_active ? t('adm.tecnicos.disponible') : t('adm.tecnicos.inactivo')}
                </span>
              </div>
              <div>
                <h3>{nombreMayus(tecnico)}</h3>
                <p>{tecnico.email}</p>
                {tecnico.password_reset_required && (
                  <span className="ap-badge pendiente" style={{ marginTop: 6 }}>
                    <FaKey /> {t('adm.tecnicos.passResetRequerido')}
                  </span>
                )}
              </div>
              <div className="ap-def-list" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.tecnicos.especialidad')}</div>
                  <div className="ap-def-value">{tecnico.certificacion_t || '—'}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.tecnicos.nivel')}</div>
                  <div className="ap-def-value ap-tec-nivel">{tecnico.cargo_t || '—'}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.tecnicos.telefono')}</div>
                  <div className="ap-def-value">{tecnico.telefono_usuario ? `+${tecnico.telefono_usuario}` : '—'}</div>
                </div>
              </div>
              <div className="ap-tec-servicios">
                <span className="ap-def-label">{t('adm.tecnicos.serviciosRealiza')}</span>
                <div className="ap-tec-servicios-badges">
                  {(tecnico.servicios || []).map((s) => (
                    <span key={s} className="ap-badge ok">
                      {SERVICIOS_LABEL[s] ? t(SERVICIOS_LABEL[s]) : s}
                    </span>
                  ))}
                  {(!tecnico.servicios || tecnico.servicios.length === 0) && (
                    <span className="ap-tec-servicios-vacio">{t('adm.tecnicos.sinEspecialidad')}</span>
                  )}
                </div>
              </div>
              <div className="ap-form-row" style={{ marginTop: 6 }}>
                <button type="button" className="ap-btn ap-btn-ghost" onClick={() => abrirEditar(tecnico)}>
                  <FaPen /> {t('adm.tecnicos.editar')}
                </button>
                {tecnico.is_active ? (
                  <button
                    type="button"
                    className="ap-btn ap-btn-danger"
                    onClick={() => desactivar(tecnico)}
                    title={t('adm.tecnicos.desactivarTitulo', { nombre: tecnico.first_name })}
                  >
                    <FaUserSlash /> {t('adm.tecnicos.desactivar')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ap-btn ap-btn-primary"
                    onClick={() => habilitar(tecnico)}
                    title={t('adm.tecnicos.habilitarTitulo', { nombre: tecnico.first_name })}
                  >
                    <FaCircleCheck /> {t('adm.tecnicos.habilitar')}
                  </button>
                )}
              </div>
              {!tecnico.is_active && formatearHasta(tecnico) && (
                <div className="ap-def-label" style={{ marginTop: 8, color: '#e08c8c' }}>
                  {t('adm.tecnicos.inhabilitadoHasta', { fecha: formatearHasta(tecnico) ?? '' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="ap-modal-overlay">
          <form
            onSubmit={guardar}
            className="ap-modal ap-modal-panel"
            style={{ maxWidth: 560 }}
            autoComplete="off"
          >
            <div className="ap-modal-head">
              <h3>
                {modal === 'crear' ? (
                  <>
                    <FaIdCard style={{ color: '#ffd98a', marginRight: 8 }} /> {t('adm.tecnicos.registrarTitulo')}
                  </>
                ) : (
                  <>
                    <FaPen style={{ color: '#ffd98a', marginRight: 8 }} /> {t('adm.tecnicos.editarTitulo')}
                  </>
                )}
              </h3>
              <button type="button" className="ap-modal-x" onClick={cerrarModal} aria-label={t('adm.tecnicos.cerrar')}>
                <FaXmark />
              </button>
            </div>

            <div className="ap-modal-body">
              <p>
                {modal === 'crear'
                  ? t('adm.tecnicos.crearDescripcion')
                  : t('adm.tecnicos.editarDescripcion')}
              </p>

              <div className="ap-form-grid" style={{ marginTop: 4 }}>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-nombre">{t('adm.tecnicos.nombre')} *</label>
                  <input
                    id="tf-nombre"
                    className="ap-form-input"
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-apellido">{t('adm.tecnicos.apellidos')} *</label>
                  <input
                    id="tf-apellido"
                    className="ap-form-input"
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-email">{t('adm.tecnicos.correo')} *</label>
                  <input
                    id="tf-email"
                    className="ap-form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    disabled={modal === 'editar'}
                    autoComplete="off"
                  />
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-pass">
                    {modal === 'crear' ? t('adm.tecnicos.contrasenaAcceso') : t('adm.tecnicos.nuevaContrasena')}
                  </label>
                  <div className="ap-pass-field">
                    <input
                      id="tf-pass"
                      className="ap-form-input"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={modal === 'editar' ? t('adm.tecnicos.passwordPlaceholder') : ''}
                      minLength={modal === 'crear' ? 6 : undefined}
                      required={modal === 'crear'}
                      autoComplete="new-password"
                    />
                    <button type="button" className="ap-pass-toggle" onClick={() => setShowPassword(!showPassword)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showPassword ? (
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                        ) : (
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        )}
                      </svg>
                    </button>
                  </div>
                  {modal === 'crear' && (
                    <span className="ap-form-hint" style={{ color: '#d4a54b', marginTop: 6, display: 'block' }}>
                      {t('adm.tecnicos.passHintPrimer')}
                    </span>
                  )}
                  {modal === 'editar' && (
                    <label className="ap-form-hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={cambiarPass} onChange={(e) => setCambiarPass(e.target.checked)} />
                      {t('adm.tecnicos.cambiarPassCheck')}
                    </label>
                  )}
                  {cambiarPass && (
                    <span className="ap-form-hint" style={{ color: '#d4a54b', marginTop: 6, display: 'block' }}>
                      {t('adm.tecnicos.passHintProximo')}
                    </span>
                  )}
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-tel">{t('adm.tecnicos.telefono')}</label>
                  <input
                    id="tf-tel"
                    className="ap-form-input"
                    type="tel"
                    maxLength={10}
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })}
                    placeholder="3001234567"
                  />
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-doc">{t('adm.tecnicos.documento')}</label>
                  <input
                    id="tf-doc"
                    className="ap-form-input"
                    type="text"
                    maxLength={12}
                    value={form.documento}
                    onChange={(e) => setForm({ ...form, documento: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div className="ap-form-group full">
                  <label className="ap-form-label" htmlFor="tf-cer">{t('adm.tecnicos.especialidadCertificacion')}</label>
                  <input
                    id="tf-cer"
                    className="ap-form-input"
                    type="text"
                    value={form.certificacion}
                    onChange={(e) => setForm({ ...form, certificacion: e.target.value })}
                    placeholder={t('adm.tecnicos.certificacionPlaceholder')}
                  />
                </div>
                <div className="ap-form-group">
                  <label className="ap-form-label" htmlFor="tf-cargo">{t('adm.tecnicos.nivelCargo')}</label>
                  <select
                    id="tf-cargo"
                    className="ap-form-select"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  >
                    {CARGOS.map((c) => (
                      <option key={c} value={c}>
                        {t(CARGOS_LABEL[c])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {modal === 'editar' && (
                <div className="ap-mini-item" style={{ marginTop: 8 }}>
                  <span className="ap-mini-icon">
                    <FaKey />
                  </span>
                  <div className="ap-mini-info">
                    <div className="ap-mini-title">{t('adm.tecnicos.estadoCuenta')}</div>
                    <div className="ap-mini-sub">
                      {form.is_active
                        ? t('adm.tecnicos.cuentaActiva')
                        : editando?.desactivado_hasta
                          ? t('adm.tecnicos.cuentaDesactivadaHasta', { fecha: formatearHasta(editando) ?? '' })
                          : t('adm.tecnicos.cuentaDesactivada')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="ap-modal-footer">
              <button type="button" className="ap-btn ap-btn-ghost" onClick={cerrarModal} disabled={guardando}>
                {t('adm.tecnicos.cancelar')}
              </button>
              <button type="submit" className="ap-btn ap-btn-primary" disabled={guardando}>
                <FaCircleCheck /> {guardando ? t('adm.tecnicos.guardando') : modal === 'crear' ? t('adm.tecnicos.crearTecnico') : t('adm.tecnicos.guardarCambios')}
              </button>
            </div>
          </form>
        </div>
      )}

      {desactivando && (
        <div className="ap-modal-overlay">
          <form
            className="ap-modal"
            style={{ maxWidth: 460 }}
            onSubmit={confirmarDesactivar}
          >
            <div className="ap-modal-head">
              <h3>
                <FaUserSlash style={{ color: '#ffd98a', marginRight: 8 }} />{' '}
                {t('adm.tecnicos.desactivarTitulo', { nombre: nombreMayus(desactivando) })}
              </h3>
              <button
                type="button"
                className="ap-modal-x"
                onClick={() => setDesactivando(null)}
                disabled={guardandoDesactivar}
                aria-label={t('adm.tecnicos.cerrar')}
              >
                <FaXmark />
              </button>
            </div>
            <p>
              {t('adm.tecnicos.desactivarInfo1')}
            </p>
            <p style={{ marginTop: 8 }}>
              {t('adm.tecnicos.desactivarInfoCitas')}
            </p>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="atf-motivo">
                {t('adm.tecnicos.motivoLabel')} *
              </label>
              <textarea
                id="atf-motivo"
                className="ap-form-textarea"
                value={motivoDesactivar}
                onChange={(e) => setMotivoDesactivar(e.target.value)}
                placeholder={t('adm.tecnicos.motivoPlaceholder')}
                required
                disabled={guardandoDesactivar}
              />
            </div>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="atf-hasta">
                {t('adm.tecnicos.hastaOpcional')}
              </label>
              <input
                id="atf-hasta"
                className="ap-form-input"
                type="datetime-local"
                value={hastaFecha}
                onChange={(e) => setHastaFecha(e.target.value)}
              />
              <span className="ap-form-hint">
                {t('adm.tecnicos.hastaHint')}
              </span>
            </div>
            <div className="ap-form-row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ap-btn ap-btn-ghost"
                onClick={() => setDesactivando(null)}
                disabled={guardandoDesactivar}
              >
                {t('adm.tecnicos.cancelar')}
              </button>
              <button
                type="submit"
                className="ap-btn ap-btn-danger"
                disabled={guardandoDesactivar}
              >
                <FaUserSlash /> {guardandoDesactivar ? t('adm.tecnicos.desactivando') : t('adm.tecnicos.desactivar')}
              </button>
            </div>
          </form>
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

export default AdminTecnicos;