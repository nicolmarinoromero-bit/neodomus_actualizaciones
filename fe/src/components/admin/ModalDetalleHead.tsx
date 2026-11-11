import { FaXmark } from 'react-icons/fa6';

interface ModalDetalleHeadProps {
  titulo: React.ReactNode;
  estado: string;
  claseEstado: string;
  fechaTexto?: React.ReactNode;
  onCerrar: () => void;
}

// Encabezado de los modales de detalle de novedades (título, badge de estado,
// fecha opcional y botón de cierre). Compartido por los paneles admin, técnico y cliente.
export function ModalDetalleHead({ titulo, estado, claseEstado, fechaTexto, onCerrar }: ModalDetalleHeadProps) {
  return (
    <div className="ap-modal-head" style={{ padding: 0 }}>
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <span style={{ color: '#d4a54b' }}>{titulo}</span>
          <span className={`ap-badge ${claseEstado}`}>{estado}</span>
        </h3>
        {fechaTexto && (
          <p style={{ margin: '4px 0 0', color: '#8f8f8f', fontSize: '0.82rem' }}>
            {fechaTexto}
          </p>
        )}
      </div>
      <button type="button" className="ap-modal-x" onClick={onCerrar}>
        <FaXmark />
      </button>
    </div>
  );
}
