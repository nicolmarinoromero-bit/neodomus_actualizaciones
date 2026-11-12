import { PasswordInput } from './PasswordInput';

interface PasswordChangeFieldsProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  currentPlaceholder: string;
  newPlaceholder: string;
  confirmPlaceholder: string;
  disabled?: boolean;
}

export function PasswordChangeFields({
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  currentPlaceholder,
  newPlaceholder,
  confirmPlaceholder,
  disabled,
}: PasswordChangeFieldsProps) {
  return (
    <>
      <PasswordInput
        placeholder={currentPlaceholder}
        value={currentPassword}
        onChange={onCurrentPasswordChange}
        required
        autoComplete="current-password"
      />

      <PasswordInput
        placeholder={newPlaceholder}
        value={newPassword}
        onChange={onNewPasswordChange}
        required
        minLength={8}
        disabled={disabled}
        autoComplete="new-password"
      />

      <PasswordInput
        placeholder={confirmPlaceholder}
        value={confirmPassword}
        onChange={onConfirmPasswordChange}
        required
        disabled={disabled}
        autoComplete="new-password"
      />
    </>
  );
}
