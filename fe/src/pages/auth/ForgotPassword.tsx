
import "../../styles/forgot-password.css";
import { useState } from 'react';
import { useAuthModal } from '@contexts/AuthModalContext';
import api from '@services/api';


const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { openAuth } = useAuthModal();

  // Función handleSubmit correctamente definida dentro del componente
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Correo electrónico inválido');
      setLoading(false);
      return;
    }

    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Código enviado. Redirigiendo...');
      openAuth('verificar-codigo', { email });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Tarjeta del formulario (se muestra dentro del modal sobre el catálogo) */
    <form onSubmit={handleSubmit} className="forgot-card">
      {/* Icono Superior */}
          <div className="forgot-avatar-circle">
            <svg className="forgot-mail-svg" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <div className="lock-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          <h2>Recuperar contraseña</h2>
          <p className="forgot-instruction-text">
            Ingresa tu correo electrónico y te enviaremos un <span className="brand-gold">código</span> para restablecer tu contraseña.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}
          
          <div className="login-input-wrapper">
            <input 
              type="email" 
              placeholder="Tu correo electrónico" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              disabled={loading} 
            />
          </div>

          <button type="submit" className="btn-forgot-submit" disabled={loading}>
            <span>{loading ? 'Enviando...' : 'Enviar código'}</span>
          </button>

          <div className="forgot-security-notice">
            <p>Te enviaremos un <span className="brand-gold">código seguro</span> a tu correo.</p>
          </div>

          <div className="forgot-back-to-login">
            <button type="button" onClick={() => openAuth('ingresar')} className="forgot-back-link">
              ← Volver al inicio de sesión
            </button>
          </div>
        </form>
  );
};

export default ForgotPassword;