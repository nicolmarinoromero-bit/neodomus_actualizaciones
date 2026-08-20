import { useEffect, useState } from 'react';
import { FaStar, FaCircleCheck } from 'react-icons/fa6';
import { useIdioma } from '@i18n/IdiomaContext';
import api from '@services/api';
import '@styles/calificacion-obligatoria.css';

interface CitaPendiente {
  id_cita: number;
  tipo_servicio: string;
  fecha: string;
  hora: string;
  tecnico_nombre: string | null;
  id_tecnico: number;
}

interface Props {
  onCalificado?: () => void;
}

const CalificacionObligatoriaModal = ({ onCalificado }: Props) => {
  const { idioma } = useIdioma();
  const [cita, setCita] = useState<CitaPendiente | null>(null);
  const [loading, setLoading] = useState(true);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const verificarPendiente = async () => {
    try {
      const { data } = await api.get('/calificaciones/pendiente');
      if (data.pendiente) {
        setCita(data);
      } else {
        setCita(null);
      }
    } catch {
      // Silently fail — modal simply won't show
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verificarPendiente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviarCalificacion = async () => {
    if (!cita || estrellas < 1 || estrellas > 5) {
      setError(idioma === 'en' ? 'Select a rating from 1 to 5 stars' : 'Selecciona una calificación de 1 a 5 estrellas');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await api.post('/calificaciones', {
        id_cita: cita.id_cita,
        calificacion: estrellas,
        comentario: comentario.trim() || undefined,
      });
      setExito(true);
      setTimeout(() => {
        setCita(null);
        setExito(false);
        setEstrellas(0);
        setComentario('');
        onCalificado?.();
      }, 1800);
    } catch (err: any) {
      setError(err.response?.data?.detail || (idioma === 'en' ? 'Could not save rating' : 'No se pudo guardar la calificación'));
    } finally {
      setEnviando(false);
    }
  };

  if (loading || !cita) return null;

  return (
    <div className="calif-obl-overlay">
      <div className="calif-obl-modal">
        {exito ? (
          <div className="calif-obl-exito">
            <FaCircleCheck className="calif-obl-exito-icon" />
            <h2>{idioma === 'en' ? 'Thank you!' : '¡Gracias!'}</h2>
            <p>{idioma === 'en' ? 'Your rating has been saved.' : 'Tu calificación ha sido guardada.'}</p>
          </div>
        ) : (
          <>
            <div className="calif-obl-icon">
              <FaStar />
            </div>
            <h2 className="calif-obl-title">
              {idioma === 'en' ? 'Rate the technician' : 'Califica al técnico'}
            </h2>
            <p className="calif-obl-subtitle">
              {idioma === 'en'
                ? 'Your service has been completed. To continue navigating, you must rate the technician.'
                : 'Tu servicio ha sido completado. Para seguir navegando, debes calificar al técnico.'}
            </p>

            <div className="calif-obl-cita-info">
              <span className="calif-obl-servicio">{cita.tipo_servicio}</span>
              <span className="calif-obl-detalle">{cita.fecha} · {cita.hora}</span>
              {cita.tecnico_nombre && (
                <span className="calif-obl-tecnico">
                  {idioma === 'en' ? 'Technician:' : 'Técnico:'} {cita.tecnico_nombre}
                </span>
              )}
            </div>

            <div className="calif-obl-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`calif-obl-star ${n <= estrellas ? 'active' : ''}`}
                  onClick={() => setEstrellas(n)}
                  aria-label={`${n} ${idioma === 'en' ? 'stars' : 'estrellas'}`}
                >
                  <FaStar />
                </button>
              ))}
            </div>
            {estrellas > 0 && (
              <p className="calif-obl-star-label">
                {estrellas === 1 && (idioma === 'en' ? 'Poor' : 'Malo')}
                {estrellas === 2 && (idioma === 'en' ? 'Fair' : 'Regular')}
                {estrellas === 3 && (idioma === 'en' ? 'Good' : 'Bueno')}
                {estrellas === 4 && (idioma === 'en' ? 'Very good' : 'Muy bueno')}
                {estrellas === 5 && (idioma === 'en' ? 'Excellent' : 'Excelente')}
              </p>
            )}

            <textarea
              className="calif-obl-textarea"
              rows={3}
              placeholder={idioma === 'en' ? 'Comment (optional)...' : 'Comentario (opcional)...'}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
            />

            {error && <div className="calif-obl-alert error">{error}</div>}

            <button
              type="button"
              className="calif-obl-btn"
              disabled={estrellas < 1 || enviando}
              onClick={enviarCalificacion}
            >
              {enviando
                ? (idioma === 'en' ? 'Submitting...' : 'Enviando...')
                : (idioma === 'en' ? 'Submit rating' : 'Enviar calificación')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CalificacionObligatoriaModal;
