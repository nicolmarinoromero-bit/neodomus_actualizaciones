export const PASSWORD_REGEX =
  /^(?=[^a-z]*[a-z])(?=[^A-Z]*[A-Z])(?=\D*\d)(?=[^!@#$%^&*(),.?":{}|<>]*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

export function cumpleRequisitosPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}
