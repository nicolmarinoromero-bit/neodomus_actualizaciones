-- =====================================================
-- NEODOMUS - Base de datos (no destructiva e idempotente)
-- NO borra datos existentes. Los registros (clientes,
-- técnicos, administradores) se conservan al re-ejecutar.
-- =====================================================

CREATE DATABASE IF NOT EXISTS neodomus
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE neodomus;
SET NAMES utf8mb4;

-- ------------------------------
-- Tablas base (catálogos)
-- ------------------------------
CREATE TABLE IF NOT EXISTS tipos_documento (
    id_tipo_documento INT AUTO_INCREMENT PRIMARY KEY,
    nombre_tipo VARCHAR(2) NOT NULL UNIQUE
);
INSERT INTO tipos_documento (nombre_tipo)
SELECT nombre_tipo FROM (
    SELECT 'cc' AS nombre_tipo
    UNION ALL SELECT 'ce'
) t
WHERE NOT EXISTS (SELECT 1 FROM tipos_documento);

CREATE TABLE IF NOT EXISTS roles_usuario (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO roles_usuario (nombre_rol)
SELECT nombre_rol FROM (
    SELECT 'administrador' AS nombre_rol
    UNION ALL SELECT 'tecnico'
) t
WHERE NOT EXISTS (SELECT 1 FROM roles_usuario);

CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
    nombre_proveedor VARCHAR(100),
    contacto_proveedor VARCHAR(100),
    telefono_proveedor VARCHAR(20),
    correo_proveedor VARCHAR(100) UNIQUE,
    direccion_proveedor VARCHAR(150)
);

INSERT IGNORE INTO proveedores (nombre_proveedor, contacto_proveedor, telefono_proveedor, correo_proveedor, direccion_proveedor) VALUES
('Deportes Elite S.A.', 'Carlos Ramírez', '3104567890', 'contacto@deporteselite.com', 'Cra 45 #12-34, Bogotá'),
('SportLine Distribuciones', 'María Gómez', '3159876543', 'ventas@sportline.com', 'Av. Las Américas #23-45, Medellín'),
('TodoFitness Ltda.', 'Andrés López', '3006543210', 'info@todofitness.com', 'Calle 50 #67-12, Cali'),
('Proveedora Olímpica', 'Laura Torres', '3123456789', 'ltorres@proveedoraolimpica.com', 'Carrera 9 #80-22, Barranquilla'),
('Suministros Deportivos SAS', 'Jorge Martínez', '3012233445', 'jorge@suministrosdeportivos.com', 'Calle 100 #15-40, Bogotá'),
('Equipos ProGym', 'Diana Herrera', '3209988776', 'dherrera@progym.com', 'Av. 30 de Agosto #45-67, Pereira'),
('Distribuciones RunningPro', 'Luis Castillo', '3167788990', 'ventas@runningpro.com', 'Calle 10 #25-30, Bucaramanga'),
('Balones y Redes S.A.', 'Paola Rincón', '3184455667', 'paola@balonesyredes.com', 'Cra 21 #45-10, Cartagena'),
('FitEquipos SAS', 'Andrés Peña', '3178899001', 'andres@fitequipos.com', 'Cl 45 #23-10, Manizales'),
('GymPro Distribuciones', 'Carolina Ríos', '3164455667', 'carolina@gympro.com', 'Cra 15 #30-20, Ibagué');

CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal INT AUTO_INCREMENT PRIMARY KEY,
    nombre_sucursal VARCHAR(100) UNIQUE,
    direccion_sucursal VARCHAR(150),
    telefono_sucursal VARCHAR(20) UNIQUE
);

INSERT IGNORE INTO sucursales (nombre_sucursal, direccion_sucursal, telefono_sucursal) VALUES
('Sucursal Centro Bogotá', 'Cra 7 #12-34, Bogotá', '6013456789'),
('Sucursal Norte Bogotá', 'Av. 19 #120-45, Bogotá', '6019876543'),
('Sucursal Medellín Poblado', 'Cra 43A #6-50, Medellín', '6043112233'),
('Sucursal Medellín Centro', 'Calle 50 #45-10, Medellín', '6044567890'),
('Sucursal Cali Norte', 'Av. 3N #34-67, Cali', '6023211122'),
('Sucursal Cali Sur', 'Cra 66 #13-45, Cali', '6026547890'),
('Sucursal Barranquilla Centro', 'Carrera 45 #50-22, Barranquilla', '6053556677'),
('Sucursal Bucaramanga Cabecera', 'Calle 36 #33-40, Bucaramanga', '6076123456'),
('Sucursal Cartagena Bocagrande', 'Cra 1 #8-12, Cartagena', '6056789012'),
('Sucursal Pereira Circunvalar', 'Av. Circunvalar #15-20, Pereira', '6063456789');

CREATE TABLE IF NOT EXISTS categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categorias (nombre_categoria, descripcion)
SELECT nombre_categoria, descripcion FROM (
    SELECT 'sensores' AS nombre_categoria, 'dispositivos de detección' AS descripcion
    UNION ALL SELECT 'controladores', 'centrales y controladores'
    UNION ALL SELECT 'iluminación', 'cintas led, bombillas'
    UNION ALL SELECT 'automatización', 'kits de automatización'
    UNION ALL SELECT 'cables y conectividad', 'cables, routers'
    UNION ALL SELECT 'enchufes y tomas', 'enchufes inteligentes'
    UNION ALL SELECT 'fuentes de poder', 'fuentes de alimentación'
    UNION ALL SELECT 'seguridad', 'cámaras, alarmas'
    UNION ALL SELECT 'climatización', 'termostatos, persianas'
    UNION ALL SELECT 'interfaces', 'paneles táctiles'
) t
WHERE NOT EXISTS (SELECT 1 FROM categorias);

CREATE TABLE IF NOT EXISTS tipos_servicios (
    id_tipo_ser INT PRIMARY KEY AUTO_INCREMENT,
    descripcion_tipo VARCHAR(150) UNIQUE
);

INSERT INTO tipos_servicios (descripcion_tipo)
SELECT descripcion_tipo FROM (
    SELECT 'Instalación' AS descripcion_tipo
    UNION ALL SELECT 'Mantenimiento'
    UNION ALL SELECT 'Configuración'
    UNION ALL SELECT 'Soporte'
    UNION ALL SELECT 'Programación'
    UNION ALL SELECT 'Asesoría'
) t
WHERE NOT EXISTS (SELECT 1 FROM tipos_servicios);

CREATE TABLE IF NOT EXISTS comisiones (
    id_comision INT AUTO_INCREMENT PRIMARY KEY,
    porcentaje_comision DECIMAL(5,2),
    valor_comision DECIMAL(10,2)
);

INSERT INTO comisiones (porcentaje_comision, valor_comision)
SELECT porcentaje_comision, valor_comision FROM (
    SELECT 5.00 AS porcentaje_comision, 3500.00 AS valor_comision
    UNION ALL SELECT 5.00, 8000.00
    UNION ALL SELECT 5.00, 1000.00
    UNION ALL SELECT 5.00, 9000.00
    UNION ALL SELECT 5.00, 300.00
    UNION ALL SELECT 5.00, 1950.00
    UNION ALL SELECT 5.00, 2900.00
    UNION ALL SELECT 5.00, 2500.00
    UNION ALL SELECT 5.00, 8500.00
    UNION ALL SELECT 5.00, 500.00
) t
WHERE NOT EXISTS (SELECT 1 FROM comisiones);

