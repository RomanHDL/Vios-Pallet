// Historial de versiones (semver). Mantener igual que CHANGELOG.md; la primera entrada es la version
// de package.json.
export const CHANGELOG = [
  {
    version: '1.2.1',
    date: '2026-10-07',
    title: 'Parches de seguridad',
    fixed: [
      'Dependencias parchadas (shell-quote, basic-ftp, js-yaml): el escaneo de seguridad del servidor detenía la página.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-07',
    title: 'Solo botón Entrar',
    changed: [
      'La pantalla de inicio ya no pide usuario ni contraseña: solo el botón "Entrar". El formulario del administrador quedó en /?admin.',
      'El botón "Entrar" ya no se puede apagar con una variable del servidor (GUEST_LOGIN se ignora).',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-07',
    title: 'Entrada con un clic',
    added: [
      'Botón "Entrar" sin usuario ni contraseña (cuenta compartida Planta, permisos de supervisor). El administrador entra con "Entrar con usuario". Se puede apagar con GUEST_LOGIN=off.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-07',
    title: 'Primera versión',
    added: [
      'Login con roles (administrador, supervisor, operador, calidad); cada registro guarda quién lo hizo.',
      'Pallets: entrada (ID de 6 dígitos + piezas), salida (ID-S) con conciliación pieza por pieza y motivo obligatorio por faltante, hoja imprimible con firmas, historial y búsqueda de serial.',
      'Producción: registro de producto terminado (serial TV = serial caja) por estación, líneas en vivo, detalle por hora, plan y personal por turno, historial.',
      'Calidad: rechazos por serial con defectos del catálogo; un serial rechazado no se puede registrar como producción.',
      'Reportes: Plan vs Real con Delta y Recovery por turno, producción por modelo contra objetivos MTY/Texas con proyección, personal y productividad, dashboard de pallets.',
      'Administración de usuarios y catálogos (líneas y metas, modelos y prefijos, marcas, defectos).',
      'Escaneo con pistola lectora o con la cámara del celular; diseño para PC y celular; modo oscuro.',
      'Manual de usuario, manual de desarrollador y este historial de cambios.',
    ],
    fixed: [
      'Plan: ya no es "400 por cada línea que registró algo"; es el plan capturado o la meta de las líneas activas.',
      'El Turno 2 (22:00–07:00) se cuenta completo en la fecha en que empieza.',
      'Serial único en la base de datos: dos escaneos simultáneos no duplican producción.',
      'El reporte por modelo separa producido, rechazado y neto (antes los totales no cuadraban).',
    ],
  },
]
