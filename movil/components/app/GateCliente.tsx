// ─────────────────────────────────────────────────────────────
// GateCliente — protección REAL de rutas exclusivas del cliente:
// no basta con ocultar el tab; si un visitante accede directamente a la
// ruta (deep-link), se le muestra el flujo de acceso en lugar de la
// pantalla. Usa la fuente de autenticación EXISTENTE (AuthContext):
// - cargando → null (evita pestañas/parpadeos mientras se restaura la
//   sesión guardada en AsyncStorage).
// - visitante / no-cliente → pantalla "Inicia sesión para continuar"
//   con Iniciar sesión / Crear cuenta.
// - cliente autenticado → children.
// ─────────────────────────────────────────────────────────────

import React, { type ReactNode } from "react";
import { useRouter } from "expo-router";

import PantallaAcceso from "@/components/app/PantallaAcceso";
import { useAuth } from "@/contexts/AuthContext";

export default function GateCliente({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  const { cargando, autenticado, userType } = useAuth();
  const router = useRouter();

  if (cargando) return null;

  if (!autenticado || userType !== "client") {
    return (
      <PantallaAcceso
        titulo={titulo}
        tituloAcceso="Inicia sesión para continuar"
        mensaje={`${titulo} es una sección para usuarios con cuenta Neodomus verificada. Inicia sesión o crea tu cuenta para acceder.`}
        onIniciarSesion={() => router.push("/login")}
        onCrearCuenta={() => router.push("/registro")}
      />
    );
  }

  return <>{children}</>;
}