-- ------------------------------
-- Tablas de usuarios y clientes
-- ------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    id_tipo_documento_u INT,
    documento_usuario BIGINT UNIQUE,
    telefono_usuario BIGINT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    id_rol_u INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tipo_documento_u) REFERENCES tipos_documento(id_tipo_documento),
    FOREIGN KEY (id_rol_u) REFERENCES roles_usuario(id_rol)
);

-- Contraseñas de usuarios (patrón: 12345678 + inicial nombre MAYÚS + inicial apellido minús + .)
INSERT IGNORE INTO usuarios (first_name, last_name, id_tipo_documento_u, documento_usuario, telefono_usuario, email, password_hash, id_rol_u, is_active) VALUES
('CARLOS ANDRÉS', 'GÓMEZ RÍOS', 1, 1023456790, 3001234567, 'carlos.andres.gomez@gmail.com', '$2b$12$cEkNLc8Js907ywI9KHgYLu/TCD5.Ld35TwAIO7Ev5hSxfeG1LNf0C', 2, 1),
('JORGE DANIEL', 'CHARRY PÉREZ', 1, 1034567890, 3002345678, 'jorge.charry@gmail.com', '$2b$12$N1Ge6TcZlgNgP85DKhp5quBdrXQkixJV5hB1Th455B1gkKDIbMj96', 2, 1),
('JUAN SEBASTIÁN', 'MORENO TORRES', 1, 1078901234, 3003456789, 'juan.moreno@gmail.com', '$2b$12$vic9BT8xg8NX1SKPnjmGn.yoKQBh88xViJjhrrG.PRWyKbMDWOin2', 2, 1),
('LUIS EDUARDO', 'MARTÍNEZ GAITÁN', 1, 1090123456, 3004567890, 'luis.martinez@gmail.com', '$2b$12$.zBmllFGXbnL7eAIFAfr6ueCtlwal3yjMxeiPTooqG6tcq8q2Ham2', 1, 1),
('ANDRÉS MAURICIO', 'LÓPEZ VARGAS', 1, 1056789012, 3005678901, 'andres.lopez@gmail.com', '$2b$12$RByXZVO3eUwDQiQeBeZd2.bdFX3uOCkj9omMfE7iqNX1oRbYB7dPO', 2, 1),
('CAMILA ANDREA', 'RODRÍGUEZ PEÑA', 1, 1089012345, 3006789012, 'camila.rodriguez@gmail.com', '$2b$12$z4DFKDwZ.jHTfu6.0RT7hOU5JpqgvNtYjzCGp11phcY7iKM9kEKfe', 1, 1),
('NICOL ALEJANDRA', 'MARIÑO ROMERO', 1, 1045678901, 3007890123, 'nicolmarinoromero@gmail.com', '$2b$12$OQdysg.2T0oagVqY5zPeq.07kcmonKB.zwxBSbQHlK0uEnGiyhBv6', 1, 1),
('LAURA MARCELA', 'PÉREZ DUARTE', 2, 1009876543, 3008901234, 'nicolmarino09@gmail.com', '$2b$12$iY/it6NSqzlUkR7IBT1q3eTYKKudhyVIb4Gyf1V.UYX6s548abKpu', 2, 1),
('JULIÁN FELIPE', 'CARVAJAL CABALLERO', 2, 1012345678, 3009012345, 'julian.carvajal@gmail.com', '$2b$12$dork9ZuJsoLuly6HWBQ6WuKiP97jjnGNl.h9Z2oqT/FZJfC/iyGQK', 2, 1),
('MARÍA FERNANDA', 'RINCÓN SALAZAR', 2, 1067890123, 3010123456, 'maria.rincon@gmail.com', '$2b$12$QnuBlookrDuipcigufnlKenl1ufl6Fk8.eQP27nIvz5f/lpgYKEhW', 2, 1);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    id_tipo_documento_c INT,
    documento_cliente BIGINT UNIQUE,
    telefono_cliente BIGINT,
    email VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tipo_documento_c) REFERENCES tipos_documento(id_tipo_documento)
);

SET @hash = '$2b$12$KIXpzCv6VxPqCQzO4QH3eO8yYjZqXVNZYbGcYX7tZQ0cZ6sJZy3MG';

-- Contraseñas de clientes (patrón: 12345678 + inicial nombre MAYÚS + inicial apellido minús + .)
INSERT IGNORE INTO clientes (first_name, last_name, id_tipo_documento_c, documento_cliente, telefono_cliente, email, address, password_hash, is_active, verification_token) VALUES
('LAURA', 'GARCÍA ROJAS', 1, 1012345678, 3001234567, 'laura.garcia@gmail.com', 'Cra 10 #12-34', '$2b$12$6rroJ8FDswLC2TD7hXAK.uQv1GMyPUVEP8ppw3cIe1X1QOuMsgRoi', 1, NULL),
('DANIELA', 'RAMÍREZ PEÑA', 1, 1034567890, 3023456789, 'daniela.ramirez@gmail.com', 'Av 30 #15-09', '$2b$12$hE1X0XXMBO3Eb3o9kusSU.EVm19hFTkRC8Ko/ve7SJfwF.zTF/k7O', 1, NULL),
('ANDRÉS', 'GONZÁLEZ MORA', 2, 1045678901, 3034567890, 'andres.gonzalez@gmail.com', 'Mz A Casa 10', '$2b$12$AFJtgh2pVgOtqVSEkjHjyemlyZbGWnQj4q70AibjpNuifayrjrWLe', 1, NULL),
('MARIANA', 'SUÁREZ LÓPEZ', 1, 1056789012, 3045678901, 'mariana.suarez@gmail.com', 'Cl 8B #20-45', '$2b$12$/TbKAqekp0mfyBDohFR7juGHCaz5WkZkkceWSnhS0eesDpPkZZzNC', 1, NULL),
('NATALIA', 'CASTRO JIMÉNEZ', 1, 1078901234, 3067890123, 'natalia.castro@gmail.com', 'Cl 19 #13-55', '$2b$12$LRHnOBAUGFV2NGOh37Kz0.zDB7UcSkvVTVbKUgOMw/3qxwUoDoJvC', 1, NULL),
('FELIPE', 'MARTÍNEZ PÉREZ', 1, 1089012345, 3078901234, 'felipe.martinez@gmail.com', 'Av 68 #54-23', '$2b$12$7ZAsIDxO63nJAZ/jdtUDf.0vjL2dmnyhaWeVe8td5aswB44kugAb6', 1, NULL),
('CAMILA', 'ORTIZ SALAZAR', 2, 1090123456, 3089012345, 'camila.ortiz@gmail.com', 'Cl 100 #25-10', '$2b$12$WP/Uqv.1QQkwLrGYzX2fEOdJGIuYRedRMVpS.vvP4eA6zLs/LMTxC', 1, NULL),
('SEBASTIÁN', 'LÓPEZ ROMERO', 1, 1101234567, 3090123456, 'sebastian.lopez@gmail.com', 'Cra 7 #89-12', '$2b$12$oWsjXpWFUd0aRj87rBTufO3wMs7b7i72ZWpDY7G7QDB1rjzUtv2gS', 1, NULL),
('SOFÍA', 'RAMÍREZ ORTEGA', 1, 1112345678, 3101234567, 'sofia.ramirez@gmail.com', 'Cl 50 #12-34', @hash, 1, NULL),
('MATEO', 'GUTIÉRREZ PARDO', 2, 1123456789, 3112345678, 'mateo.gutierrez@gmail.com', 'Av 20 #45-67', @hash, 1, NULL),
('VALENTINA', 'HIDALGO CASTRO', 1, 1134567890, 3123456789, 'valentina.hidalgo@gmail.com', 'Cl 8 #34-56', '$2b$12$K0VCBGB08uRF8BrRN49LhuunCdQflp59lKwqSHFlMjAV6fj.xurqW', 1, NULL);

