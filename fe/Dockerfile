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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --frozen-lockfile (S8544): instala estrictamente lo resuelto en
# pnpm-lock.yaml; nunca re-resuelve versiones nuevas en el build.
RUN pnpm install --frozen-lockfile

# El servidor de desarrollo corre sin privilegios de root.
RUN chown -R node:node /app
USER node

# Copia con listado explícito (S6470): evita arrastrar archivos sensibles o
# ajenos a la imagen (p. ej. .env, artefactos dist/, stores de paquetes).
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json tsconfig.app.json ./
COPY playwright.config.ts vite-env.d.ts ./
COPY src ./src
COPY public ./public
COPY e2e ./e2e

EXPOSE 5173

CMD ["pnpm", "run", "dev"]
