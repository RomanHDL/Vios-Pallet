// Historial de versiones (semver). Mantener igual que CHANGELOG.md; la primera entrada es la version
// de package.json.
export const CHANGELOG = [
  {
    version: '1.21.0',
    date: '2026-10-08',
    title: 'Personal = áreas de trabajo',
    changed: [
      'Personal y productividad y Reporte del día: cada área (Entrada, Producción por línea, Salida) que escaneó en el turno cuenta como 1 persona, sin capturar nada. Lo producido no cambia (una vez por serial) y se ve cuántas piezas escaneó cada área.',
    ],
  },
  {
    version: '1.20.3',
    date: '2026-10-08',
    title: 'Control de Pallet sin botón repetido',
    changed: ['Vista de administrador: se quitó el botón "Producción por línea" de arriba; ya está la tarjeta entre Entrada y Salida.'],
  },
  {
    version: '1.20.2',
    date: '2026-10-08',
    title: 'Contraseña de admin: más tolerante',
    fixed: ['ADMIN_INITIAL_PASSWORD se aplica sin espacios ni comillas alrededor, y crea el usuario admin si no existía.'],
  },
  {
    version: '1.20.1',
    date: '2026-10-08',
    title: 'Contraseña de admin desde Coolify',
    fixed: ['Si se cambia ADMIN_INITIAL_PASSWORD en Coolify, la contraseña de admin se actualiza al reiniciar (una vez por valor nuevo).'],
  },
  {
    version: '1.20.0',
    date: '2026-10-08',
    title: 'Áreas de trabajo',
    changed: [
      'Ya no hay botón "Entrar": se entra por área. Entrada solo ve entrada de pallets y Calidad; Salida solo salida y Calidad; Producción por línea solo su estación. Admin (con contraseña) ve todo.',
      'El servidor también limita las acciones de cada área (por ejemplo, desde Entrada no se puede registrar una salida).',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-10-08',
    title: 'Accesos directos al entrar',
    added: [
      'La pantalla de entrada tiene 4 accesos: Entrada, Salida y Producción por línea abren directo su pantalla; Admin pide la contraseña del administrador y abre Control de Pallet.',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-10-08',
    title: 'Control de Pallet para administrador',
    added: [
      'Pallets (solo administrador): recorrido Entrada → Producción por línea → Salida con pallets activos por etapa, filtro por turno, resumen operativo, flujo del pallet y pallets detenidos con umbrales que configura el administrador.',
    ],
    changed: ['La cuenta Planta conserva su vista de Pallets sin cambios.'],
  },
  {
    version: '1.17.0',
    date: '2026-10-08',
    title: 'Progreso visual de pallets',
    added: [
      'Dashboard de pallets: nueva sección "Progreso visual de pallets" con una tarima de madera por salida iniciada, que se llena con cajas conforme escanean piezas (los lugares que faltan se ven como cajas transparentes).',
      'Los pallets pendientes van primero (de menor a mayor avance) y siempre se ven; los consolidados rotan cada 10 s en los lugares que sobran. Flechas y botón para pausar.',
    ],
    changed: [
      'Dashboard de pallets: filtros arriba a la derecha, tarjetas con el ícono a la izquierda y panel de Estados con "Sin iniciar".',
    ],
  },
  {
    version: '1.16.1',
    date: '2026-10-08',
    title: 'Corrección: el servidor no arrancaba',
    fixed: ['La versión 1.16.0 dejaba el sitio en 502 al iniciar; ya arranca normal.'],
  },
  {
    version: '1.16.0',
    date: '2026-10-08',
    title: 'Ajuste de producción por marca',
    added: [
      'Hora x Hora: un supervisor puede tocar "Ajustar" en HY o SILO y capturar cuántas piezas se hicieron de verdad en el turno. El ajuste cambia el total en Hora x Hora, Inicio y Reportes, y se puede quitar.',
    ],
    fixed: [
      'Producción por modelo con filtro de marca ya no muestra pallets de la otra marca.',
    ],
  },
  {
    version: '1.15.1',
    date: '2026-10-08',
    title: 'Sin "Personal del turno" en Reportes',
    changed: [
      'Se quitó el apartado Personal del turno de Reportes. El personal se sigue capturando por línea en Pallets → Producción por línea.',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-10-08',
    title: 'Producción diaria con número y modelo por día',
    added: [
      'En la gráfica de Producción por modelo, arriba de cada día se ve el total y cuánto fue de cada modelo (EL-32, J0-43, EL-43…); al tocar un punto sale el desglose.',
    ],
  },
  {
    version: '1.14.2',
    date: '2026-10-08',
    title: 'Pallets por marca iguales en todos lados',
    fixed: [
      'Producción por modelo cuenta los pallets HY / SILO del día igual que Hora x Hora e Inicio.',
    ],
  },
  {
    version: '1.14.1',
    date: '2026-10-08',
    title: 'Pallet de ayer cuenta completo en ayer',
    fixed: [
      'Un pallet cuya entrada es de ayer cuenta completo en ayer, aunque se le hayan agregado teles hoy.',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-10-08',
    title: 'Números del día en Producción por modelo',
    added: [
      'Arriba de Producción por modelo: los números del día (hoy o el que elijas): producido contra meta, piezas por modelo y HY / SILO en piezas y pallets.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-10-08',
    title: 'Producción por marca (HY / SILO)',
    added: [
      'Hora x Hora, Inicio y Reporte del día muestran la producción dividida en HY y SILO: piezas y pallets de salida cerrados.',
    ],
    changed: [
      'Los pallets cuya entrada es de otro día cuentan en el día de su entrada (los de ayer van a ayer, no a hoy).',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-10-08',
    title: 'Producción: sin pallets de ayer ni entradas sin salida',
    changed: [
      'La producción del día (Hora x Hora, Inicio, Reportes) ya no cuenta las teles de pallets de entrada de otro día ni las de una entrada que todavía no tiene su salida cerrada.',
    ],
  },
  {
    version: '1.11.3',
    date: '2026-10-08',
    title: 'Quitar tele repetida de la entrada',
    added: [
      'En Piezas pendientes de la salida, si una tele también está en otro pallet de entrada, un supervisor puede tocar "Quitar de la entrada" y la salida deja de esperarla.',
    ],
  },
  {
    version: '1.11.2',
    date: '2026-10-08',
    title: 'Faltantes: en qué pallet están',
    added: [
      'Si una pieza faltante de una salida está escaneada en otro pallet, se muestra "Está en: <pallet>" con liga directa (detalle de la salida, Piezas pendientes y conciliación).',
    ],
  },
  {
    version: '1.11.1',
    date: '2026-10-08',
    title: 'Una tele, un solo pallet',
    changed: [
      'En la entrada ya no se acepta una tele que está en otro pallet ID (antes solo avisaba); dice en qué pallet está. Junto con la regla de salida, las teles de un pallet solo pueden salir en la salida de ese mismo pallet.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-10-08',
    title: 'Rechazos históricos en Calidad',
    added: [
      'Calidad incluye los 31 registros de la hoja "MTY - VIOS/HY" (14 al 24 Sep): fecha, pallet, serial, defecto y comentarios, marcados como "Histórico".',
      'Rango "Todo" en Calidad para ver todos los rechazos.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-10-08',
    title: 'Salida solo con piezas de su entrada y piezas pendientes',
    changed: [
      'En la salida solo entran las teles de su pallet de entrada; si escanean una de otro pallet, no se acepta y se avisa de qué pallet es.',
    ],
    added: ['Botón "Piezas pendientes" en la salida: lista con buscador de las piezas de la entrada que aún no salen.'],
  },
  {
    version: '1.9.1',
    date: '2026-10-08',
    title: 'Histórico de PalletScan en Producción por modelo',
    added: [
      'Producción por modelo suma el histórico de PalletScan (11 Sep – 2 Oct): HY EL-32" 2,602 piezas (32 rechazadas) y SILO EL-43" 386 piezas (6 rechazadas), más lo que se produce en VIOS.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-10-08',
    title: 'Tele diferente y conteo por línea',
    added: [
      'Entrada: botón "Agregar tele diferente" para meter una tele de otro modelo (ej. JL en un pallet EL) sin error; queda marcada como "Diferente" en la lista, la salida y el reporte impreso.',
    ],
    changed: [
      'La producción del turno (Inicio, Producción, Hora x Hora y reportes) suma las salidas cerradas y lo escaneado TV + caja en Producción por línea; cada serie cuenta una vez.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-08',
    title: 'Registro por línea: marca, modelo y línea',
    added: [
      'En Producción por línea: elegir Marca → Modelo → Línea y escanear serial de TV y de caja (deben coincidir). Cada línea muestra sus piezas, personas y piezas por persona.',
      'Modelo J0-50" en el catálogo (EL-32", J0-43", EL-43", EL-50", J0-50").',
    ],
    changed: ['La salida ya no pide línea. La producción del turno (Inicio, Hora x Hora) sigue siendo solo salidas cerradas.'],
  },
  {
    version: '1.7.0',
    date: '2026-10-08',
    title: 'Producción por línea',
    added: [
      'Botón "Producción por línea" en Pallets: piezas de salidas cerradas del turno por línea, personas, piezas por persona y último escaneo; filtro HY/SILO y "Editar personal".',
      'Al iniciar una salida se elige la línea (se recuerda en cada equipo) y se ve en el detalle del pallet.',
    ],
  },
  {
    version: '1.6.2',
    date: '2026-10-07',
    title: 'Reportes sincronizados',
    fixed: [
      'Producción por modelo cuenta lo mismo que Producción, Hora x Hora, Inicio y el Reporte del día: piezas de salidas cerradas, con la meta del día como referencia.',
      'Calidad marca "Ya producido" cuando el serial salió en una salida cerrada; esos rechazos se restan en Producción por modelo.',
      'Reporte del día muestra las personas capturadas en Personal del turno.',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-10-07',
    title: 'Logo oficial en el reporte de salida',
    changed: ['El reporte de salida impreso usa el logo oficial de MI Technologies, Inc.'],
  },
  {
    version: '1.6.0',
    date: '2026-10-07',
    title: 'Reporte de salida y nuevo Inicio',
    added: [
      'Reporte de salida imprimible (hoja vertical): encabezado MI Technologies, estado y fecha/hora reales de salida, entrada y salida, seriales en 3 columnas, faltantes con motivo y firmas.',
    ],
    changed: [
      'El reporte solo se imprime para salidas cerradas con fecha y hora de cierre; el servidor lo valida y la página lo bloquea aunque se entre directo por la dirección. En pallets abiertos o sin salida el botón dice "Disponible al registrar la salida".',
      'Inicio rediseñado: producción del turno con indicador circular y barra (mismo cálculo), proyección y ritmo, tarjetas de rechazos/faltantes/entradas/salidas, accesos y actividad reciente en línea de tiempo. Se quitó el botón "Escanear salida" de Inicio (sigue en Pallets → Salida).',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-10-07',
    title: 'Productividad con salidas cerradas',
    changed: [
      'Personal y productividad usa el mismo conteo que Producción: piezas de salidas cerradas del turno ÷ personas del turno (suma de las líneas capturadas).',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-07',
    title: 'Nueva pantalla de Producción',
    added: [
      'Producción con el diseño de la pantalla de línea: conteo grande contra la meta, desde último scan, piezas por hora, promedio por unidad, proyección del turno (y con tiempo extra) y producción por hora.',
    ],
    changed: [
      'Los apartados de Producción se acomodaron: Hora por Hora queda solo en el menú; Personal del turno pasó a Reportes (solo personas; la meta se ajusta en Hora por Hora).',
      'Se quitaron Líneas en vivo, Registrar producto terminado e Historial de producción (los reemplazan las salidas de pallet y Buscar serial). En Inicio el botón ahora es "Escanear salida".',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-10-07',
    title: 'Producción y Reporte del día con el mismo conteo',
    fixed: [
      'La pantalla Producción y el Reporte del día ya usan el mismo conteo que Inicio y Hora por Hora: piezas de salidas cerradas contra la meta del día (765), en vez de lo registrado por línea contra 1,200.',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-10-07',
    title: 'Producción = solo salidas cerradas',
    changed: ['La producción del turno cuenta solo las piezas de pallets de salida cerrados; ya no suman las salidas abiertas ni Producción → Registrar.'],
  },
  {
    version: '1.4.1',
    date: '2026-10-07',
    title: 'Tiempo por pieza desde la primera pieza',
    fixed: ['El tiempo por pieza y la proyección se miden desde la primera pieza del turno: si arrancan tarde ya no sale un tiempo enorme.'],
  },
  {
    version: '1.4.0',
    date: '2026-10-07',
    title: 'Producción = salidas de pallet, meta 765, ritmo y proyección',
    changed: [
      'La producción del turno cuenta las piezas escaneadas en pallets de salida (más lo registrado en Producción); sin dividir por línea. Aplica en Inicio y Hora por Hora.',
      'Meta del día 765 por defecto, ajustable desde Hora por Hora.',
    ],
    added: ['Tiempo por pieza (real contra la meta) y proyección al fin del turno, en Hora por Hora y en Inicio.'],
  },
  {
    version: '1.3.1',
    date: '2026-10-07',
    title: 'Hora por Hora: etiquetas',
    fixed: ['Con barras muy bajas (0 piezas) las diferencias de arriba ya no se enciman entre horas.'],
  },
  {
    version: '1.3.0',
    date: '2026-10-07',
    title: 'Hora por Hora VIOS',
    added: [
      'Módulo Hora por Hora VIOS: conteo por hora con el diseño de Centro de Trabajo (barras verde/rojo/azul, diferencia contra la meta, tendencia, meta esperada y comida a media meta).',
      'Plan del turno editable por fecha, turno (Día/Noche) y línea; sigue vigente los días siguientes hasta que se cambie.',
      'Pantalla completa para tablet vertical: la gráfica crece a lo alto, no a lo ancho.',
    ],
  },
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
