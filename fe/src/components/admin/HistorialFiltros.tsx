import { FaMagnifyingGlass } from 'react-icons/fa6';

interface HistorialFiltrosProps {
  busqueda: string;
  onBusqueda: (valor: string) => void;
  desde: string;
  onDesde: (valor: string) => void;
  hasta: string;
  onHasta: (valor: string) => void;
  separador?: string;
}

// Barra de filtros de los modales de historial (búsqueda textual + rango de fechas).
// Compartida por los paneles de clientes y técnicos.
export function HistorialFiltros({ busqueda, onBusqueda, desde, onDesde, hasta, onHasta, separador = '—' }: HistorialFiltrosProps) {
  return (
    <div className="ap-historial-filtros">
      <form className="ap-search" onSubmit={(e) => e.preventDefault()} style={{ flex: 1, minWidth: 180 }}>
        <FaMagnifyingGlass />
        <input
          type="text"
          placeholder="Buscar..."
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
        />
      </form>
      <input
        type="date"
        className="ap-form-input"
        value={desde}
        onChange={(e) => onDesde(e.target.value)}
        style={{ width: 150, fontSize: 12 }}
      />
      <span style={{ color: '#9a8e7e' }}>{separador}</span>
      <input
        type="date"
        className="ap-form-input"
        value={hasta}
        onChange={(e) => onHasta(e.target.value)}
        style={{ width: 150, fontSize: 12 }}
      />
    </div>
  );
}
