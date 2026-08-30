import { apiFetch } from "./api";

export const obtenerDispositivos = async () => {
  return apiFetch("/dispositivos");
};

export const encenderDispositivo = async (id: number) => {
  return apiFetch(`/dispositivos/${id}/encender`, {
    method: "POST",
  });
};

export const apagarDispositivo = async (id: number) => {
  return apiFetch(`/dispositivos/${id}/apagar`, {
    method: "POST",
  });
};