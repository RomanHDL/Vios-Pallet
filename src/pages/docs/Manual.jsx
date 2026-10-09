import { BarChart3, ClipboardCheck, Clock3, Factory, PackageCheck, Settings, ScanLine } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'
import { BackLink } from './Cambios'

// Manual de usuario: un apartado por modulo, en pasos cortos.
const SECTIONS = [
  {
    icon: ScanLine,
    title: 'Antes de empezar',
    steps: [
      'Toca "Entrar" para pasar directo (cuenta compartida Planta, con permisos de supervisor). El administrador entra con su usuario abriendo la dirección de la página con /?admin al final. Cada rol define lo que puedes hacer: Operador (escanear pallets y producción), Calidad (rechazos), Supervisor (además reabrir, borrar registros y capturar plan/personal) y Administrador (todo, incluidos usuarios y catálogos).',
      'Los campos de escaneo funcionan con pistola lectora: apunta y dispara, el código se envía solo. En celulares Android con Chrome puedes usar el botón de cámara del campo.',
      'Un sonido corto y verde = correcto. Un sonido grave y rojo = error; lee el mensaje.',
      'El turno se calcula solo: Turno 1 de 07:00 a 22:00 y Turno 2 de 22:00 a 07:00 (cuenta para el día en que empieza).',
    ],
  },
  {
    icon: PackageCheck,
    title: 'Pallets',
    steps: [
      'Entrada: Pallets → Entrada. Escanea el ID del pallet (6 dígitos). Si es nuevo, elige modelo y marca. Después escanea cada pieza; el contador sube con cada lectura.',
      'Tele de otro modelo (ej. una JL en un pallet EL): toca "Agregar tele diferente" y escanéala, o usa el botón que aparece cuando el serial no coincide. Se agrega sin error y queda marcada como "Diferente" (también en la salida y en el reporte impreso).',
      'Una tele solo puede estar en un pallet: si ya se dio entrada en otro pallet ID, no se acepta y te dice en cuál está.',
      'Si escaneaste una pieza por error, quítala de la lista con el bote de basura. Cuando termines, toca "Cerrar pallet".',
      'Salida: Pallets → Salida. Escanea el ID del pallet de entrada (debe estar cerrado). Escanea las piezas que salen; verás cuántas faltan. Solo entran las teles de SU entrada: si escaneas una de otro pallet, no la acepta y te dice de qué pallet es.',
      '"Piezas pendientes" (botón amarillo en la salida) abre la lista de las piezas de la entrada que aún no salen, con buscador. Si una pieza está en otro pallet se ve "Está en: …"; si es una tele repetida de otro pallet, un supervisor puede tocar "Quitar de la entrada".',
      'Toca "Conciliar y cerrar". Cada pieza faltante necesita un motivo (Dañada, No llegó, Rechazo de calidad, etc.).',
      'Reporte de salida: cuando la salida ya está cerrada, en su detalle (o en el de su entrada) aparece "Imprimir reporte de salida": hoja vertical con datos de entrada y salida, seriales en 3 columnas, faltantes y firmas de Calidad, Producción y Almacén. Mientras la salida no se registre, el botón dice "Disponible al registrar la salida" y no se puede imprimir. Un supervisor puede reabrir un pallet; solo el administrador puede eliminarlo.',
      '"Buscar serial" te dice en qué pallet está una pieza.',
      'Producción por línea (botón en Pallets): elige Marca (HY/SILO) → Modelo → Línea y escanea el serial de la TV y luego el de la caja (deben coincidir). Abajo se ve cada línea con sus piezas, personas y piezas por persona; "Editar personal" captura las personas. Estos escaneos también suman a la producción del turno.',
    ],
  },
  {
    icon: Factory,
    title: 'Producción',
    steps: [
      'Producción muestra el turno en curso: piezas de pallets de salida cerrados contra la meta del día (765 por defecto, se cambia en Hora x Hora).',
      'Desde último scan: tiempo desde la última pieza escaneada en una salida (amarillo > 10 min, rojo > 30 min). Por hora: piezas por hora al ritmo del turno. Promedio / unidad: cada cuánto sale una pieza.',
      'Proyección turno: piezas al terminar el turno si se sigue al mismo ritmo; en el turno de día también se muestra cuántas serían con tiempo extra (hasta las 22:00).',
      'Abajo está la producción por hora; "Hora x Hora" abre el tablero completo. El personal por línea se captura en Pallets → Producción por línea.',
    ],
  },
  {
    icon: Clock3,
    title: 'Hora por Hora VIOS',
    steps: [
      'Cuenta como producción cada pieza de un pallet de SALIDA ya CERRADO y cada pieza escaneada (TV + caja) en Pallets → Producción por línea, en la hora en que se escaneó. Una serie cuenta una sola vez. Las salidas abiertas no cuentan.',
      'Verde = cumplió la meta de esa hora, rojo = quedó abajo, azul = hora en curso, gris = todavía no llega. Arriba de cada barra está la diferencia contra la meta.',
      'Meta del día: 765 piezas por defecto. Escribe otra y toca Guardar (o Enter); sigue vigente los días siguientes hasta que la cambies.',
      'Tiempo por pieza: cada cuánto sale una pieza (tiempo trabajado desde la primera pieza del turno ÷ piezas), comparado con lo que pide la meta. Proyección fin de turno: cuántas piezas habrá al terminar si se sigue al mismo ritmo.',
      'Día (07:00 a 17:00): la comida de 11 a 13 cuenta a la mitad. Noche (22:00 a 07:00): de 2 a 3 es descanso. "Pantalla completa" está pensada para una tablet vertical.',
    ],
  },
  {
    icon: ClipboardCheck,
    title: 'Calidad',
    steps: [
      'Nuevo rechazo: escanea el serial. La app muestra su pallet, modelo, marca y si ya estaba registrado en producción.',
      'Marca uno o varios defectos (o escribe otro), agrega comentarios si hace falta y guarda.',
      'La pantalla de Calidad muestra los rechazos de hoy, 7 o 30 días y el ranking de defectos.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    steps: [
      'Reporte del día: Plan, Real, Delta (Real − Plan; rojo = faltó) y Recovery (plan + lo que faltó en el turno anterior), por turno y por línea. Se puede imprimir.',
      'Producción por modelo: producido, rechazado y neto contra los objetivos MTY y Texas, con gráfica diaria y proyección de 5 días hábiles.',
      'Personal y productividad: producción del turno (una vez por serial) entre las personas del turno. Cada área de trabajo (Entrada, Producción por línea, Salida) que escaneó algo en el turno cuenta como 1 persona; también se ven las piezas que escaneó cada área.',
      'Dashboard de pallets: estado de cada pallet (escaneando, sin salida, en proceso, con faltantes, consolidado). En "Progreso visual de pallets" cada salida iniciada se ve como una tarima que se llena conforme escanean; los pendientes van primero y no se ocultan, los consolidados rotan cada 10 s.',
    ],
  },
  {
    icon: Settings,
    title: 'Administración',
    steps: [
      'Usuarios: crea cuentas, cambia el rol, desactiva a quien ya no trabaja ahí o restablece su contraseña.',
      'Catálogos: líneas y su meta por turno, modelos con su prefijo de serial y objetivos, marcas y defectos. Desactivar oculta el elemento sin borrar el historial.',
      'Cada persona puede cambiar su contraseña en Mi cuenta.',
    ],
  },
]

export default function Manual() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={<BackLink />} title="Manual de usuario" subtitle="Cómo usar VIOS Pallet" />
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </span>
              <h2 className="text-[17px] font-bold">{s.title}</h2>
            </div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed">
              {s.steps.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  )
}
