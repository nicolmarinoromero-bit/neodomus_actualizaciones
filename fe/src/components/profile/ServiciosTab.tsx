import { useEffect, useState } from 'react';
import {
  FaCalendarCheck,
  FaCircleCheck,
  FaLocationDot,
  FaPhone,
  FaScrewdriverWrench,
} from 'react-icons/fa6';
import api from '@services/api';
import SectionHeader from './SectionHeader';

const TIPO_SERVICIO: Record<string, string> = {
  instalacion: 'Instalación',
  reparacion: 'Reparación',
  mantenimiento: 'Mantenimiento',
  revision: 'Revisión técnica',
  soporte: 'Soporte',
};

interface CitaCliente {
  id_cita: number;
  estado: string;
  tipo_servicio: string;
  fecha: string;
  hora: string;
  direccion: string;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  tecnico_nombre?: string | null;
  tecnico_telefono?: number | null;
  tecnico_email?: string | null;
  tecnico_foto_url?: string | null;
  tecnico_certificacion?: string | null;
}

const hoyISO = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};

const formatearFecha = (fecha: string) => {
  try {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
};

const estadoClase = (estado: string) => {
  switch (estado) {
    case 'Finalizada':
      return 'ok';
    case 'Cancelada':
      return 'err';
    case 'Confirmada':
      return 'info';
    default:
      return 'pendiente';
  }
};

type CitaOrdenada = CitaCliente & { esPasada: boolean };

const ServiciosTab = () => {
  const [citas, setCitas] = useState<CitaOrdenada[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const res = await api.get<CitaCliente[]>('/citas/mis-citas');
        const hoy = hoyISO();
        const ordenadas: CitaOrdenada[] = (Array.isArray(res.data) ? res.data : [])
          .map((c) => ({ ...c, esPasada: c.fecha < hoy }))
          .sort((a, b) => {
            if (a.esPasada !== b.esPasada) return a.esPasada ? 1 : -1;
            if (a.esPasada) return b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora);
            return a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora);
          });
        if (activo) setCitas(ordenadas);
      } catch (err) {
        console.error('Error cargando servicios:', err);
        if (activo) setCitas([]);
      } finally {
        if (activo) setLoading(false);
      }
    };
    cargar();
    const interval = setInterval(cargar, 60000);
    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, []);

  const pasosDe = (c: CitaCliente) => [
    { paso: 'Solicitud registrada', completado: true },
    {
      paso: 'Técnico asignado',
      completado: Boolean(c.id_tecnico || c.nombre_tecnico || c.tecnico_nombre),
    },
    {
      paso: 'Cita confirmada',
      completado: c.estado === 'Confirmada' || c.estado === 'Finalizada',
    },
    { paso: 'Servicio realizado', completado: c.estado === 'Finalizada' },
  ];

  return (
    <div className="pf-tab">
      <SectionHeader
        icon={<FaScrewdriverWrench />}
        title="Mis servicios"
        subtitle="Rastrea el estado de tus citas y servicios técnicos en tiempo real."
      />

      {loading ? (
        <div className="pf-empty">
          <p>Cargando tus servicios...</p>
        </div>
      ) : citas.length === 0 ? (
        <div className="pf-empty">
          <span className="pf-empty-icon"><FaCalendarCheck /></span>
          <p>No tienes servicios agendados. Cuando solicites una cita aparecerá aquí.</p>
        </div>
      ) : (
        <div className="pf-orders-list">
          {citas.map((cita) => {
            const abierta = expandida === cita.id_cita;
            const pasos = pasosDe(cita);
            const nombreTecnico =
              cita.tecnico_nombre || cita.nombre_tecnico || 'Por asignar';
            return (
              <div className="pf-order" key={cita.id_cita}>
                <div className="pf-order-top">
                  <div className="pf-order-id-col">
                    <span className="pf-order-id">#{cita.id_cita}</span>
                    <span className="pf-order-folio">
                      {TIPO_SERVICIO[cita.tipo_servicio] || cita.tipo_servicio}
                      {` · ${formatearFecha(cita.fecha)} · ${cita.hora}`}
                    </span>
                  </div>
                  <div className="pf-order-stats">
                    <span className={`pf-status-badge ${estadoClase(cita.estado)}`}>
                      {cita.estado}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="pf-order-toggle"
                  onClick={() => setExpandida(abierta ? null : cita.id_cita)}
                  aria-expanded={abierta}
                >
                  <FaLocationDot />
                  <span>{abierta ? 'Ocultar rastreo del servicio' : 'Rastrear mi servicio'}</span>
                </button>

                {abierta && (
                  <div className="pf-order-details">
                    <div className="pf-detail-block">
                      <h4 className="pf-detail-title">Detalle del servicio</h4>
                      <div className="pf-detail-grid">
                        <div className="pf-detail-row">
                          <span className="pf-detail-label">Tipo de servicio</span>
                          <span className="pf-detail-value">
                            {TIPO_SERVICIO[cita.tipo_servicio] || cita.tipo_servicio}
                          </span>
                        </div>
                        <div className="pf-detail-row">
                          <span className="pf-detail-label">Fecha y hora</span>
                          <span className="pf-detail-value">
                            {formatearFecha(cita.fecha)} · {cita.hora}
                          </span>
                        </div>
                        <div className="pf-detail-row pf-detail-row-wide">
                          <span className="pf-detail-label">Dirección</span>
                          <span className="pf-detail-value">{cita.direccion || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pf-detail-block">
                      <h4 className="pf-detail-title">Técnico asignado</h4>
                      {cita.id_tecnico || cita.nombre_tecnico || cita.tecnico_nombre ? (
                        <div className="pf-detail-grid">
                          <div className="pf-detail-row">
                            <span className="pf-detail-label">Técnico</span>
                            <span className="pf-order-tecnico-entrega">
                              {cita.tecnico_foto_url && (
                                <img
                                  src={cita.tecnico_foto_url}
                                  alt={nombreTecnico}
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                              {nombreTecnico}
                            </span>
                          </div>
                          {cita.tecnico_certificacion && (
                            <div className="pf-detail-row">
                              <span className="pf-detail-label">Especialidad</span>
                              <span className="pf-detail-value">
                                {cita.tecnico_certificacion}
                              </span>
                            </div>
                          )}
                          {cita.tecnico_telefono ? (
                            <div className="pf-detail-row">
                              <span className="pf-detail-label">Teléfono</span>
                              <span className="pf-detail-value">
                                <FaPhone style={{ marginRight: 6 }} />
                                {cita.tecnico_telefono}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="pf-tracker-actualizado">
                          Aún no hay técnico asignado. Te notificaremos en cuanto se realice la asignación.
                        </p>
                      )}
                    </div>

                    {cita.estado === 'Cancelada' ? (
                      <div className="pf-detail-block">
                        <h4 className="pf-detail-title">Rastreo</h4>
                        <p className="pf-tracker-actualizado">
                          Esta cita fue cancelada. Puedes solicitar una nueva cuando quieras.
                        </p>
                      </div>
                    ) : (
                      <div className="pf-detail-block">
                        <h4 className="pf-detail-title">Rastreo del servicio</h4>
                        <div className="pf-tracker">
                          <div className="pf-tracker-pasos">
                            {pasos.map((p) => (
                              <div
                                key={p.paso}
                                className={`pf-tracker-paso ${p.completado ? 'done' : ''}`}
                              >
                                <span className="pf-tracker-dot">
                                  {p.completado ? <FaCircleCheck /> : null}
                                </span>
                                <span>{p.paso}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServiciosTab;
