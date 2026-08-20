import {
  FaCircleCheck,
  FaTruckFast,
  FaPercent,
  FaArrowTrendUp,
  FaCircleInfo,
} from 'react-icons/fa6';
import { useIdioma } from '@i18n/IdiomaContext';
import '@styles/notificaciones.css';

type TipoNotificacion = 'confirmacion' | 'pedido' | 'promocion' | 'novedad' | 'sistema';

interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  fecha: string;
}

const TIPO_META: Record<TipoNotificacion, { icono: React.ReactNode; etiqueta: string; clase: string }> = {
  confirmacion: { icono: <FaCircleCheck />, etiqueta: 'Cita confirmada', clase: 'notif-confirmacion' },
  pedido: { icono: <FaTruckFast />, etiqueta: 'Estado de pedido', clase: 'notif-pedido' },
  promocion: { icono: <FaPercent />, etiqueta: 'Promoción', clase: 'notif-promocion' },
  novedad: { icono: <FaArrowTrendUp />, etiqueta: 'Novedad', clase: 'notif-novedad' },
  sistema: { icono: <FaCircleInfo />, etiqueta: 'Sistema', clase: 'notif-sistema' },
};

const NOTIFICACIONES: Notificacion[] = [
  {
    id: 1,
    tipo: 'confirmacion',
    titulo: 'Cita agendada con éxito',
    mensaje: 'Tu cita de instalación para el sábado 12 de septiembre a las 9:00 a. m. ha sido confirmada.',
    fecha: 'Hace 2 horas',
  },
  {
    id: 2,
    tipo: 'pedido',
    titulo: 'Tu pedido está en camino',
    mensaje: 'El pedido #NE-2041 con el kit de domótica fue despachado. Llegará en 2-3 días hábiles.',
    fecha: 'Ayer',
  },
  {
    id: 3,
    tipo: 'promocion',
    titulo: 'Descuento del 15% en sensores',
    mensaje: 'Solo esta semana, obtén un 15 % de descuento en toda la línea de sensores inteligentes.',
    fecha: 'Hace 2 días',
  },
  {
    id: 4,
    tipo: 'novedad',
    titulo: 'Nueva integración disponible',
    mensaje: 'Ya puedes conectar Neodomus con tu asistente de voz favorito con la última actualización.',
    fecha: 'Hace 3 días',
  },
  {
    id: 5,
    tipo: 'sistema',
    titulo: 'Mantenimiento programado',
    mensaje: 'El sistema estará en mantenimiento el domingo de 2:00 AM a 4:00 AM. Disculpa las molestias.',
    fecha: 'Hace 5 días',
  },
];

const ETIQUETA_TRAD: Record<TipoNotificacion, string> = {
  confirmacion: 'notif.etiquetaConfirmacion',
  pedido: 'notif.etiquetaPedido',
  promocion: 'notif.etiquetaPromocion',
  novedad: 'notif.etiquetaNovedad',
  sistema: 'notif.etiquetaSistema',
};

const Notificaciones = () => {
  const { t } = useIdioma();

  return (
    <main className="notif-page app-glass">
      <section className="notif-content">
        <header className="notif-header">
          <div>
            <h1>{t('notif.titulo')}</h1>
            <p>{t('notif.subtitulo')}</p>
          </div>
        </header>

        <div className="notif-list">
          {NOTIFICACIONES.map((notificacion) => {
            const meta = TIPO_META[notificacion.tipo];
            return (
              <article key={notificacion.id} className={`notif-item ${meta.clase}`}>
                <div className="notif-item-icon">{meta.icono}</div>
                <div className="notif-item-body">
                  <div className="notif-item-top">
                    <span className="notif-badge">{t(ETIQUETA_TRAD[notificacion.tipo])}</span>
                    <span className="notif-fecha">{notificacion.fecha}</span>
                  </div>
                  <h3 className="notif-titulo">{notificacion.titulo}</h3>
                  <p className="notif-mensaje">{notificacion.mensaje}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default Notificaciones;