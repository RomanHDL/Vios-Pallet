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
      'Si escaneaste una pieza por error, quítala de la lista con el bote de basura. Cuando termines, toca "Cerrar pallet".',
      'Salida: Pallets → Salida. Escanea el ID del pallet de entrada (debe estar cerrado). Escanea las piezas que salen; verás cuántas faltan.',
      'Toca "Conciliar y cerrar". Cada pieza faltante necesita un motivo (Dañada, No llegó, Rechazo de calidad, etc.). Las piezas que no venían en la entrada aparecen como extras.',
      'En el detalle del pallet puedes imprimir la hoja con firmas de Calidad, Producción y Almacén. Un supervisor puede reabrir un pallet; solo el administrador puede eliminarlo.',
      '"Buscar serial" te dice en qué pallet está una pieza.',
    ],
  },
  {
    icon: Factory,
    title: 'Producción',
    steps: [
      'Registrar: la primera vez configura la estación (línea, modelo y marca). Se queda guardada en ese equipo.',
      'Escanea el serial de la TV y luego el de la caja. Deben ser iguales. Si el serial ya estaba registrado o fue rechazado por Calidad, la app lo bloquea y te dice por qué.',
      'Líneas en vivo: avance de cada línea contra su meta, piezas por hora, minutos desde el último escaneo (amarillo > 10 min, rojo > 30 min) y proyección al cierre del turno.',
      'Plan y personal (supervisor): captura cuántas piezas se pueden hacer por línea según materiales y cuántas personas hay. Si no se captura plan, se usa la meta de la línea.',
    ],
  },
  {
    icon: Clock3,
    title: 'Hora por Hora VIOS',
    steps: [
      'Conteo de piezas por hora del turno. Verde = cumplió la meta de esa hora, rojo = quedó abajo, azul = hora en curso, gris = todavía no llega. Arriba de cada barra está la diferencia contra la meta.',
      'Día (07:00 a 17:00): la comida de 11 a 13 cuenta a la mitad. Noche (22:00 a 07:00): de 2 a 3 es descanso y no tiene meta. Las horas de tiempo extra solo aparecen si hubo producción.',
      'Plan del turno: escribe la meta y toca Guardar (o Enter). La meta por hora se recalcula sola y sigue vigente los días siguientes hasta que la cambies. Sin meta capturada se usa el plan del turno.',
      'Elige fecha, turno (Día/Noche) y línea. "Pantalla completa" está pensada para una tablet vertical: la gráfica crece a lo alto.',
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
      'Personal: personas por línea y piezas por persona.',
      'Dashboard de pallets: estado de cada pallet (escaneando, sin salida, en proceso, con faltantes, consolidado).',
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
