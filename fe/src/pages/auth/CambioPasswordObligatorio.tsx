// Solicita cambiar la contraseña cuando la cuenta requiere actualizarla antes de continuar.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaKey, FaCircleExclamation } from 'react-icons/fa6';
import { useAuth } from '@contexts/AuthContext';
import api from '@services/api';
import { useIdioma } from '@i18n/IdiomaContext';
import { PasswordInput } from '@components/common/PasswordInput';
import '@styles/login.css';

// Comunica con el backend mediante POST '/auth/change-password'.
const CambioPasswordObligatorio = () => {
  const navigate = useNavigate();
  const { rol, logout, setPasswordResetRequired } = useAuth();
  const { t } = useIdioma();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Comunica con el backend mediante POST '/auth/change-password'.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('auth.forceChange.errorNoCoinciden'));
      return;
    }
    if (!/^(?=[^a-z]*[a-z])(?=[^A-Z]*[A-Z])(?=\D*\d)(?=[^!@#$%^&*(),.?":{}|<>]*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(newPassword)) {
      setError(t('auth.forceChange.errorRequisitos'));
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
      setPasswordResetRequired(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (rol === 'administrador' || rol === 'admin') {
        navigate('/dashboard/admin', { replace: true });
      } else {
        navigate('/dashboard/tecnico', { replace: true });
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || t('perfil.errorCambiarContrasena');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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

          <PasswordInput
            placeholder={t('auth.forceChange.placeholderTemporal')}
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