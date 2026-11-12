// Pantalla ChangePassword de Neodomus. Reúne el estado y las acciones de su vista.
import { useIdioma } from '@i18n/IdiomaContext';
import { PasswordChangeFields } from '@components/common/PasswordChangeFields';
import { useCambioPassword } from '../../hooks/useCambioPassword';
import '@styles/login.css'; // Reutiliza estilos del login (ajusta si quieres uno específico)

const ChangePassword = () => {
  const { t } = useIdioma();
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    message,
    error,
    loading,
    handleSubmit,
  } = useCambioPassword({
    errorNoCoinciden: t('auth.changePassword.errorNoCoinciden'),
    errorRequisitos: t('auth.changePassword.errorRequisitos'),
    errorMismaActual: t('perfil.password.diferenteActual'),
    errorGeneral: t('auth.changePassword.errorGeneral'),
    mensajeExito: t('perfil.contrasenaActualizada'),
    duracionMensajeMs: 5000,
  });

  return (
    <>
      <div className="login-container">
        <form onSubmit={handleSubmit} className="login-form">
          <h2>{t('perfil.cambiarContrasena')}</h2>
          {message && <div className="success">{message}</div>}
          {error && <div className="error">{error}</div>}

          <PasswordChangeFields
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            currentPlaceholder={t('perfil.contrasenaActual')}
            newPlaceholder={t('perfil.nuevaContrasena')}
            confirmPlaceholder={t('perfil.confirmarNuevaContrasena')}
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? t('auth.changePassword.actualizando') : t('auth.changePassword.actualizar')}
          </button>
        </form>
      </div>
    </>
  );
};

export default ChangePassword;
