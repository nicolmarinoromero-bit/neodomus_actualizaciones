import { useState } from 'react';
import { FaPen, FaCheck, FaXmark } from 'react-icons/fa6';
import { useIdioma } from '@i18n/IdiomaContext';
import ConfirmDialog from '@components/common/ConfirmDialog';
import CampoEmail from './CampoEmail';
import { bloquearTeclasPortapapeles, bloquearEventoPortapapeles } from '@utils/copyPaste';
import type { NotifyFn } from './PersonalTab';

export interface CampoPerfilDef {
  clave: string;
  label: string;
  valor: string;
  tipo?: 'text' | 'tel';
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  requerido?: boolean;
  bloquearPortapapeles?: boolean;
}

interface PerfilCuentaProps {
  campos: CampoPerfilDef[];
  email: string;
  emailOriginal: string;
  rol: string;
  notificar: NotifyFn;
  onGuardar: (payload: Record<string, unknown>) => Promise<boolean>;
  onEmailVerificado: (nuevo: string) => void;
}

/**
 * Sección "Mi perfil" con UN solo botón EDITAR PERFIL:
 * - Modo lectura: filas con los datos actuales (Nombre, Apellido, Correo,
 *   Teléfono, Rol, etc.) y el botón único [EDITAR PERFIL].
 * - Al pulsarlo se pide confirmación; al aceptar se activa la edición.
 * - El correo solo se actualiza tras verificar el código enviado al correo
 *   actual (CampoEmail); sin verificación no se envía al backend.
 */
const PerfilCuenta = ({
  campos,
  email,
  emailOriginal,
  rol,
  notificar,
  onGuardar,
  onEmailVerificado,
}: PerfilCuentaProps) => {
  const { t } = useIdioma();
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [emailCambiado, setEmailCambiado] = useState(false);

  const iniciarEdicion = () => {
    const inicial: Record<string, string> = {};
    for (const c of campos) inicial[c.clave] = c.valor ?? '';
    setBorrador(inicial);
    setEmailCambiado(false);
    setEditando(true);
  };

  const salirEdicion = () => {
    setEditando(false);
    setEmailCambiado(false);
  };

  const propsPortapapeles = {
    onCopy: bloquearEventoPortapapeles,
    onCut: bloquearEventoPortapapeles,
    onPaste: bloquearEventoPortapapeles,
    onContextMenu: bloquearEventoPortapapeles,
    onKeyDown: bloquearTeclasPortapapeles,
  };

  const guardar = async () => {
    if (emailCambiado) {
      notificar(t('perfil.emailDebeVerificar'), 'error');
      return;
    }
    const payload: Record<string, unknown> = { email: email.trim() };
    for (const c of campos) {
      const v = (borrador[c.clave] ?? '').trim();
      if (c.requerido && !v) {
        notificar(t('perfil.camposObligatorios'), 'error');
        return;
      }
      payload[c.clave] = v;
    }
    setGuardando(true);
    const ok = await onGuardar(payload);
    setGuardando(false);
    if (ok) salirEdicion();
  };

  if (!editando) {
    return (
      <div className="pf-cuenta">
        <div className="pf-cuenta-seccion">
          <span className="pf-seccion-titulo">{t('perfil.informacionPersonal')}</span>
        </div>
        <div className="pf-cuenta-grid">
          {campos.map((c, i) => (
            <div
              className={`pf-dato-cell${i > 1 ? ' pf-dato-span' : ''}`}
              key={c.clave}
            >
              <span className="pf-dato-label">{c.label}</span>
              <span className="pf-dato-valor">{c.valor || '—'}</span>
            </div>
          ))}
          <div className="pf-dato-cell pf-dato-span">
            <span className="pf-dato-label">{t('perfil.correo')}</span>
            <span className="pf-dato-valor pf-dato-correo">{email || '—'}</span>
          </div>
          <div className="pf-dato-cell pf-dato-span">
            <span className="pf-dato-label">{t('perfil.rol')}</span>
            <span className="pf-dato-chip">{rol}</span>
          </div>
        </div>

        <div className="pf-cuenta-acciones">
          <button
            type="button"
            className="pf-btn pf-btn-primary"
            onClick={() => setConfirmar(true)}
          >
            <FaPen /> {t('perfil.editarPerfil')}
          </button>
        </div>

        <ConfirmDialog
          abierto={confirmar}
          mensaje={t('perfil.confirmarCambiosMsg')}
          onCancelar={() => setConfirmar(false)}
          onAceptar={() => {
            setConfirmar(false);
            iniciarEdicion();
          }}
        />
      </div>
    );
  }

  return (
    <div className="pf-cuenta pf-cuenta-edit">
      <div className="pf-form-grid">
        {campos.map((c) => (
          <div className="pf-form-group" key={c.clave}>
            <label className="pf-form-label" htmlFor={`pc-${c.clave}`}>
              {c.label}
            </label>
            <input
              id={`pc-${c.clave}`}
              className="pf-form-input"
              type={c.tipo || 'text'}
              maxLength={c.maxLength}
              placeholder={c.placeholder}
              value={borrador[c.clave] ?? ''}
              onChange={(e) =>
                setBorrador({
                  ...borrador,
                  [c.clave]:
                    c.tipo === 'tel'
                      ? e.target.value.replace(/\D/g, '')
                      : e.target.value,
                })
              }
              {...(c.bloquearPortapapeles ? propsPortapapeles : {})}
            />
            {c.hint && <span className="pf-campo-hint">{c.hint}</span>}
          </div>
        ))}

        <div className="pf-form-group pf-form-span">
          <span className="pf-form-label">{t('perfil.correo')}</span>
          <CampoEmail
            label={t('perfil.correo')}
            valor={email}
            emailOriginal={emailOriginal}
            modoEdicion
            onCambio={(nuevo) => {
              setEmailCambiado(
                nuevo.trim().toLowerCase() !== (emailOriginal || '').trim().toLowerCase(),
              );
            }}
            onVerificado={(nuevo) => {
              setEmailCambiado(false);
              onEmailVerificado(nuevo);
            }}
            notificar={notificar}
          />
        </div>
      </div>

      <div className="pf-form-actions">
        <button
          type="button"
          className="pf-btn pf-btn-ghost"
          onClick={salirEdicion}
          disabled={guardando}
        >
          <FaXmark /> {t('perfil.cancelar')}
        </button>
        <button
          type="button"
          className="pf-btn pf-btn-primary"
          onClick={guardar}
          disabled={guardando}
        >
          <FaCheck /> {guardando ? t('perfil.guardando') : t('perfil.guardarCambios')}
        </button>
      </div>
    </div>
  );
};

export default PerfilCuenta;