// Semana 2 del bootcamp — unitarias de la lógica de traducción (AAA).
// `construirT` y `traducirMensajeNotificacion` son lógica real del frontend:
// fallback de idioma, sustitución de variables y localización de
// notificaciones parametrizadas sin tocar el dato de origen.
import { describe, expect, it } from 'vitest';
import {
  construirT,
  traducirMensajeNotificacion,
} from './translations';
import { translateLocalizedMessage } from './translateLocalizedMessage';

describe('construirT', () => {
  it('traduce a español e inglés una clave existente', () => {
    // Arrange
    const tEs = construirT('es');
    const tEn = construirT('en');
    // Act / Assert
    expect(tEs('nav.inicio')).toBe('Inicio');
    expect(tEn('nav.inicio')).toBe('Home');
  });

  it('devuelve la clave como texto cuando no existe (fallback seguro)', () => {
    // Arrange
    const t = construirT('es');
    // Act
    const texto = t('clave.que.no.existe');
    // Assert: nunca explota ni devuelve undefined.
    expect(texto).toBe('clave.que.no.existe');
  });

  it('sustituye variables {nombre} en la plantilla', () => {
    // Arrange
    const t = construirT('en');
    // Act
    const texto = t('notif.sinLeer', { count: 3 });
    // Assert
    expect(texto).toBe('3 unread');
  });

  it('sustituye todas las apariciones repetidas de la variable', () => {
    // Arrange
    const t = construirT('es');
    // Act
    const texto = t('notif.msg.citaReagendada', {
      servicio: 'Instalación', fecha: '13/11', hora: '10:00', tecnico: 'Ana',
    });
    // Assert: ninguna plantilla queda sin resolver.
    expect(texto).not.toMatch(/\{(servicio|fecha|hora|tecnico)\}/);
    expect(texto).toContain('Instalación');
    expect(texto).toContain('Ana');
  });

  it('con idioma desconocido cae al español', () => {
    // Arrange
    const t = construirT('fr');
    // Act / Assert: tabla[fr] no existe → tabla.es.
    expect(t('nav.inicio')).toBe('Inicio');
  });
});

describe('traducirMensajeNotificacion (mensajes parametrizados)', () => {
  const pedidoRegistrado = 'Tu pedido #91 por $45.5 fue registrado con estado: Pagado. Te mantendremos informado sobre cada cambio de estado.';

  it('en español el mensaje queda intacto (dato de origen)', () => {
    // Act / Assert
    expect(traducirMensajeNotificacion(pedidoRegistrado, 'es')).toBe(pedidoRegistrado);
  });

  it('en inglés traduce el mensaje parametrizado conservando los valores', () => {
    // Act
    const traducido = traducirMensajeNotificacion(pedidoRegistrado, 'en');
    // Assert: traducción con los valores reales incrustados, sin huecos.
    expect(traducido).toBe(
      'Your order #91 for $45.5 was placed with status: Pagado. We will keep you updated on its status.',
    );
  });

  it('un mensaje que no casa con ninguna plantilla se sustituye frase a frase', () => {
    // Arrange: un mensaje compuesto cuyo prefijo está en el diccionario.
    const mensaje = 'Pago confirmado - Pedido #7';
    // Act
    const traducido = traducirMensajeNotificacion(mensaje, 'en');
    // Assert
    expect(traducido).toBe('Payment confirmed - Order #7');
  });

  it('un mensaje con frases conocidas se sustituye frase a frase', () => {
    // Arrange: la frase "Mensaje" existe en el diccionario como palabra fija.
    // Act
    const traducido = traducirMensajeNotificacion('Mensaje inexistente', 'en');
    // Assert: el fallback frase-a-frase reemplaza lo conocido y conserva lo demás.
    expect(traducido).toBe('Message inexistente');
  });

  it('un mensaje sin ninguna frase conocida se devuelve sin cambios', () => {
    // Act / Assert
    expect(traducirMensajeNotificacion('Qwertyzz nada relacionado', 'en')).toBe('Qwertyzz nada relacionado');
  });
});

describe('translateLocalizedMessage (parser de plantillas)', () => {
  const diccionario = {
    saludo: { es: 'Hola {nombre}, tu cita es el {fecha}', en: 'Hello {nombre}, your appointment is on {fecha}' },
    corto: { es: 'Pedido #{id}', en: 'Order #{id}' },
    fijo: { es: 'Gracias por tu compra', en: 'Thanks for your purchase' },
  };

  it('extrae variables de una plantilla con dos huecos', () => {
    // Act / Assert
    expect(translateLocalizedMessage('Hola Ana, tu cita es el 20/11', 'en', diccionario))
      .toBe('Hello Ana, your appointment is on 20/11');
  });

  it('la variable final absorbe el resto del mensaje', () => {
    // Act / Assert: el id puede contener cualquier texto.
    expect(translateLocalizedMessage('Pedido #AB-123', 'en', diccionario)).toBe('Order #AB-123');
  });

  it('no casan plantillas si el texto previo difiere', () => {
    // Act / Assert
    expect(translateLocalizedMessage('Chao Ana', 'en', diccionario)).toBe('Chao Ana');
  });

  it('los corchetes huérfanos se devuelven tal cual al renderizar', () => {
    // Arrange: plantilla destino con variable no provista no ocurre en la
    // vía normal (matchTemplate garantiza los valores), se cubre el render
    // de un valor ausente.
    // Act / Assert
    expect(translateLocalizedMessage('Hola {nombre}, tu cita es el {fecha}', 'es', diccionario))
      .toBe('Hola {nombre}, tu cita es el {fecha}');
  });
});
