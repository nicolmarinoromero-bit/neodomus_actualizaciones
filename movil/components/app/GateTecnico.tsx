// Controla el acceso al contenido reservado a la sesión del técnico.
import React, { type ReactNode } from "react";
import { useRouter } from "expo-router";
import PantallaAcceso from "@/components/app/PantallaAcceso";
import { useAuth } from "@/contexts/AuthContext";

export default function GateTecnico({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { cargando, autenticado, rol } = useAuth();
  const router = useRouter();
  const rolNorm = (rol || "").toLowerCase();
  const esTecnico = rolNorm === "tecnico";

  if (cargando) return null;

  if (!autenticado || !esTecnico) {
    return (
      <PantallaAcceso
        titulo={titulo}
        tituloAcceso="Acceso solo para técnicos"
        mensaje="Esta sección es exclusiva para técnicos autenticados de Neodomus."
        onIniciarSesion={() => router.replace("/login" as any)}
      />
    );
  }

  return <>{children}</>;
}