-- ------------------------------
-- Tabla de registros pendientes (SIN clave foránea)
-- ------------------------------
CREATE TABLE IF NOT EXISTS pending_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    id_tipo_documento_c INT,
    documento_cliente BIGINT,
    telefono_cliente BIGINT,
    email VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------
-- Tablas de técnicos, rutas, novedades
-- ------------------------------
CREATE TABLE IF NOT EXISTS tecnicos (
    id_tecnico INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario_t INT UNIQUE,
    certificacion_t VARCHAR(100),
    cargo_t VARCHAR(50),
    FOREIGN KEY (id_usuario_t) REFERENCES usuarios(id_usuario)
);

INSERT INTO tecnicos (id_usuario_t, certificacion_t, cargo_t)
SELECT id_usuario_t, certificacion_t, cargo_t FROM (
    SELECT 1 AS id_usuario_t, 'Certificación en Redes y Cableado Estructurado' AS certificacion_t, 'Junior' AS cargo_t
    UNION ALL SELECT 2, 'Certificación en Instalación de Domótica', 'Junior'
    UNION ALL SELECT 3, 'Certificación en Seguridad Electrónica', 'Semi Senior'
    UNION ALL SELECT 4, 'Certificación en Soporte de Sistemas IoT', 'Junior'
    UNION ALL SELECT 5, 'Certificación en Programación de PLCs', 'Senior'
    UNION ALL SELECT 6, 'Certificación en Bases de Datos y Servidores', 'Senior'
    UNION ALL SELECT 7, 'Certificación en Automatización de Hogares', 'Semi Senior'
    UNION ALL SELECT 8, 'Certificación en Seguridad Informática', 'Senior'
    UNION ALL SELECT 9, 'Certificación en Programación Backend', 'Semi Senior'
    UNION ALL SELECT 10, 'Certificación en Gestión de Proyectos', 'Senior'
) t
WHERE NOT EXISTS (SELECT 1 FROM tecnicos);

CREATE TABLE IF NOT EXISTS novedades (
    id_novedad INT AUTO_INCREMENT PRIMARY KEY,
    id_tecnico_n INT,
    fecha_reporte_novedad DATETIME,
    tipo_novedad VARCHAR(100),
    descripcion_novedad TEXT,
    estado_novedad VARCHAR(50),
    FOREIGN KEY (id_tecnico_n) REFERENCES tecnicos(id_tecnico)
);

INSERT INTO novedades (id_tecnico_n, fecha_reporte_novedad, tipo_novedad, descripcion_novedad, estado_novedad)
SELECT id_tecnico_n, fecha_reporte_novedad, tipo_novedad, descripcion_novedad, estado_novedad FROM (
    SELECT 1 AS id_tecnico_n, NOW() AS fecha_reporte_novedad, 'Falla Técnica' AS tipo_novedad, 'Sensor PIR no responde' AS descripcion_novedad, 'Pendiente' AS estado_novedad
    UNION ALL SELECT 2, NOW(), 'Instalación', 'Controlador central defectuoso', 'Resuelto'
    UNION ALL SELECT 3, NOW(), 'Mantenimiento', 'Cámara IP con visión parcial', 'Pendiente'
    UNION ALL SELECT 4, NOW(), 'Red WiFi', 'Router requiere reinicio', 'Pendiente'
    UNION ALL SELECT 5, NOW(), 'Sensores', 'Sensor de puerta mal instalado', 'Resuelto'
    UNION ALL SELECT 6, NOW(), 'PLC', 'Falla en programación del PLC', 'Pendiente'
    UNION ALL SELECT 7, NOW(), 'Mantenimiento', 'Fuente de poder 12V fallando', 'Pendiente'
    UNION ALL SELECT 8, NOW(), 'Asesoría', 'Cliente solicita cambios en configuración', 'Pendiente'
    UNION ALL SELECT 9, NOW(), 'Cámara IP', 'Soporte de pared dañado', 'Resuelto'
    UNION ALL SELECT 10, NOW(), 'Baterías', 'Batería recargable 18650 no carga', 'Pendiente'
) t
WHERE NOT EXISTS (SELECT 1 FROM novedades);

CREATE TABLE IF NOT EXISTS detalle_ruta (
    id_detaruta INT PRIMARY KEY AUTO_INCREMENT,
    id_ruta_dr INT,
    id_tecnico INT,
    id_bodega_et INT
);

INSERT INTO detalle_ruta (id_ruta_dr, id_tecnico, id_bodega_et)
SELECT id_ruta_dr, id_tecnico, id_bodega_et FROM (
    SELECT 1 AS id_ruta_dr, 1 AS id_tecnico, 1 AS id_bodega_et
    UNION ALL SELECT 2, 2, 2
    UNION ALL SELECT 3, 3, 3
    UNION ALL SELECT 4, 4, 4
    UNION ALL SELECT 5, 5, 5
    UNION ALL SELECT 6, 6, 6
    UNION ALL SELECT 7, 7, 7
    UNION ALL SELECT 8, 8, 8
    UNION ALL SELECT 9, 9, 9
    UNION ALL SELECT 10, 10, 10
) t
WHERE NOT EXISTS (SELECT 1 FROM detalle_ruta);

CREATE TABLE IF NOT EXISTS rutero (
    id_ruta INT AUTO_INCREMENT PRIMARY KEY,
    id_detalle_r INT,
    fecha_ruta DATE,
    hora_ruta TIME,
    direccion_ruta VARCHAR(255),
    estado_ruta VARCHAR(50) DEFAULT 'Pendiente',
    observaciones_ruta TEXT,
    FOREIGN KEY (id_detalle_r) REFERENCES detalle_ruta(id_detaruta)
);

INSERT INTO rutero (id_detalle_r, fecha_ruta, hora_ruta, direccion_ruta, estado_ruta, observaciones_ruta)
SELECT id_detalle_r, fecha_ruta, hora_ruta, direccion_ruta, estado_ruta, observaciones_ruta FROM (
    SELECT 1 AS id_detalle_r, CURDATE() AS fecha_ruta, '09:00:00' AS hora_ruta, 'Cra 10 #12-34' AS direccion_ruta, 'Pendiente' AS estado_ruta, 'Revisión inicial del sistema' AS observaciones_ruta
    UNION ALL SELECT 2, CURDATE(), '10:00:00', 'Av 30 #15-09', 'Pendiente', 'Instalación de sensores'
    UNION ALL SELECT 3, CURDATE(), '11:00:00', 'Mz A Casa 10', 'Pendiente', 'Mantenimiento de cámaras'
    UNION ALL SELECT 4, CURDATE(), '12:00:00', 'Cl 8B #20-45', 'Pendiente', 'Configuración de red WiFi'
    UNION ALL SELECT 5, CURDATE(), '13:00:00', 'Cl 19 #13-55', 'Pendiente', 'Prueba de sensores de puerta'
    UNION ALL SELECT 6, CURDATE(), '14:00:00', 'Av 68 #54-23', 'Pendiente', 'Programación de PLC'
    UNION ALL SELECT 7, CURDATE(), '15:00:00', 'Cl 100 #25-10', 'Pendiente', 'Mantenimiento general'
    UNION ALL SELECT 8, CURDATE(), '16:00:00', 'Cra 7 #89-12', 'Pendiente', 'Asesoría técnica en domótica'
    UNION ALL SELECT 9, CURDATE(), '17:00:00', 'Carrera 9 #80-22', 'Pendiente', 'Instalación de cámaras IP'
    UNION ALL SELECT 10, CURDATE(), '18:00:00', 'Av. 30 de Agosto #45-67', 'Pendiente', 'Revisión de baterías y fuentes'
) t
WHERE NOT EXISTS (SELECT 1 FROM rutero);

