import type { RefObject } from 'react';
import { FaCamera, FaTrashCan } from 'react-icons/fa6';
import { getIniciales } from '@utils/profileStorage';

interface AvatarZoneProps {
  avatar: string | null;
  /** Nombre completo del usuario del que se derivan las iniciales. */
  nombreCompleto: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEliminar: () => void;
  altFoto: string;
  ariaCambiar: string;
  titulo: string;
  hint: string;
  cambiar: string;
  eliminar: string;
}

// Zona de foto de perfil: avatar grande con iniciales de respaldo, botón de cámara
// y acciones de cambio/eliminación de foto. Compartida por las pantallas de perfil
// de cliente, administrador y la pestaña personal.
export function AvatarZone({
  avatar,
  nombreCompleto,
  fileInputRef,
  onFileChange,
  onEliminar,
  altFoto,
  ariaCambiar,
  titulo,
  hint,
  cambiar,
  eliminar,
}: AvatarZoneProps) {
  return (
    <div className="pf-avatar-zone">
      <div className="pf-avatar-big">
        {avatar ? (
          <img src={avatar} alt={altFoto} />
        ) : (
          <span className="pf-avatar-iniciales" aria-hidden="true">{getIniciales(nombreCompleto)}</span>
        )}
        <button
          type="button"
          className="pf-avatar-camera"
          aria-label={ariaCambiar}
          onClick={() => fileInputRef.current?.click()}
        >
          <FaCamera />
        </button>
      </div>
      <div className="pf-avatar-text">
        <strong>{titulo}</strong>
        <span>{hint}</span>
        <button
          type="button"
          className="pf-btn pf-btn-ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          <FaCamera /> {cambiar}
        </button>
        {avatar && (
          <button type="button" className="pf-btn pf-btn-danger" onClick={onEliminar}>
            <FaTrashCan /> {eliminar}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
