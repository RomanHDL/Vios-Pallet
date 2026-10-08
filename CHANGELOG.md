# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), versionado [semver](https://semver.org/lang/es/)
(`version` de `package.json`). Mantener igual que `src/pages/docs/changelog.js` (se muestra en la app en Ayuda → Cambios).

## [1.6.1] — 2026-10-07

### Changed
- Reporte de salida: logo oficial de MI Technologies, Inc. (`public/mi-technologies.png`).

## [1.6.0] — 2026-10-07

### Added
- Reporte de salida imprimible (`/pallets/:id/reporte`, `GET /api/pallets/:id/report`).

### Changed
- El reporte solo existe para salidas cerradas con `closed_at` (validado en servidor con `exitReportBlock` y en la
  página). Se quitó la hoja de impresión anterior del detalle del pallet.
- Inicio rediseñado; sin botón "Escanear salida" en Inicio. Menú lateral: elemento activo en azul.

## [1.5.1] — 2026-10-07

### Changed
- Personal y productividad: piezas de salidas cerradas del turno ÷ personas del turno (`outputByShift`).

## [1.5.0] — 2026-10-07

### Added
- Producción con el diseño de pantalla de línea: conteo contra meta, desde último scan, por hora, promedio por unidad,
  proyección del turno y con tiempo extra, producción por hora.

### Changed
- Personal del turno pasó a Reportes (`/reportes/personal-turno`, solo personas). Hora por Hora solo en el menú.
- Fuera del menú: Líneas en vivo, Registrar producto terminado e Historial de producción. Inicio: botón "Escanear salida".

## [1.4.3] — 2026-10-07

### Fixed
- Producción y Reporte del día: mismo conteo (salidas cerradas) y meta del día (765) que Inicio y Hora por Hora.

## [1.4.2] — 2026-10-07

### Changed
- Producción del turno = solo piezas de pallets de salida cerrados (sin Registrar ni salidas abiertas).

## [1.4.1] — 2026-10-07

### Fixed
- Tiempo por pieza y proyección se miden desde la primera pieza del turno (no desde las 07:00).

## [1.4.0] — 2026-10-07

### Changed
- Producción del turno = piezas escaneadas en pallets de salida + registradas en Producción, sin dividir por línea
  (`server/output.js`), en Inicio y Hora por Hora.
- Meta del día 765 por defecto, ajustable (`hourly_goals`, scope `total`).

### Added
- Tiempo por pieza y proyección al fin del turno (`shared/pace.js`).

## [1.3.1] — 2026-10-07

### Fixed
- Hora por Hora: con barras muy bajas las diferencias de arriba ya no se enciman entre horas.

## [1.3.0] — 2026-10-07

### Added
- Módulo Hora por Hora VIOS (`/hora-por-hora`): conteo por hora con el diseño de Centro de Trabajo, plan del turno
  editable por fecha, turno y línea (tabla `hourly_goals`, vigente hasta que se cambie) y pantalla completa para
  tablet vertical.

## [1.2.1] — 2026-10-07

### Security
- Dependencias parchadas (shell-quote, basic-ftp, js-yaml) en `pnpm-workspace.yaml`: el escaneo de Coolify
  detenía el despliegue por un hallazgo Critical.

## [1.2.0] — 2026-10-07

### Changed
- La pantalla de inicio ya no pide usuario ni contraseña: solo el botón "Entrar". El formulario del administrador
  quedó en `/?admin`.
- El botón "Entrar" ya no se puede apagar con una variable del servidor (`GUEST_LOGIN` se ignora).

## [1.1.0] — 2026-10-07

### Added
- Botón "Entrar" sin usuario ni contraseña (cuenta compartida Planta, permisos de supervisor). El administrador
  entra con "Entrar con usuario". Se apaga con `GUEST_LOGIN=off`.

## [1.0.0] — 2026-10-07

### Added
- Login con roles (administrador, supervisor, operador, calidad); cada registro guarda quién lo hizo.
- Pallets: entrada (ID de 6 dígitos + piezas), salida (`ID-S`) con conciliación pieza por pieza y motivo obligatorio
  por faltante, hoja imprimible con firmas, historial y búsqueda de serial.
- Producción: registro de producto terminado (serial TV = serial caja) por estación, líneas en vivo, detalle por hora,
  plan y personal por turno, historial.
- Calidad: rechazos por serial con defectos del catálogo; un serial rechazado no se puede registrar como producción.
- Reportes: Plan vs Real con Delta y Recovery por turno, producción por modelo contra objetivos MTY/Texas con
  proyección, personal y productividad, dashboard de pallets.
- Administración de usuarios y catálogos (líneas y metas, modelos y prefijos, marcas, defectos).
- Escaneo con pistola lectora o con la cámara del celular; diseño para PC y celular; modo oscuro.
- Manual de usuario, manual de desarrollador y página de cambios.

### Fixed (respecto a PalletScan)
- Plan: plan capturado o meta de las líneas activas, no "400 por cada línea que registró algo".
- El Turno 2 (22:00–07:00) se cuenta completo en la fecha en que empieza.
- Serial único en la base de datos: dos escaneos simultáneos no duplican producción.
- El reporte por modelo separa producido, rechazado y neto.
