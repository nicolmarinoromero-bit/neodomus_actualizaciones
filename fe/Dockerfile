FROM node:22-alpine

# COREPACK_HOME compartido: corepack enable/prepare corren como root y su
# caché quedaría en /root; el runtime (usuario 'node') no la vería y corepack
# descargaría OTRA versión de pnpm en cada arranque. Con ENV compartido y
# legible, el runtime usa el mismo pnpm@11.4.0 del build, sin red.
ENV COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate \
 && chmod -R a+rX "$COREPACK_HOME"

ENV CI=true

WORKDIR /app

# pnpm-workspace.yaml es parte de la instalación: contiene 'allowBuilds'
# (aprobación de scripts de build, p. ej. esbuild). Sin copiarlo, pnpm 11
# aborta en CI con ERR_PNPM_IGNORED_BUILDS.
COPY fe/package.json fe/pnpm-lock.yaml fe/pnpm-workspace.yaml ./
# --frozen-lockfile (S8544): instala estrictamente lo resuelto en
# pnpm-lock.yaml; nunca re-resuelve versiones nuevas en el build.
RUN pnpm install --frozen-lockfile

# El servidor de desarrollo corre sin privilegios de root.
RUN chown -R node:node /app
USER node

# Copia con listado explícito (S6470): evita arrastrar archivos sensibles o
# ajenos a la imagen (p. ej. .env, artefactos dist/, stores de paquetes).
COPY fe/index.html fe/vite.config.ts fe/tsconfig.json fe/tsconfig.node.json fe/tsconfig.app.json ./
COPY fe/playwright.config.ts fe/vite-env.d.ts ./
COPY fe/src ./src
COPY fe/public ./public
COPY fe/e2e ./e2e
COPY shared /shared

EXPOSE 5173

CMD ["pnpm", "run", "dev"]
