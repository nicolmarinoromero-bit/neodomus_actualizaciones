import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
}

// Campo de contraseña con botón para mostrar/ocultar el valor.
// Compartido por los formularios de cambio de contraseña.
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
  disabled,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="login-input-wrapper">
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <button type="button" className="login-password-toggle" onClick={() => setVisible(!visible)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {visible ? (
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          ) : (
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          )}
        </svg>
      </button>
    </div>
  );
}
