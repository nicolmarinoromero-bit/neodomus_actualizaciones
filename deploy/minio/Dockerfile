# Servicio MinIO para Railway (bloques públicos/privados del catálogo y
# evidencias). Se apoya en la imagen elestio/minio ya probada en los
# entornos de desarrollo y respaldo.
FROM elestio/minio:latest

# DS-0002 (Trivy, HIGH): el contenedor NO corre como root. MinIO no
# necesita privilegios: escucha en 9000/9001 (>1024) y Railway monta el
# volumen /data con la propiedad del usuario declarado en el Dockerfile.
USER 1000
