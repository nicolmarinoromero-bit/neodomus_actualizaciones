// ─────────────────────────────────────────────────────────────
// Formulario "Enviar consulta" — adaptación móvil del tab de la
// AyudaPage WEB. Mismo endpoint POST /contacto, mismas
// validaciones y mensajes literales.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import { enviarConsulta } from "@/services/contacto.service";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIAS = [
  { valor: "consulta-general", label: "Consulta general" },
  { valor: "soporte-tecnico", label: "Soporte técnico" },
  { valor: "pedido", label: "Pedido" },
  { valor: "pago", label: "Pago" },
  { valor: "reembolso", label: "Reembolso" },
  { valor: "reclamo", label: "Reclamo" },
  { valor: "otro", label: "Otro" },
];

interface FormularioContactoProps {
  alEnviado?: (mensaje: string, tipo: "success" | "error") => void;
}

export default function FormularioContacto({ alEnviado }: FormularioContactoProps) {
  const { usuario } = useAuth();
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.correo ?? "");
  const [categoria, setCategoria] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setNombre((actual) => actual || usuario.nombre);
      setEmail((actual) => actual || usuario.correo);
    }
  }, [usuario]);

  const enviar = async () => {
    if (!nombre.trim() || !email.trim() || !mensaje.trim()) {
      alEnviado?.("Completa todos los campos", "error");
      return;
    }
    if (!email.includes("@")) {
      alEnviado?.("Email inválido", "error");
      return;
    }
    if (!categoria) {
      alEnviado?.("Selecciona la clasificación de tu consulta", "error");
      return;
    }

    setEnviando(true);
    try {
      await enviarConsulta({
        nombre: nombre.trim(),
        email: email.trim(),
        asunto:
          CATEGORIAS.find((item) => item.valor === categoria)?.label ??
          "Consulta",
        mensaje: mensaje.trim(),
        categoria,
      });
      alEnviado?.(
        "Tu consulta ha sido enviada. Te responderemos pronto.",
        "success",
      );
      setCategoria("");
      setMensaje("");
    } catch {
      alEnviado?.("Error al enviar. Intenta de nuevo.", "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Nombre completo *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ingresa tu nombre completo"
        placeholderTextColor="#8a8a8a"
        value={nombre}
        onChangeText={setNombre}
        editable={!enviando}
      />

      <Text style={styles.label}>Correo electrónico *</Text>
      <TextInput
        style={styles.input}
        placeholder="tucorreo@ejemplo.com"
        placeholderTextColor="#8a8a8a"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        editable={!enviando}
      />

      <Text style={styles.label}>Motivo de la consulta *</Text>
      <View style={styles.categoriasWrap}>
        {CATEGORIAS.map((item) => (
          <Pressable
            key={item.valor}
            onPress={() => setCategoria(item.valor)}
            disabled={enviando}
            style={[styles.chipCategoria, categoria === item.valor && styles.chipCategoriaActiva]}
          >
            <Text
              style={[
                styles.chipCategoriaTexto,
                categoria === item.valor && styles.chipCategoriaTextoActivo,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Mensaje *</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Describe tu consulta, problema o sugerencia con el mayor detalle posible..."
        placeholderTextColor="#8a8a8a"
        value={mensaje}
        onChangeText={setMensaje}
        multiline
        textAlignVertical="top"
        editable={!enviando}
        maxLength={2000}
      />
      <Text style={styles.hint}>Mínimo 30 caracteres</Text>

      <Pressable
        style={({ pressed }) => [
          styles.boton,
          pressed && styles.presionado,
          enviando && styles.deshabilitado,
        ]}
        onPress={() => void enviar()}
        disabled={enviando}
      >
        <Text style={styles.textoBoton}>
          {enviando ? "Enviando..." : "Enviar consulta"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: C.cardOscura,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.grisBorde,
    padding: 16,
    gap: 6,
  },

  label: {
    color: C.blanco,
    fontSize: 13.5,
    fontFamily: FontFamilies.bodyBold,
    marginTop: 8,
  },

  input: {
    backgroundColor: C.inputFondo,
    borderWidth: 1,
    borderColor: C.grisBorde,
    borderRadius: 12,
    color: C.blanco,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    fontFamily: FontFamilies.body,
    minHeight: 46,
  },

  textarea: {
    minHeight: 110,
    paddingTop: 12,
  },

  hint: {
    color: C.grisTexto,
    fontSize: 11.5,
    marginTop: -2,
  },

  categoriasWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 4,
  },

  chipCategoria: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(212,165,75,0.06)",
    paddingVertical: 7,
    paddingHorizontal: 12,
  },

  chipCategoriaActiva: {
    backgroundColor: C.oro,
    borderColor: C.oro,
  },

  chipCategoriaTexto: {
    color: C.oroSuave,
    fontSize: 12.5,
    fontFamily: FontFamilies.bodyMedium,
  },

  chipCategoriaTextoActivo: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
  },

  boton: {
    backgroundColor: "#d4a54b",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },

  deshabilitado: { opacity: 0.6 },

  presionado: { opacity: 0.85 },

  textoBoton: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
    fontSize: 14,
  },
});