-- ------------------------------
-- Tablas de productos, inventarios, bodegas
-- ------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    nombre_producto VARCHAR(100),
    referencia_producto VARCHAR(50) UNIQUE,
    id_proveedor_pr INT,
    precio_compra_producto DECIMAL(10,2),
    precio_venta_producto DECIMAL(10,2),
    fecha_registro_producto DATETIME,
    imagen_url VARCHAR(255) NULL,
    id_cate_pr INT,
    venta_por_metros TINYINT(1) NOT NULL DEFAULT 0,
    descripcion_producto TEXT NULL,
    colores_producto VARCHAR(255) NULL,
    estado_producto VARCHAR(20) NOT NULL DEFAULT 'activo',
    stock_producto INT NOT NULL DEFAULT 0,
    FOREIGN KEY (id_proveedor_pr) REFERENCES proveedores(id_proveedor),
    FOREIGN KEY (id_cate_pr) REFERENCES categorias(id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO productos (nombre_producto, referencia_producto, id_proveedor_pr, precio_compra_producto, precio_venta_producto, fecha_registro_producto, imagen_url, id_cate_pr) VALUES
('Sensor De Movimiento Pir', 'smi-001', 1, 52000.00, 82000.00, NOW(), NULL, 1),
('Controlador Central Domótico', 'ccd-004', 3, 190000.00, 285000.00, NOW(), NULL, 2),
('Cinta Led Rgb', 'led-003', 1, 7000.00, 14000.00, NOW(), NULL, 3),
('Kit De Automatización Básica', 'kit-001', 5, 175000.00, 260000.00, NOW(), NULL, 4),
('Cable Utp Cat6', 'utp6-050', 4, 2100.00, 3500.00, NOW(), NULL, 5),
('Sensor De Puerta/Ventana', 'spd-006', 2, 30000.00, 45000.00, NOW(), NULL, 1),
('Enchufe Inteligente Wifi', 'eiw-007', 1, 46000.00, 69000.00, NOW(), NULL, 6),
('Fuente De Poder 12v 5a', 'ps12-5a', 4, 39000.00, 58000.00, NOW(), NULL, 7),
('Cámara Ip 1080p', 'cip-003', 2, 165000.00, 245000.00, NOW(), NULL, 8),
('Batería Recargable 18650', 'bat18650', 6, 11000.00, 18000.00, NOW(), NULL, 7),
('Termostato Inteligente', 'ter-101', 2, 100000.00, 155000.00, NOW(), NULL, 9),
('Interruptor Táctil Wifi', 'int-202', 1, 43000.00, 65000.00, NOW(), NULL, 10),
('Sirena Inalámbrica', 'sir-303', 3, 62000.00, 95000.00, NOW(), NULL, 8),
('Detector De Humo', 'dhu-404', 4, 55000.00, 85000.00, NOW(), NULL, 1),
('Persiana Motorizada', 'per-505', 5, 255000.00, 380000.00, NOW(), NULL, 9),
('Panel Táctil Central', 'pan-606', 6, 600000.00, 890000.00, NOW(), NULL, 2);

CREATE TABLE IF NOT EXISTS bodega_f (
    id_bodega_f INT AUTO_INCREMENT PRIMARY KEY,
    nombre_bodega_f VARCHAR(100) UNIQUE,
    ubicacion_bodega_f VARCHAR(150),
    capacidad_bodega_f INT,
    id_sucursal_f INT,
    FOREIGN KEY (id_sucursal_f) REFERENCES sucursales(id_sucursal)
);

INSERT IGNORE INTO bodega_f (nombre_bodega_f, ubicacion_bodega_f, capacidad_bodega_f, id_sucursal_f) VALUES
('Bodega Central Bogotá', 'Cra 7 #12-34, Bogotá', 1000, 1),
('Bodega Norte Bogotá', 'Av. 19 #120-45, Bogotá', 800, 2),
('Bodega Medellín Poblado', 'Cra 43A #6-50, Medellín', 600, 3),
('Bodega Medellín Centro', 'Calle 50 #45-10, Medellín', 500, 4),
('Bodega Cali Norte', 'Av. 3N #34-67, Cali', 700, 5),
('Bodega Cali Sur', 'Cra 66 #13-45, Cali', 650, 6),
('Bodega Barranquilla Centro', 'Carrera 45 #50-22, Barranquilla', 400, 7),
('Bodega Bucaramanga Cabecera', 'Calle 36 #33-40, Bucaramanga', 550, 8),
('Bodega Cartagena Bocagrande', 'Cra 1 #8-12, Cartagena', 450, 9),
('Bodega Pereira Circunvalar', 'Av. Circunvalar #15-20, Pereira', 500, 10);

CREATE TABLE IF NOT EXISTS inventario_f (
    id_inventario_f INT AUTO_INCREMENT PRIMARY KEY,
    id_producto_if INT,
    id_bodega_if INT,
    cantidad_if INT,
    fecha_registro_if DATETIME,
    UNIQUE KEY uq_inventario (id_producto_if, id_bodega_if),
    FOREIGN KEY (id_producto_if) REFERENCES productos(id_producto),
    FOREIGN KEY (id_bodega_if) REFERENCES bodega_f(id_bodega_f)
);

INSERT INTO inventario_f (id_producto_if, id_bodega_if, cantidad_if, fecha_registro_if)
SELECT id_producto_if, id_bodega_if, cantidad_if, fecha_registro_if FROM (
    SELECT 1 AS id_producto_if, 1 AS id_bodega_if, 50 AS cantidad_if, NOW() AS fecha_registro_if
    UNION ALL SELECT 2, 2, 20, NOW()
    UNION ALL SELECT 3, 3, 100, NOW()
    UNION ALL SELECT 4, 4, 15, NOW()
    UNION ALL SELECT 5, 5, 300, NOW()
    UNION ALL SELECT 6, 6, 75, NOW()
    UNION ALL SELECT 7, 7, 40, NOW()
    UNION ALL SELECT 8, 8, 60, NOW()
    UNION ALL SELECT 9, 9, 25, NOW()
    UNION ALL SELECT 10, 10, 120, NOW()
    UNION ALL SELECT 11, 1, 40, NOW()
    UNION ALL SELECT 12, 2, 35, NOW()
    UNION ALL SELECT 13, 3, 30, NOW()
    UNION ALL SELECT 14, 4, 45, NOW()
    UNION ALL SELECT 15, 5, 20, NOW()
    UNION ALL SELECT 16, 6, 12, NOW()
) t
WHERE NOT EXISTS (SELECT 1 FROM inventario_f);

CREATE TABLE IF NOT EXISTS insumos (
    id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_insumo VARCHAR(100) UNIQUE,
    ubicacion_insumo VARCHAR(150),
    capacidad_insumo INT,
    id_tecnico_insumo INT,
    FOREIGN KEY (id_tecnico_insumo) REFERENCES tecnicos(id_tecnico)
);

INSERT IGNORE INTO insumos (nombre_insumo, ubicacion_insumo, capacidad_insumo, id_tecnico_insumo) VALUES
('Bodega Técnico 1', 'Cra 7 #12-34, Bogotá', 100, 1),
('Bodega Técnico 2', 'Av. 19 #120-45, Bogotá', 80, 2),
('Bodega Técnico 3', 'Cra 43A #6-50, Medellín', 60, 3),
('Bodega Técnico 4', 'Calle 50 #45-10, Medellín', 50, 4),
('Bodega Técnico 5', 'Av. 3N #34-67, Cali', 70, 5),
('Bodega Técnico 6', 'Cra 66 #13-45, Cali', 65, 6),
('Bodega Técnico 7', 'Carrera 45 #50-22, Barranquilla', 40, 7),
('Bodega Técnico 8', 'Calle 36 #33-40, Bucaramanga', 55, 8),
('Bodega Técnico 9', 'Cra 1 #8-12, Cartagena', 45, 9),
('Bodega Técnico 10', 'Av. Circunvalar #15-20, Pereira', 50, 10);

CREATE TABLE IF NOT EXISTS bodega_et (
    id_insumo_et INT AUTO_INCREMENT PRIMARY KEY,
    id_producto_et INT,
    id_insumos_et INT,
    cantidad_et INT,
    fecha_registro_et DATETIME,
    UNIQUE KEY uq_bodega_et (id_producto_et, id_insumos_et),
    FOREIGN KEY (id_producto_et) REFERENCES productos(id_producto)
);

INSERT INTO bodega_et (id_producto_et, id_insumos_et, cantidad_et, fecha_registro_et)
SELECT id_producto_et, id_insumos_et, cantidad_et, fecha_registro_et FROM (
    SELECT 1 AS id_producto_et, 1 AS id_insumos_et, 10 AS cantidad_et, NOW() AS fecha_registro_et
    UNION ALL SELECT 2, 2, 5, NOW()
    UNION ALL SELECT 3, 3, 30, NOW()
    UNION ALL SELECT 4, 4, 2, NOW()
    UNION ALL SELECT 5, 5, 100, NOW()
    UNION ALL SELECT 6, 6, 15, NOW()
    UNION ALL SELECT 7, 7, 8, NOW()
    UNION ALL SELECT 8, 8, 20, NOW()
    UNION ALL SELECT 9, 9, 4, NOW()
    UNION ALL SELECT 10, 10, 50, NOW()
) t
WHERE NOT EXISTS (SELECT 1 FROM bodega_et);

-- ------------------------------
-- Tablas de servicios, pedidos, detalles
-- ------------------------------
CREATE TABLE IF NOT EXISTS servicios (
    id_servicio INT AUTO_INCREMENT PRIMARY KEY,
    id_tipo_ser INT,
    precio_servicio DECIMAL(10,2),
    total_servicio DECIMAL(10,2),
    id_tecnico_s INT,
    FOREIGN KEY (id_tipo_ser) REFERENCES tipos_servicios(id_tipo_ser),
    FOREIGN KEY (id_tecnico_s) REFERENCES tecnicos(id_tecnico)
);

INSERT INTO servicios (id_tipo_ser, precio_servicio, total_servicio, id_tecnico_s)
SELECT id_tipo_ser, precio_servicio, total_servicio, id_tecnico_s FROM (
    SELECT 1 AS id_tipo_ser, 150000.00 AS precio_servicio, 150000.00 AS total_servicio, 1 AS id_tecnico_s
    UNION ALL SELECT 2, 80000.00, 80000.00, 2
    UNION ALL SELECT 3, 60000.00, 60000.00, 3
    UNION ALL SELECT 4, 70000.00, 70000.00, 4
    UNION ALL SELECT 1, 50000.00, 50000.00, 5
    UNION ALL SELECT 5, 120000.00, 120000.00, 6
    UNION ALL SELECT 2, 90000.00, 90000.00, 7
    UNION ALL SELECT 6, 100000.00, 100000.00, 8
    UNION ALL SELECT 1, 85000.00, 85000.00, 9
    UNION ALL SELECT 2, 40000.00, 40000.00, 10
) t
WHERE NOT EXISTS (SELECT 1 FROM servicios);

CREATE TABLE IF NOT EXISTS pedidos (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente_pe INT,
    fecha_peedido DATETIME,
    total_pedido DECIMAL(10,2),
    estado_pedido VARCHAR(50),
    FOREIGN KEY (id_cliente_pe) REFERENCES clientes(id_cliente)
);

INSERT INTO pedidos (id_cliente_pe, fecha_peedido, total_pedido, estado_pedido)
SELECT id_cliente_pe, fecha_peedido, total_pedido, estado_pedido FROM (
    SELECT 1 AS id_cliente_pe, NOW() AS fecha_peedido, 150000.00 AS total_pedido, 'ACTIVO' AS estado_pedido
    UNION ALL SELECT 2, NOW(), 80000.00, 'ACTIVO'
    UNION ALL SELECT 3, NOW(), 60000.00, 'ACTIVO'
    UNION ALL SELECT 4, NOW(), 70000.00, 'ACTIVO'
    UNION ALL SELECT 5, NOW(), 50000.00, 'ACTIVO'
    UNION ALL SELECT 6, NOW(), 120000.00, 'ACTIVO'
    UNION ALL SELECT 7, NOW(), 90000.00, 'ACTIVO'
    UNION ALL SELECT 8, NOW(), 100000.00, 'ACTIVO'
    UNION ALL SELECT 9, NOW(), 85000.00, 'ACTIVO'
    UNION ALL SELECT 10, NOW(), 40000.00, 'ACTIVO'
) t
WHERE NOT EXISTS (SELECT 1 FROM pedidos);

CREATE TABLE IF NOT EXISTS detalle_pedido (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido_d INT,
    id_producto_d INT,
    id_servicio_d INT,
    id_comision_d INT,
    cantidad_detalle INT,
    precio_unitario_detalle DECIMAL(10,2),
    subtotal_detalle DECIMAL(10,2),
    color_detalle VARCHAR(50) NULL,
    largo_metros DECIMAL(10,2) NULL,
    FOREIGN KEY (id_pedido_d) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (id_producto_d) REFERENCES productos(id_producto),
    FOREIGN KEY (id_servicio_d) REFERENCES servicios(id_servicio),
    FOREIGN KEY (id_comision_d) REFERENCES comisiones(id_comision)
);

INSERT INTO detalle_pedido (id_pedido_d, id_producto_d, id_servicio_d, id_comision_d, cantidad_detalle, precio_unitario_detalle, subtotal_detalle)
SELECT id_pedido_d, id_producto_d, id_servicio_d, id_comision_d, cantidad_detalle, precio_unitario_detalle, subtotal_detalle FROM (
    SELECT 1 AS id_pedido_d, 1 AS id_producto_d, 1 AS id_servicio_d, 1 AS id_comision_d, 1 AS cantidad_detalle, 70000.00 AS precio_unitario_detalle, 70000.00 AS subtotal_detalle
    UNION ALL SELECT 2, 2, 2, 2, 1, 160000.00, 160000.00
    UNION ALL SELECT 3, 3, 3, 3, 1, 20000.00, 20000.00
    UNION ALL SELECT 4, 4, 4, 4, 1, 180000.00, 180000.00
    UNION ALL SELECT 5, 5, 5, 5, 1, 6000.00, 6000.00
    UNION ALL SELECT 6, 6, 6, 6, 1, 39000.00, 39000.00
    UNION ALL SELECT 7, 7, 7, 7, 1, 58000.00, 58000.00
    UNION ALL SELECT 8, 8, 8, 8, 1, 50000.00, 50000.00
    UNION ALL SELECT 9, 9, 9, 9, 1, 170000.00, 170000.00
    UNION ALL SELECT 10, 10, 10, 10, 1, 10000.00, 10000.00
) t
WHERE NOT EXISTS (SELECT 1 FROM detalle_pedido);

-- ------------------------------
-- Tablas de tokens (autenticación)
-- ------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    user_type ENUM('client', 'employee') NOT NULL,
    token VARCHAR(500) NULL UNIQUE,   
    code VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    ip_used VARCHAR(45),
    INDEX idx_token (token),
    INDEX idx_email_type (email, user_type),
    INDEX idx_expires_used (expires_at, used)
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_cliente VARCHAR(100) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_cliente) REFERENCES clientes(email) ON DELETE CASCADE,
    UNIQUE KEY unique_active_token_per_client (email_cliente),
    INDEX idx_code (code),
    INDEX idx_expires_used (expires_at, used)
);

