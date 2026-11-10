# Utilidades de saneamiento de texto proveniente del usuario.
#
# Criterios del proyecto base (mitigación OWASP A02/A05): TODO texto libre que
# entra desde un cliente (web, móvil o Postman) debe limpiarse ANTES de llegar
# a la base de datos: nunca se persisten caracteres de control ni bytes raros
# (NUL, BEL, secuencias ANSI ESC, DEL, rango C1) porque rompen registros,
# logs y paneles de administración, y no aportan nada al negocio.
import re
import unicodedata
from typing import Optional

# Caracteres de control Unicode que JAMÁS deben persistirse:
# \x00-\x08  C0: NUL, SOH, BEL (\x07)... (sin incluir \t \n: se gestionan aparte)
# \x0b  \x0c VT y FF
# \x0e-\x1f resto de C0 (incluye \x1b ESC, que abre secuencias ANSI)
# \x7f-\x9f DEL y rango C1
_CARACTERES_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def limpiar_texto(
    valor: Optional[str],
    max_largo: int,
    mantener_saltos: bool = False,
) -> Optional[str]:
    """Sanea texto libre del usuario (saneamiento de entradas, OWASP A05).

    Pasos, en orden:
    1. Normaliza Unicode (NFKC): descompone ligaduras/caracteres "raros" y
       elimina variantes fullwidth que complican búsquedas y reportes.
    2. Elimina todo carácter de control (NUL, BEL, ANSI ESC, DEL, C1...).
    3. Colapsa saltos de línea y espacios redundantes:
       - si ``mantener_saltos`` es False se colapsa TODO el espacio en un solo
         espacio (nombres, asuntos, teléfono en texto, etc.).
       - si es True se conservan los saltos del mensaje (se normalizan CRLF/CR
         a LF y se limita a máximo dos saltos seguidos) para no perder el
         formato que el usuario escribió a propósito.
    4. Trunca a ``max_largo`` como cinturón de seguridad adicional al
       ``max_length`` de Pydantic: mitiga el DoS por cargas gigantescas
       (A02) sin depender solo de la validación previa.

    Devuelve None si la entrada es None (campos opcionales) o el texto limpio.
    """
    if valor is None:
        return None
    texto = unicodedata.normalize("NFKC", str(valor))
    texto = _CARACTERES_CONTROL.sub(" ", texto)
    if mantener_saltos:
        # Unifica CR/CRLF a LF para almacenar siempre el mismo formato.
        texto = texto.replace("\r\n", "\n").replace("\r", "\n")
        # Espacios y tabuladores redundantes fuera; los saltos se conservan.
        texto = re.sub(r"[^\S\n]+", " ", texto)
        # Máximo DOS saltos seguidos (la UI los pinta como un solo párrafo).
        texto = re.sub(r"\n{3,}", "\n\n", texto)
    else:
        # Todo el espacio en blanco se colapsa a un solo espacio.
        texto = re.sub(r"\s+", " ", texto).strip()
    texto = texto.strip()
    if max_largo is not None and len(texto) > max_largo:
        texto = texto[:max_largo]
    return texto
