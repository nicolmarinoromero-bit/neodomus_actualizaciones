import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import api from '@services/api';
import { cumpleRequisitosPassword } from '@utils/password';

interface UseCambioPasswordOptions {
  errorNoCoinciden: string;
  errorRequisitos: string;
  errorMismaActual: string;
  errorGeneral: string;
  mensajeExito?: string;
  duracionMensajeMs?: number;
  onSuccess?: () => void;
}

export function useCambioPassword({
  errorNoCoinciden,
  errorRequisitos,
  errorMismaActual,
  errorGeneral,
  mensajeExito,
  duracionMensajeMs,
  onSuccess,
}: UseCambioPasswordOptions) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!duracionMensajeMs || (!message && !error)) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, duracionMensajeMs);
    return () => clearTimeout(timer);
  }, [message, error, duracionMensajeMs]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError(errorNoCoinciden);
      return;
    }
    if (!cumpleRequisitosPassword(newPassword)) {
      setError(errorRequisitos);
      return;
    }
    if (currentPassword === newPassword) {
      setError(errorMismaActual);
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (mensajeExito) setMessage(mensajeExito);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || errorGeneral;
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    message,
    error,
    loading,
    handleSubmit,
  };
}
