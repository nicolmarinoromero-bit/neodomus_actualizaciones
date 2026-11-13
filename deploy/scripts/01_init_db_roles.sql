-- MySQL 8.0+/8.4. Ejecutar como DBA en la base neodomus.
-- Definición idempotente de roles; no incluye contraseñas ni cuentas de login.
CREATE ROLE IF NOT EXISTS 'neodomus_owner', 'neodomus_app', 'neodomus_read_only', 'neodomus_backup';

-- Owner para migraciones: acceso DDL/DML completo sobre la base del proyecto.
GRANT ALL PRIVILEGES ON `neodomus`.* TO 'neodomus_owner';

-- Aplicación: DML solamente. Los GRANT explícitos no incluyen CREATE/ALTER/DROP.
GRANT SELECT, INSERT, UPDATE, DELETE ON `neodomus`.* TO 'neodomus_app';

-- Auditoría/reportes: lectura solamente.
GRANT SELECT ON `neodomus`.* TO 'neodomus_read_only';

-- Usuario técnico del dump: lectura y metadatos requeridos por mysqldump.
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON `neodomus`.* TO 'neodomus_backup';
GRANT SHOW_ROUTINE ON *.* TO 'neodomus_backup';

-- Ejemplo de asignación a cuentas gestionadas fuera de este script:
-- GRANT 'neodomus_app' TO 'neodomus'@'%';
-- SET DEFAULT ROLE 'neodomus_app' TO 'neodomus'@'%';
-- GRANT 'neodomus_owner' TO 'migration_user'@'<RED_ADMINISTRACION>';
-- SET DEFAULT ROLE 'neodomus_owner' TO 'migration_user'@'<RED_ADMINISTRACION>';
-- GRANT 'neodomus_read_only' TO 'audit_user'@'<RED_ADMINISTRACION>';
-- SET DEFAULT ROLE 'neodomus_read_only' TO 'audit_user'@'<RED_ADMINISTRACION>';

SHOW GRANTS FOR 'neodomus_app';
SHOW GRANTS FOR 'neodomus_read_only';
