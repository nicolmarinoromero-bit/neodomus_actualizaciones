/**
 * Identidad visual de NEODOMUS (fuente de verdad: estilos globales de la WEB).
 * - Dorado principal #caa24d · variantes #c9a24c / #c9a227
 * - Negros: fondo #000, cards #161616/#1c1c1c, inputs #0f0f0f
 * - Éxito #7ee29a / online #46d06f · Error #f0858a
 * - Tipografías web: Inter (texto) y Montserrat (botones/etiquetas)
 */

import { Platform } from 'react-native';

/** Paleta Neodomus usada por las pantallas públicas. */
export const NeodomusColors = {
  oro: '#caa24d',
  oroClaro: '#d4a54b',
  oroSuave: '#f0c96f',
  oroFooter: '#c9a227',
  negro: '#000000',
  cardOscura: '#161616',
  cardOscuraAlt: '#1c1c1c',
  inputFondo: '#0f0f0f',
  textoSobreOro: '#141414',
  blanco: '#ffffff',
  grisTexto: '#bdbdbd',
  grisBorde: 'rgba(255,255,255,0.09)',
  bordeOro: 'rgba(212,165,75,0.28)',
  verdeExito: '#7ee29a',
  verdeOnline: '#46d06f',
  rojoError: '#f0858a',
  overlayHero: 'rgba(0,0,0,0.60)',
} as const;

/** Colores del tema claro/oscuro (plantilla Expo; usados por componentes themed). */
const tintColorLight = '#caa24d';
const tintColorDark = '#caa24d';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: 'SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
  },
});

/** Familias cargadas con expo-font (@expo-google-fonts) — mismas de la WEB. */
export const FontFamilies = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
  bodyBlack: 'Inter_900Black',
  button: 'Montserrat_600SemiBold',
};
