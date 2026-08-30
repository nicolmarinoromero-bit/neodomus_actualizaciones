# HU-040 — Configuración de horarios generales de atención (administrador)

<!--
  ¿Qué? El administrador puede definir los horarios de operación de la empresa.
  ¿Para qué? Sincronizar la disponibilidad de técnicos y usuarios.
  ¿Impacto? Evita solicitudes fuera del horario laboral.
-->

## Identificación

| Campo            | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | HU-040                                               |
| **Título**       | Configuración de horarios generales de atención      |
| **Módulo**       | Administrador                                        |
| **Prioridad**    | Media                                                |
| **Estado**       | Propuesta                                            |
| **RF asociados** | RF-041                                               |

## Historia

**Como** administrador,  
**quiero** configurar los horarios generales de atención de la empresa (días y horas en que se puede agendar servicios),  
**para** sincronizar la disponibilidad de técnicos y usuarios y evitar solicitudes fuera de horario.

## Criterios de aceptación

### CA-040.1 — Pantalla de configuración
- **Dado que** estoy en `/admin/configuracion/horarios`,
- **cuando** se carga,
- **entonces** veo un formulario con los 7 días de la semana, cada uno con toggle activo/inactivo y selectores de hora de inicio y fin.

### CA-040.2 — Configuración por defecto
- **Dado que** no hay configuración previa,
- **cuando** entro por primera vez,
- **entonces** se cargan valores por defecto: lunes a viernes de 9:00 a 18:00, sábados de 9:00 a 14:00, domingo inactivo.

### CA-040.3 — Guardado
- **Dado que** modifico los horarios,
- **cuando** hago clic en "Guardar",
- **entonces** el sistema valida que la hora de inicio sea anterior a la hora de fin y que no haya solapamientos absurdos.

### CA-040.4 — Efecto inmediato
- **Dado que** guardo la nueva configuración,
- **cuando** un usuario intenta solicitar un servicio,
- **entonces** solo se le muestran horas dentro del nuevo rango.

### CA-040.5 — Festivos (opcional)
- **Dado que** quiero bloquear fechas específicas (ej. 25 de diciembre),
- **cuando** añado una excepción,
- **entonces** puede crear una lista de fechas festivas donde no se permitan servicios.