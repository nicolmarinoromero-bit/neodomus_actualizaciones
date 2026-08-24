import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import {
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CarritoProvider } from "@/contexts/CartContext";
import { FavoritosProvider } from "@/contexts/FavoritosContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { IdiomaProvider } from "@/contexts/IdiomaContext";

// La app arranca siempre en el grupo de tabs (experiencia pública).
export const unstable_settings = {
  anchor: "(tabs)",
};

/** Los favoritos dependen de la identidad: visitante o cuenta por correo. */
function ArbolFavoritos({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  return (
    <FavoritosProvider correoUsuario={usuario?.correo ?? null}>
      {children}
    </FavoritosProvider>
  );
}

function NavegacionRaiz() {
  const { cargando } = useAuth();
  const [fuentesCargadas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_900Black,
    Montserrat_600SemiBold,
  });

  // Mantiene el splash screen mientras se restaura sesión y cargan las fuentes.
  if (cargando || !fuentesCargadas) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      {/* Flujos de autenticación como MODALES sobre la pantalla actual:
          el contenido público permanece detrás y la X vuelve al punto exacto. */}
      <Stack.Screen
        name="login"
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <Stack.Screen
        name="registro"
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <Stack.Screen
        name="verificar-correo"
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <Stack.Screen
        name="recuperar-password"
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <Stack.Screen
        name="codigo-seguridad"
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <Stack.Screen
        name="nueva-password"
        options={{ presentation: "transparentModal", animation: "fade" }}
      />

      {/* Pantallas legales/públicas apiladas en el STACK raíz: el botón
          Atrás del sistema hace pop real al punto exacto de origen
          (Productos → Términos → Atrás → Productos). */}
      <Stack.Screen name="terminos" />
      <Stack.Screen name="privacidad" />
      <Stack.Screen name="cookies" />
      <Stack.Screen name="centro-privacidad" />
      <Stack.Screen name="contacto" />
      <Stack.Screen name="ayuda" />

      {/* ── Área USUARIO AUTENTICADO (stack raíz; Atrás real) ── */}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CarritoProvider>
        <ArbolFavoritos>
          {/* Banner/modal de cookies a nivel raíz: visible en toda la
              experiencia pública hasta que el usuario decida. */}
          <CookieConsentProvider>
            <IdiomaProvider>
              <NavegacionRaiz />
              <StatusBar style="light" />
            </IdiomaProvider>
          </CookieConsentProvider>
        </ArbolFavoritos>
      </CarritoProvider>
    </AuthProvider>
  );
}
