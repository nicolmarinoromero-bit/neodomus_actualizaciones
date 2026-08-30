# HU-028 — Registro de nuevos técnicos por el administrador

<!--
  ¿Qué? El administrador puede crear cuentas de técnico.
  ¿Para qué? Incorporar nuevo personal a la plataforma.
  ¿Impacto? Permite escalar el equipo de trabajo.
-->

## Identificación

| Campo            | Valor                                            |
| ---------------- | ------------------------------------------------ |
| **ID**           | HU-028                                           |
| **Título**       | Registro de nuevos técnicos por el administrador |
| **Módulo**       | Administrador                                    |
| **Prioridad**    | Alta                                             |
| **Estado**       | Propuesta                                        |
| **RF asociados** | RF-029                                           |

## Historia

**Como** administrador,  
**quiero** registrar nuevos técnicos en la plataforma, ingresando sus datos personales y especialidad,  
**para** crear sus cuentas y permitirles acceder al sistema.

## Criterios de aceptación

### CA-028.1 — Acceso al panel de técnicos
- **Dado que** estoy autenticado como administrador,
- **cuando** accedo a `/admin/tecnicos`,
- **entonces** veo la lista de técnicos existentes y un botón "Crear nuevo técnico".

### CA-028.2 — Formulario de creación
- **Dado que** hago clic en "Crear nuevo técnico",
- **cuando** se abre el formulario,
- **entonces** debo completar: nombre, apellido, tipo y número de documento, email, teléfono, dirección, especialidad (campo de texto).

### CA-028.3 — Generación de contraseña temporal
- **Dado que** completo los datos y envío,
- **cuando** el sistema valida que no haya duplicados de email o documento,
- **entonces** crea el usuario con rol `tecnico`, genera una contraseña aleatoria segura (12 caracteres), la hashea, y envía un correo al técnico con las credenciales temporales.

### CA-028.4 — Obligación de cambiar contraseña
- **Dado que** el técnico inicia sesión con la contraseña temporal,
- **cuando** el sistema detecta que es su primer inicio,
- **entonces** le exige cambiar la contraseña antes de poder usar la plataforma.

### CA-028.5 — Prevención de duplicados
- **Dado que** intento crear un técnico con un email o documento ya existente,
- **cuando** envío,
- **entonces** veo un mensaje de error: "El email o documento ya está registrado".