-- Tabla de citas de clientes
-- -------------------------
CREATE TABLE IF NOT EXISTS citas (
    id_cita INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_tecnico INT NULL,
    nombre_tecnico VARCHAR(150) NULL,
    id_factura INT NULL,
    tipo_servicio VARCHAR(30) NOT NULL,
    fecha DATE NOT NULL,
    hora VARCHAR(10) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    descripcion TEXT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_citas_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    INDEX ix_citas_id_cliente (id_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solicitudes de inhabilitación/habilitación de cuentas
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes_cuenta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    motivo TEXT NULL,
    resuelta_por INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resuelta_at DATETIME NULL,
    CONSTRAINT fk_sol_cuenta_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    INDEX ix_sol_cliente (id_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------
-- Tablas de comercio electrónico
-- ------------------------------

CREATE TABLE IF NOT EXISTS carrito_items (
    id_carrito_item INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    color VARCHAR(50) NULL,
    largo DECIMAL(10,2) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_carrito_item (id_cliente, id_producto, color, largo),
    CONSTRAINT fk_carrito_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    CONSTRAINT fk_carrito_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pagos (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NULL,
    id_cliente INT NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    transaction_id VARCHAR(64) NULL,
    reference VARCHAR(100) NULL,
    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'simulador',
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(10,2) NOT NULL DEFAULT 0,
    monto_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(5) NOT NULL DEFAULT 'COP',
    correo_enviado BOOLEAN NOT NULL DEFAULT FALSE,
    error_mensaje VARCHAR(255) NULL,
    aprobado_en DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pago_idempotency (idempotency_key),
    INDEX ix_pago_pedido (id_pedido),
    INDEX ix_pago_cliente (id_cliente),
    CONSTRAINT fk_pago_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    CONSTRAINT fk_pago_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facturas (
    id_factura INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_cliente INT NOT NULL,
    numero_factura VARCHAR(30) NOT NULL UNIQUE,
    fecha_factura DATETIME NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'simulador',
    estado_pago VARCHAR(20) NOT NULL DEFAULT 'PAGADA',
    pdf_path VARCHAR(255) NULL,
    enviada_correo BOOLEAN NOT NULL DEFAULT FALSE,
    enviada_en DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_factura_pedido (id_pedido),
    INDEX ix_factura_cliente (id_cliente),
    CONSTRAINT fk_factura_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    CONSTRAINT fk_factura_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------
-- Contactos / consultas de soporte
-- ------------------------------
CREATE TABLE IF NOT EXISTS contactos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(120) NOT NULL,
    email_usuario VARCHAR(120) NOT NULL,
    asunto VARCHAR(180) NOT NULL,
    mensaje TEXT NOT NULL,
    categoria VARCHAR(40) NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    respuesta TEXT NULL,
    responded_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------
-- Variantes de color de productos
-- ------------------------------
CREATE TABLE IF NOT EXISTS producto_variantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    nombre VARCHAR(60) NOT NULL,
    hex VARCHAR(10) NULL,
    imagen_url VARCHAR(255) NULL,
    stock INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_variante_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------
-- Migraciones de columnas (idempotentes, seguras en BD existentes)
-- MySQL 8 no soporta "ADD COLUMN IF NOT EXISTS"; se usa information_schema.
-- ------------------------------
-- productos.venta_por_metros
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='venta_por_metros');
SET @sql = IF(@col = 0, 'ALTER TABLE productos ADD COLUMN venta_por_metros TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- productos.marca
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='marca');
SET @sql = IF(@col = 0, 'ALTER TABLE productos ADD COLUMN marca VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- productos.descripcion_producto
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='descripcion_producto');
SET @sql = IF(@col = 0, 'ALTER TABLE productos ADD COLUMN descripcion_producto TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- productos.colores_producto
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='colores_producto');
SET @sql = IF(@col = 0, 'ALTER TABLE productos ADD COLUMN colores_producto VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- productos.estado_producto
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='estado_producto');
SET @sql = IF(@col = 0, 'ALTER TABLE productos ADD COLUMN estado_producto VARCHAR(20) NOT NULL DEFAULT ''activo''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- productos.stock_producto
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='stock_producto');
SET @sql = IF(@col = 0, 'ALTER TABLE productos ADD COLUMN stock_producto INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- detalle_pedido.color_detalle
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='detalle_pedido' AND COLUMN_NAME='color_detalle');
SET @sql = IF(@col = 0, 'ALTER TABLE detalle_pedido ADD COLUMN color_detalle VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- detalle_pedido.largo_metros
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='detalle_pedido' AND COLUMN_NAME='largo_metros');
SET @sql = IF(@col = 0, 'ALTER TABLE detalle_pedido ADD COLUMN largo_metros DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- carrito_items.largo
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='carrito_items' AND COLUMN_NAME='largo');
SET @sql = IF(@col = 0, 'ALTER TABLE carrito_items ADD COLUMN largo DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- carrito_items: incluir largo en la clave única (producto+color+largo)
SET @idx = (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='carrito_items'
              AND INDEX_NAME='uq_carrito_item' AND COLUMN_NAME='largo');
SET @sql = IF(@idx = 0,
  'ALTER TABLE carrito_items DROP KEY uq_carrito_item, ADD UNIQUE KEY uq_carrito_item (id_cliente, id_producto, color, largo)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Productos que se venden por metro (cable UTP y cinta LED)
UPDATE productos SET venta_por_metros = 1
WHERE referencia_producto IN ('utp6-050', 'led-003') AND venta_por_metros = 0;

-- Marcas comerciales de los productos
UPDATE productos SET marca = 'Hikvision'  WHERE referencia_producto = 'smi-001';
UPDATE productos SET marca = 'Fibaro'     WHERE referencia_producto = 'ccd-004';
UPDATE productos SET marca = 'Ledvance'   WHERE referencia_producto = 'led-003';
UPDATE productos SET marca = 'Aqara'      WHERE referencia_producto = 'kit-001';
UPDATE productos SET marca = 'Steren'     WHERE referencia_producto = 'utp6-050';
UPDATE productos SET marca = 'Aqara'      WHERE referencia_producto = 'spd-006';
UPDATE productos SET marca = 'TP-Link'    WHERE referencia_producto = 'eiw-007';
UPDATE productos SET marca = 'Twinsol'    WHERE referencia_producto = 'ps12-5a';
UPDATE productos SET marca = 'Hikvision'  WHERE referencia_producto = 'cip-003';
UPDATE productos SET marca = 'Xtar'       WHERE referencia_producto = 'bat18650';
UPDATE productos SET marca = 'Honeywell'  WHERE referencia_producto = 'ter-101';
UPDATE productos SET marca = 'Sonoff'     WHERE referencia_producto = 'int-202';
UPDATE productos SET marca = 'Bosch'      WHERE referencia_producto = 'sir-303';
UPDATE productos SET marca = 'Kidde'      WHERE referencia_producto = 'dhu-404';
UPDATE productos SET marca = 'Somfy'      WHERE referencia_producto = 'per-505';
UPDATE productos SET marca = 'Fibaro'     WHERE referencia_producto = 'pan-606';

-- Precios reales (pesos colombianos) y descripciones de los productos por metros
UPDATE productos SET precio_compra_producto = 52000.00,   precio_venta_producto = 82000.00   WHERE referencia_producto = 'smi-001';
UPDATE productos SET precio_compra_producto = 190000.00,  precio_venta_producto = 285000.00  WHERE referencia_producto = 'ccd-004';
UPDATE productos SET precio_compra_producto = 7000.00,    precio_venta_producto = 14000.00,
       descripcion_producto = 'Cinta LED RGB con control por app y 16 millones de colores. Venta por metros: elige la longitud que necesitas.' WHERE referencia_producto = 'led-003';
UPDATE productos SET precio_compra_producto = 175000.00,  precio_venta_producto = 260000.00  WHERE referencia_producto = 'kit-001';
UPDATE productos SET precio_compra_producto = 2100.00,    precio_venta_producto = 3500.00,
       descripcion_producto = 'Cable UTP Cat6 blindado para redes de alta velocidad. Venta por metros: elige el color y la longitud que necesitas.' WHERE referencia_producto = 'utp6-050';
UPDATE productos SET precio_compra_producto = 30000.00,   precio_venta_producto = 45000.00   WHERE referencia_producto = 'spd-006';
UPDATE productos SET precio_compra_producto = 46000.00,   precio_venta_producto = 69000.00   WHERE referencia_producto = 'eiw-007';
UPDATE productos SET precio_compra_producto = 39000.00,   precio_venta_producto = 58000.00   WHERE referencia_producto = 'ps12-5a';
UPDATE productos SET precio_compra_producto = 165000.00,  precio_venta_producto = 245000.00  WHERE referencia_producto = 'cip-003';
UPDATE productos SET precio_compra_producto = 11000.00,   precio_venta_producto = 18000.00   WHERE referencia_producto = 'bat18650';
UPDATE productos SET precio_compra_producto = 100000.00,  precio_venta_producto = 155000.00  WHERE referencia_producto = 'ter-101';
UPDATE productos SET precio_compra_producto = 43000.00,   precio_venta_producto = 65000.00   WHERE referencia_producto = 'int-202';
UPDATE productos SET precio_compra_producto = 62000.00,   precio_venta_producto = 95000.00   WHERE referencia_producto = 'sir-303';
UPDATE productos SET precio_compra_producto = 55000.00,   precio_venta_producto = 85000.00   WHERE referencia_producto = 'dhu-404';
UPDATE productos SET precio_compra_producto = 255000.00,  precio_venta_producto = 380000.00  WHERE referencia_producto = 'per-505';
UPDATE productos SET precio_compra_producto = 600000.00,  precio_venta_producto = 890000.00  WHERE referencia_producto = 'pan-606';

-- =====================================================
-- REGISTROS GUARDADOS AUTOMÁTICAMENTE
-- (Generado automáticamente por el backend - no editar a mano)
-- =====================================================

INSERT IGNORE INTO clientes (id_cliente, first_name, last_name, id_tipo_documento_c, documento_cliente, telefono_cliente, email, address, password_hash, is_active, verification_token, created_at) VALUES
(1, 'LAURA', 'GARCÍA ROJAS', 1, 1023456789, 3012345678, 'laura.garcia@gmail.com', 'Cl 12 #10-30', '$2b$12$VRyMg0I6DWl55vc65A47i.5t9haLrmmU/aYJneVW/ACvZHbfNib3S', 1, NULL, '2026-08-20 06:04:00'),
(2, 'DANIELA', 'RAMÍREZ PEÑA', 1, 1034567890, 3023456789, 'daniela.ramirez@gmail.com', 'Av 30 #15-09', '$2b$12$l/vqKnGbLFTCTqG1DIzDguVdjEumyuVh1GuB0K2a54BYDQJOSVX5m', 1, NULL, '2026-08-20 06:04:00'),
(3, 'ANDRÉS', 'GONZÁLEZ MORA', 2, 1045678901, 3034567890, 'andres.gonzalez@gmail.com', 'Mz A Casa 10', '$2b$12$uYRdQEbNVUFasS5ui5SM2uPtsIqfmDR8FZNPZFQhmZa5xMM4bUqoS', 1, NULL, '2026-08-20 06:04:00'),
(4, 'MARIANA', 'SUÁREZ LÓPEZ', 1, 1056789012, 3045678901, 'mariana.suarez@gmail.com', 'Cl 8B #20-45', '$2b$12$ymCoZGBD2oS0e02Slm6yyux5vZOc.qKeFVcvOVXK4UALdqyj39tq.', 1, NULL, '2026-08-20 06:04:00'),
(5, 'NATALIA', 'CASTRO JIMÉNEZ', 1, 1078901234, 3067890123, 'natalia.castro@gmail.com', 'Cl 19 #13-55', '$2b$12$QicmTvwjzSycXLS.pNs9U.M9MDCa9yqiLbiu6y/xLJ8I0f2.AI5pC', 1, NULL, '2026-08-20 06:04:00'),
(6, 'FELIPE', 'MARTÍNEZ PÉREZ', 1, 1089012345, 3078901234, 'felipe.martinez@gmail.com', 'Av 68 #54-23', '$2b$12$yc7fo26B1DPBKAOcV8BeHeH994AY48ubye9oStSMLYoKCZbqw8Q8u', 1, NULL, '2026-08-20 06:04:00'),
(7, 'CAMILA', 'ORTIZ SALAZAR', 2, 1090123456, 3089012345, 'camila.ortiz@gmail.com', 'Cl 100 #25-10', '$2b$12$MyIbUesx1ZzHK8rPGGJSvOFx0hthEPwm4EtR2TvShKG2DQImxjBLS', 1, NULL, '2026-08-20 06:04:00'),
(8, 'SEBASTIÁN', 'LÓPEZ ROMERO', 1, 1101234567, 3090123456, 'sebastian.lopez@gmail.com', 'Cra 7 #89-12', '$2b$12$1C1ajWz7iHcUfXCDQNZQ8.FNJCz95XgR9kEd/p6UplhMHgBMKtYSW', 1, NULL, '2026-08-20 06:04:00'),
(9, 'SOFÍA', 'RAMÍREZ ORTEGA', 1, 1112345678, 3101234567, 'sofia.ramirez@gmail.com', 'Cl 50 #12-34', '$2b$12$t3OnFDm1P4RltSZPRgjDOev9N0qV/SQwOnq6Hl72SpJR/.DBR.cVy', 1, NULL, '2026-08-20 06:04:00'),
(10, 'MATEO', 'GUTIÉRREZ PARDO', 2, 1123456789, 3112345678, 'mateo.gutierrez@gmail.com', 'Av 20 #45-67', '$2b$12$f6ylGtGUGkuRFrjEVi7O0eyVCf0K7z2rPXvY.9yy/ysTSs37F/NIi', 1, NULL, '2026-08-20 06:04:00'),
(11, 'CORREO', 'PRUEBAS', 1, 1202635296, 6458745612, 'correopruebas706@gmail.com', 't5tryguhjikl', '$2b$12$5J9tOUIeL.j.HnaVLGhYvuvlLTolroPAEHbcZj6wAVjEZn0ln0/pG', 1, NULL, '2026-08-20 06:41:21'),
(12, 'NICOL', 'MARIÑO ROMERO', NULL, NULL, NULL, 'nicolmarinoromero@gmail.com', NULL, '$2b$12$qXcrayxYEj.IxZwxQET3juVnr8uZUlaeke4LYjmmTMxrw9dSocHle', 1, NULL, '2026-08-20 06:44:54');

INSERT IGNORE INTO usuarios (id_usuario, first_name, last_name, id_tipo_documento_u, documento_usuario, telefono_usuario, email, password_hash, id_rol_u, is_active, created_at) VALUES
(1, 'CARLOS ANDRÉS', 'GÓMEZ RÍOS', 1, 1023456790, 3001234567, 'carlos.andres.gomez@gmail.com', '$2b$12$H1kwD2W/591RwYwl37Mhcu7.40a3xDmtP.hbFJkAFQwqIbis3x8bq', 2, 1, '2026-08-20 06:04:00'),
(2, 'JORGE DANIEL', 'CHARRY PÉREZ', 1, 1034567890, 3002345678, 'jorge.charry@gmail.com', '$2b$12$dwOnYWHM/W.mhVu9NDl8h.EP0daXYiHQTcOPn/Bp0gnmRfjmIRvVm', 2, 1, '2026-08-20 06:04:00'),
(3, 'JUAN SEBASTIÁN', 'MORENO TORRES', 1, 1078901234, 3003456789, 'juan.moreno@gmail.com', '$2b$12$5eEUq30.2NV88vRykg2xO.aN6tpLIfNwiJ5gJt6vwWTP3nLJdL/F6', 2, 1, '2026-08-20 06:04:00'),
(4, 'LUIS EDUARDO', 'MARTÍNEZ GAITÁN', 1, 1090123456, 3004567890, 'luis.martinez@gmail.com', '$2b$12$CI5tiy42TUA8pzPtDIDwGOT20UL6IrsaBaxZGOgPmT0CyatD1aSuq', 1, 1, '2026-08-20 06:04:00'),
(5, 'ANDRÉS MAURICIO', 'LÓPEZ VARGAS', 1, 1056789012, 3005678901, 'andres.lopez@gmail.com', '$2b$12$CoC/AboFi05FPEwAztiyPuu4m4.pMz00vapjOc3vqvV/Xiyt2r9pO', 2, 1, '2026-08-20 06:04:00'),
(6, 'CAMILA ANDREA', 'RODRÍGUEZ PEÑA', 1, 1089012345, 3006789012, 'camila.rodriguez@gmail.com', '$2b$12$MNU94.EsJ0i20poSrwjL7.BNK9vBwfrdRktr6rTILlw18oaHid0J.', 1, 1, '2026-08-20 06:04:00'),
(7, 'NICOL ALEJANDRA', 'MARIÑO ROMERO', 1, 1045678901, 3007890123, 'nicolmarinoromero@gmail.com', '$2b$12$YIsMSPChGdLXDw/BvanA/epjh3EBckLuhXSIsoSq/iV.ub5DxV2ay', 1, 1, '2026-08-20 06:04:00'),
(8, 'LAURA MARCELA', 'PÉREZ DUARTE', 2, 1009876543, 3008901234, 'nicolmarino09@gmail.com', '$2b$12$xxjzjo79.ikUB/4LBGhKaeXl8zCSFEUhxtaScxbHI2bWKVLJ1H5lO', 2, 1, '2026-08-20 06:04:00'),
(9, 'JULIÁN FELIPE', 'CARVAJAL CABALLERO', 2, 1012345678, 3009012345, 'julian.carvajal@gmail.com', '$2b$12$KIXpzCv6VxPqCQzO4QH3eO8yYjZqXVNZYbGcYX7tZQ0cZ6sJZy3MG', 2, 1, '2026-08-20 06:04:00'),
(10, 'MARÍA FERNANDA', 'RINCÓN SALAZAR', 2, 1067890123, 3010123456, 'maria.rincon@gmail.com', '$2b$12$KIXpzCv6VxPqCQzO4QH3eO8yYjZqXVNZYbGcYX7tZQ0cZ6sJZy3MG', 2, 1, '2026-08-20 06:04:00'),
(15, 'DANIEL ALEJANDRO', 'SÁNCHEZ MORALES', NULL, 1001234567, 3011234567, 'daniel.sanchez@gmail.com', '$2b$12$HLaekfaKuq1NId4vSFOHw.QRRkSrnQzizj5aiSlUEHotMzfZXSHQy', 2, 1, '2026-08-20 09:23:31'),
(16, 'VALENTINA', 'GÓMEZ CASTRO', NULL, 1002345678, 3012345678, 'valentina.gomez@gmail.com', '$2b$12$0NsVrp9b6nR8hLFDs9yuROaP3Aka17ySD0X7X/PszPX4eiHv0y4I.', 2, 1, '2026-08-20 09:23:31'),
(17, 'SEBASTIÁN', 'TORRES ORTIZ', NULL, 1003456789, 3013456789, 'sebastian.torres@gmail.com', '$2b$12$QShDW3tQFtj4JLaMI2pzo.tj41gewmi7UmEt3hhPCUKfDF2pTDmuW', 2, 1, '2026-08-20 09:23:32'),
(18, 'pepito', 'perez', NULL, 114065589, 3102555888, 'correopruebas706@gmail.com', '$2b$12$igPZ7E4lcy5KsBWITEd2pO12hjV3atlrWQt8S0RepWE91yWDhMlcC', 2, 1, '2026-08-20 13:48:05');

INSERT IGNORE INTO tecnicos (id_tecnico, id_usuario_t, certificacion_t, cargo_t) VALUES
(1, 1, 'Certificación en Redes y Cableado Estructurado', 'Junior'),
(2, 2, 'Certificación en Instalación de Domótica', 'Junior'),
(3, 3, 'Certificación en Seguridad Electrónica', 'Semi Senior'),
(4, 4, 'Certificación en Soporte de Sistemas IoT', 'Junior'),
(5, 5, 'Certificación en Programación de PLCs', 'Senior'),
(6, 6, 'Certificación en Bases de Datos y Servidores', 'Senior'),
(7, 7, 'Certificación en Automatización de Hogares', 'Semi Senior'),
(8, 8, 'Certificación en Seguridad Informática', 'Senior'),
(9, 9, 'Certificación en Programación Backend', 'Semi Senior'),
(10, 10, 'Certificación en Gestión de Proyectos', 'Senior'),
(11, 15, 'Técnico certificado en sistemas domésticos', 'Técnico instalador'),
(12, 16, 'Técnica en automatización del hogar', 'Técnica instaladora'),
(13, 17, 'Técnico en redes y domótica', 'Técnico instalador'),
(14, 18, 'gtyhjkl', 'Semi Senior');

