from slowapi import Limiter
# PARA: Importa la clase Limiter desde la librería slowapi, que implementa limitación de tasa de peticiones (rate limiting).
# IMPACTO: Permite configurar y aplicar límites de cuántas peticiones puede hacer un cliente en un período de tiempo, protegiendo la API contra abusos, ataques de fuerza bruta o sobrecarga.

from slowapi.util import get_remote_address
# PARA: Importa la función get_remote_address, que extrae la dirección IP del cliente que realiza la petición.
# IMPACTO: Se usará como función clave (key_func) para identificar de forma única a cada cliente por su IP, de modo que el límite se aplique por IP individual.

limiter = Limiter(key_func=get_remote_address)
# PARA: Crea una instancia del limitador, configurándola para que use la IP remota (get_remote_address) como identificador de cada cliente.
# IMPACTO: Esta instancia `limiter` se puede importar en otros módulos y usar como decorador (`@limiter.limit("5/minute")`) en endpoints de FastAPI. Con esto, cada IP tendrá su propio contador de peticiones, evitando que un solo usuario acapare recursos o realice múltiples intentos de login en poco tiempo.