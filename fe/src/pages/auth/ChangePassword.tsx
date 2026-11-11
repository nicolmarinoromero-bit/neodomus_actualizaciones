// Pantalla ChangePassword de Neodomus. Reúne el estado y las acciones de su vista.
import { useState, useEffect } from 'react';
import api from '@services/api';
import { useIdioma } from '@i18n/IdiomaContext';
import { PasswordInput } from '@components/common/PasswordInput';
import '@styles/login.css'; // Reutiliza estilos del login (ajusta si quieres uno específico)

const ChangePassword = () => {
  const { t } = useIdioma();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Limpiar mensajes después de 5 segundos
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // Comunica con el backend mediante POST '/auth/change-password'.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Validaciones adicionales
    if (newPassword !== confirmPassword) {
      setError(t('auth.changePassword.errorNoCoinciden'));
      return;
    }
    if (!/^(?=[^a-z]*[a-z])(?=[^A-Z]*[A-Z])(?=\D*\d)(?=[^!@#$%^&*(),.?":{}|<>]*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(newPassword)) {
      setError(t('auth.changePassword.errorRequisitos'));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t('perfil.password.diferenteActual'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage(t('perfil.contrasenaActualizada'));
      // Limpiar formulario
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || t('auth.changePassword.errorGeneral');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-container">
        <form onSubmit={handleSubmit} className="login-form">
          <h2>{t('perfil.cambiarContrasena')}</h2>
          {message && <div className="success">{message}</div>}
          {error && <div className="error">{error}</div>}
          
          <PasswordInput
            placeholder={t('perfil.contrasenaActual')}
            value={currentPassword}
            onChange={setCurrentPassword}
            required
            autoComplete="current-password"
          />

          <PasswordInput
            placeholder={t('perfil.nuevaContrasena')}
            value={newPassword}
            onChange={setNewPassword}
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
          />

          <PasswordInput
            placeholder={t('perfil.confirmarNuevaContrasena')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            disabled={loading}
            autoComplete="new-password"
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