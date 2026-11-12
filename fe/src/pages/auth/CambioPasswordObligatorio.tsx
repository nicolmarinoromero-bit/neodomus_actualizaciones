// Solicita cambiar la contraseña cuando la cuenta requiere actualizarla antes de continuar.
import { useNavigate } from 'react-router-dom';
import { FaKey, FaCircleExclamation } from 'react-icons/fa6';
import { useAuth } from '@contexts/AuthContext';
import { useIdioma } from '@i18n/IdiomaContext';
import { PasswordChangeFields } from '@components/common/PasswordChangeFields';
import { useCambioPassword } from '../../hooks/useCambioPassword';
import '@styles/login.css';

const CambioPasswordObligatorio = () => {
  const navigate = useNavigate();
  const { rol, logout, setPasswordResetRequired } = useAuth();
  const { t } = useIdioma();
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    loading,
    handleSubmit,
  } = useCambioPassword({
    errorNoCoinciden: t('auth.forceChange.errorNoCoinciden'),
    errorRequisitos: t('auth.forceChange.errorRequisitos'),
    errorMismaActual: t('perfil.password.diferenteActual'),
    errorGeneral: t('perfil.errorCambiarContrasena'),
    duracionMensajeMs: 6000,
    onSuccess: () => {
      setPasswordResetRequired(false);
      if (rol === 'administrador' || rol === 'admin') {
        navigate('/dashboard/admin', { replace: true });
      } else {
        navigate('/dashboard/tecnico', { replace: true });
      }
    },
  });

  return (
    <div className="login-page">
      <div className="login-container">
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-logo">
            <FaKey />
          </div>
          <h2>{t('auth.forceChange.titulo')}</h2>
          <p className="login-subtitle">
            {t('auth.forceChange.subtitulo')}
          </p>
          {error && <div className="error"><FaCircleExclamation /> {error}</div>}

          <PasswordChangeFields
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            currentPlaceholder={t('auth.forceChange.placeholderTemporal')}
            newPlaceholder={t('perfil.nuevaContrasena')}
            confirmPlaceholder={t('perfil.confirmarNuevaContrasena')}
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? t('perfil.password.guardando') : t('perfil.cambiarContrasena')}
          </button>

          <button type="button" className="login-logout" onClick={logout}>
            {t('nav.cerrarSesion')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CambioPasswordObligatorio;
