import { useEffect, useState } from 'react';
import { FaEnvelope, FaPhone, FaScrewdriverWrench, FaWhatsapp } from 'react-icons/fa6';
import api from '@services/api';
import SectionHeader from './SectionHeader';

const TIPO_SERVICIO: Record<string, string> = {
  instalacion: 'Instalación',
  reparacion: 'Reparación',
  mantenimiento: 'Mantenimiento',
  revision: 'Revisión técnica',
  soporte: 'Soporte',
};

interface CitaFinalizada {
  id_cita: number;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  id_tecnico_2?: number | null;
  nombre_tecnico_2?: string | null;
  tecnico_nombre?: string | null;
  tecnico_2_nombre?: string | null;
  tecnico_telefono?: number | null;
  tecnico_email?: string | null;
  tecnico_foto_url?: string | null;
  tecnico_certificacion?: string | null;
  tecnico_cargo?: string | null;
  tipo_servicio: string;
  estado: string;
}

interface TecnicoAtencion {
  id: string;
  nombre: string;
  especialidad: string;
  trabajos: number;
  telefono: string;
  email?: string | null;
  foto_url?: string | null;
}

const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const TechniciansTab = () => {
  const [tecnicos, setTecnicos] = useState<TecnicoAtencion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const res = await api.get<CitaFinalizada[]>('/citas/mis-citas');
        const citas = Array.isArray(res.data) ? res.data : [];
        const finalizadas = citas.filter(
          (c) => c.estado === 'Finalizada' && (c.id_tecnico || c.id_tecnico_2),
        );
        const mapa = new Map<string, TecnicoAtencion>();
        finalizadas.forEach((c) => {
          const agregar = (
            id: number,
            nombreCapturado: string | null | undefined,
            nombreReal: string | null | undefined,
            telefono: number | null | undefined,
            email: string | null | undefined,
            foto: string | null | undefined,
            certificacion: string | null | undefined,
            cargo: string | null | undefined,
          ) => {
            const clave = String(id);
            const actual = mapa.get(clave);
            const nombre = nombreReal || nombreCapturado || actual?.nombre || '';
            if (!nombre) return;
            mapa.set(clave, {
              id: clave,
              nombre,
              especialidad:
                certificacion || cargo || actual?.especialidad || TIPO_SERVICIO[c.tipo_servicio] || c.tipo_servicio,
              trabajos: (actual?.trabajos ?? 0) + 1,
              telefono: telefono?.toString() ?? actual?.telefono ?? '',
              email: email ?? actual?.email ?? null,
              foto_url: foto ?? actual?.foto_url ?? null,
            });
          };
          if (c.id_tecnico) {
            agregar(
              c.id_tecnico,
              c.nombre_tecnico,
              c.tecnico_nombre,
              c.tecnico_telefono,
              c.tecnico_email,
              c.tecnico_foto_url,
              c.tecnico_certificacion,
              c.tecnico_cargo,
            );
          }
          if (c.id_tecnico_2) {
            agregar(
              c.id_tecnico_2,
              c.nombre_tecnico_2,
              c.tecnico_2_nombre,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
            );
          }
        });
        if (activo) setTecnicos(Array.from(mapa.values()));
      } catch (err) {
        console.error('Error cargando técnicos:', err);
        if (activo) setTecnicos([]);
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

  return (
    <div className="pf-tab">
      <SectionHeader
        icon={<FaScrewdriverWrench />}
        title="Mis técnicos"
        subtitle="Técnicos que ya han realizado servicios en tu hogar."
      />

      {loading ? (
        <div className="pf-empty">
          <p>Cargando tus técnicos...</p>
        </div>
      ) : tecnicos.length === 0 ? (
        <div className="pf-empty">
          <span className="pf-empty-icon"><FaScrewdriverWrench /></span>
          <p>Aún no tienes técnicos que te hayan atendido. Cuando un técnico finalice un servicio en tu hogar aparecerá aquí.</p>
        </div>
      ) : (
        <div className="pf-tech-grid">
          {tecnicos.map((tecnico) => (
            <div className="pf-tech-card" key={tecnico.id}>
              <div className="pf-tech-head">
                <span className="pf-tech-avatar">
                  {tecnico.foto_url ? (
                    <img
                      src={tecnico.foto_url}
                      alt={tecnico.nombre}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    initials(tecnico.nombre)
                  )}
                </span>
                <div className="pf-tech-info">
                  <strong className="pf-tech-name">{tecnico.nombre}</strong>
                  <span className="pf-tech-spec">{tecnico.especialidad}</span>
                </div>
              </div>

              <div className="pf-tech-stats">
                <span className="pf-tech-stat">
                  <FaScrewdriverWrench /> {tecnico.trabajos} <span>servicios</span>
                </span>
                {tecnico.email ? (
                  <span className="pf-tech-stat" title={tecnico.email}>
                    <FaEnvelope /> {tecnico.email}
                  </span>
                ) : null}
              </div>

              <div className="pf-tech-actions">
                {tecnico.telefono ? (
                  <a className="pf-btn pf-btn-ghost" href={`tel:+57${tecnico.telefono.replace(/\D/g, '')}`}>
                    <FaPhone /> Llamar
                  </a>
                ) : null}
                {tecnico.telefono ? (
                  <a
                    className="pf-btn pf-btn-ghost"
                    href={`https://wa.me/57${tecnico.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaWhatsapp /> Mensaje
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TechniciansTab;