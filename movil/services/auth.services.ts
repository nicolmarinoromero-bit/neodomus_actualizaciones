import { apiFetch } from "./api";

export const login = async (
  correo: string,
  password: string
) => {
  return apiFetch("/login", {
    method: "POST",
    body: JSON.stringify({
      correo,
      password,
    }),
  });
};