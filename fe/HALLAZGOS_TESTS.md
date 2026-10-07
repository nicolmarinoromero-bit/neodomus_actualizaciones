# Hallazgos detectados durante la creación de la suite de tests

Estos son los comportamientos observados al escribir las pruebas de `fe/src`.
**No se ha modificado ningún archivo de producción**: todo queda anotado aquí
para su revisión.

## 1. Registro: mensajes de validación inalcanzables (`Register.tsx`)

- El botón **"Registrarse"** está deshabilitado mientras `!isFormValid`, y
  `isFormValid` exige `formData.password === formData.password2`.
- Por tanto, al enviar el formulario **nunca** puede darse el caso
  `password !== password2`, de modo que los mensajes
  `"Los correos no coinciden."` y `"Las contraseñas no coinciden."` de
  `validateForm()` son **código muerto**: el usuario nunca los verá (el error
  se muestra antes, en el propio campo, al deshabilitar el botón).
- Los tests solo verifican que el botón queda deshabilitado; no se puede
  probar la rama de error porque es inalcanzable vía UI.

## 2. Registro: `tipo_documento` inicial inconsistente con el `<select>`

- `formData.tipo_documento` se inicializa en `2` (que corresponde a **CE**,
  Pasaporte/CE en el catálogo), mientras que el `<select>` de tipo de
  documento usa `defaultValue="1"` (**CC**) y no está controlado.
- Como el `select` no dispara `onChange` al montar, el estado **no se
  sincroniza** con lo que el usuario ve: si no cambia el desplegable, el
  payload enviado al backend lleva `id_tipo_documento_c: 2` (CE) aunque en
  pantalla muestre "Cédula de ciudadanía".
- Recomendación: inicializar `tipo_documento` en `"1"` o hacer el `select`
  controlado con `value={formData.tipo_documento}`.

## 3. Carrito: mensajes de error de stock solo en el primer dispatch

- En `CartContext` (`addItem`, `updateQuantity`, `updateMetros`), el estado
  de error (`cartError`/`mensaje`) se calcula dentro del *updater* de
  `dispatch({ type: 'HYDRATE', payload })`, que React ejecuta de forma
  **diferida** tras el render. En la práctica esto implica que:
  - El mensaje de error devuelto solo refleja el resultado del **primer
    dispatch** efectivo tras montar el contexto; en llamadas posteriores el
    valor retornado puede quedar desfasado respecto al estado ya persistido.
  - Para probar el mensaje de error fue necesario sembrar el ítem en
    `localStorage` antes de montar, porque en el montaje inicial el estado
    aún está vacío.
- Recomendación: calcular la validación de stock **antes** del dispatch y
  devolver el resultado de forma síncrona (o exponer el error vía estado).

## 4. Login: texto `detail` duplicado en dos cajas de error

- En `Login.tsx` se renderizan a la vez la caja de error general
  (`error`) y la caja de reactivación de cuenta (`infoMessage`). Cuando el
  backend devuelve un `detail` (p. ej. cuenta desactivada), **el mismo texto
  aparece en ambas cajas**, duplicándose visualmente en pantalla.

## 5. Conflicto de peers preexistente en las dependencias

- `@typescript-eslint/eslint-plugin@7` exige `@typescript-eslint/parser@^6`,
  pero el proyecto instala `parser@8` → `npm install` falla con ERESOLVE
  salvo con `--legacy-peer-deps` (o `legacy-peer-deps=true` en `.npmrc`).
- Efecto colateral: con `--legacy-peer-deps` npm **no instala dependencias
  transitive por peers**, por lo que hubo que añadir explícitamente
  `@testing-library/dom` (peer de `@testing-library/react`).
- Este conflicto **no lo introduce la suite de tests**: existía antes de tocar
  el `package.json`.

## 6. Lockfiles duplicados

- El repositorio tiene `package-lock.json` **y** `pnpm-lock.yaml`. La
  instalación se hizo con **npm** (pnpm no está en el PATH del entorno), por
  lo que `package-lock.json` quedó actualizado y `pnpm-lock.yaml` quedó
  desactualizado. Conviene elegir un único gestor y borrar el lockfile no
  usado para evitar instalaciones divergentes.

## 7. Cobertura global menguada por páginas monolíticas

- El coverage global de statements (~11 %) se ve arrastrado por páginas muy
  grandes sin test (`CheckoutPage.tsx` 1162 líneas, `OrdersTab.tsx` 1109,
  `Perfil.tsx` 666, `TecnicoCitas.tsx` 714, `Novedades` 1373, etc.), casi
  todas con efectos secundarios (red, `window.print`, websockets) difíciles de
  aislar sin tocar producción.
- Los módulos con lógica pura sí están bien cubiertos (ver el resumen del
  reporte de coverage): `services/api.ts` 99 %, `i18n/translations.ts` 99 %,
  `contexts/*` 88 %, `utils/*` 96 %, `Login` 82 %, `Register` 89 %.
