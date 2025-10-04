import dayjs from 'dayjs'
import { userDetailData } from './usersData'

function getDate(dayString: string) {
    const today = new Date()
    const year = today.getFullYear().toString()
    let month = (today.getMonth() + 1).toString()

    if (month.length === 1) {
        month = '0' + month
    }

    return dayString.replace('YEAR', year).replace('MONTH', month)
}

const composeDetail = (summary: string, points: string[] = []) => {
    if (!points.length) {
        return summary
    }
    const formatted = points.map((point) => `• ${point}`).join('\n')
    return `${summary}\n\n${formatted}`
}

export type CalendarEventAttachment = {
    id: string
    name: string
    type?: string
    size?: number
    url?: string
}

export type CalendarEventExtendedProps = {
    type?: string
    location?: string
    detail?: string
    customerId?: string
    isInternal?: boolean
    attachments?: CalendarEventAttachment[]
}

export type CalendarActivityEvent = {
    id: string
    title: string
    start: string
    end?: string
    allDay?: boolean
    eventColor: string
    groupId?: string
    extendedProps?: CalendarEventExtendedProps
}

const createAttachment = (
    id: string,
    name: string,
    type: string,
    size: number,
    url?: string,
): CalendarEventAttachment => ({ id, name, type, size, url })

export const eventsData: CalendarActivityEvent[] = [
    {
        id: '0',
        title: 'Kick-off con Horizon Corp',
        start: getDate('YEAR-MONTH-03T09:30:00+00:00'),
        end: getDate('YEAR-MONTH-03T10:45:00+00:00'),
        eventColor: 'blue',
        extendedProps: {
            type: 'meeting',
            location: 'Zoom',
            detail: composeDetail(
                'Presentación del plan de trabajo, definición de responsables y próximos pasos con el equipo de Horizon Corp.',
                ['Confirmar participantes y compartir acceso a Miro 24hs antes.'],
            ),
            customerId: '1',
            attachments: [
                createAttachment(
                    'att-0-0',
                    'agenda-kickoff.pdf',
                    'application/pdf',
                    275631,
                ),
                createAttachment(
                    'att-0-1',
                    'brief-horizon.docx',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    85632,
                ),
            ],
        },
    },
    {
        id: '1',
        title: 'Discovery presencial con Itera',
        start: getDate('YEAR-MONTH-05T09:00:00+00:00'),
        end: getDate('YEAR-MONTH-06T18:00:00+00:00'),
        eventColor: 'emerald',
        extendedProps: {
            type: 'workshop',
            location: 'Itera · Sala Innovación',
            detail: composeDetail(
                'Taller de descubrimiento para mapear procesos clave y expectativas del equipo directivo de Itera.',
                ['Bloquear estacionamiento para visitantes y validar coffee break.'],
            ),
            customerId: '2',
            attachments: [
                createAttachment(
                    'att-1-0',
                    'iteraciones.xlsx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    198532,
                ),
            ],
        },
    },
    {
        id: '2',
        title: 'Seguimiento OKR de marketing',
        start: getDate('YEAR-MONTH-07T15:00:00+00:00'),
        end: getDate('YEAR-MONTH-07T16:00:00+00:00'),
        eventColor: 'purple',
        extendedProps: {
            type: 'meeting',
            location: 'Microsoft Teams',
            detail: composeDetail(
                'Revisión de indicadores y ajustes de iniciativas del trimestre con el equipo de marketing.',
                ['Preparar comparativa con benchmarks de la industria.'],
            ),
            customerId: '3',
            attachments: [
                createAttachment(
                    'att-2-0',
                    'okr-q3.pptx',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    456782,
                ),
            ],
        },
    },
    {
        id: '3',
        title: 'Entrega Sprint 12',
        start: getDate('YEAR-MONTH-09T10:30:00+00:00'),
        end: getDate('YEAR-MONTH-09T12:00:00+00:00'),
        eventColor: 'orange',
        extendedProps: {
            type: 'presentation',
            location: 'Google Meet',
            detail: composeDetail(
                'Demo funcional de historias completadas, revisión de métricas y backlog pendiente.',
                ['Incluir métricas de rendimiento del nuevo módulo de pagos.'],
            ),
            customerId: '4',
            attachments: [
                createAttachment(
                    'att-3-0',
                    'release-notes-s12.pdf',
                    'application/pdf',
                    142568,
                ),
                createAttachment('att-3-1', 'video-demo.mp4', 'video/mp4', 105687654),
            ],
        },
    },
    {
        id: '4',
        title: 'Retrospectiva trimestral',
        start: getDate('YEAR-MONTH-10T13:00:00+00:00'),
        end: getDate('YEAR-MONTH-10T14:30:00+00:00'),
        eventColor: 'red',
        extendedProps: {
            type: 'meeting',
            location: 'Sala Estratégica 3B',
            detail: composeDetail(
                'Retro trimestral con líderes de producto y tecnología. Evaluación de aprendizajes y acciones.',
                ['Solicitar feedback anónimo previo para abrir la sesión.'],
            ),
            customerId: '5',
            attachments: [
                createAttachment('att-4-0', 'canvas-retro.pdf', 'application/pdf', 98456),
            ],
        },
    },
    {
        id: '5',
        title: 'Mesa de soporte funcional',
        start: getDate('YEAR-MONTH-12T09:00:00+00:00'),
        end: getDate('YEAR-MONTH-12T11:00:00+00:00'),
        eventColor: 'cyan',
        extendedProps: {
            type: 'support',
            location: 'Slack huddle',
            detail: composeDetail(
                'Resolución de tickets críticos con clientes premium y priorización de nuevos requerimientos.',
                ['Analizar impacto en NPS antes de la próxima facturación.'],
            ),
            customerId: '6',
            attachments: [
                createAttachment('att-5-0', 'resumen-incidentes.csv', 'text/csv', 32456),
            ],
        },
    },
    {
        id: '6',
        title: 'Demo pública del producto v2',
        start: getDate('YEAR-MONTH-15T17:00:00+00:00'),
        end: getDate('YEAR-MONTH-15T18:00:00+00:00'),
        eventColor: 'blue',
        extendedProps: {
            type: 'demo',
            location: 'Zoom Webinar',
            detail: composeDetail(
                'Presentación abierta de nuevas funcionalidades a prospectos y clientes interesados. Registro vía landing.',
                ['Configurar campañas de follow-up 24hs después.'],
            ),
            customerId: '7',
            attachments: [
                createAttachment(
                    'att-6-0',
                    'lista-inscriptos.xlsx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    155632,
                ),
                createAttachment(
                    'att-6-1',
                    'presentacion-v2.pptx',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    245632,
                ),
            ],
        },
    },
    {
        id: '7',
        title: 'Roadmap Q4',
        start: getDate('YEAR-MONTH-18T11:00:00+00:00'),
        end: getDate('YEAR-MONTH-18T12:30:00+00:00'),
        eventColor: 'purple',
        extendedProps: {
            type: 'planning',
            location: 'Sala innovación',
            detail: composeDetail(
                'Priorización de iniciativas para el próximo trimestre y alineación con objetivos financieros.',
                ['Validar dependencias con el equipo de infraestructura.'],
            ),
            customerId: '8',
            attachments: [
                createAttachment('att-7-0', 'roadmap-template.miro', 'application/octet-stream', 5632),
            ],
        },
    },
    {
        id: '8',
        title: 'Bloqueo interno · Workshop de foco',
        start: getDate('YEAR-MONTH-18T14:00:00+00:00'),
        end: getDate('YEAR-MONTH-18T18:00:00+00:00'),
        eventColor: 'amber',
        extendedProps: {
            type: 'internal',
            location: 'Oficina · Sala Foco',
            isInternal: true,
            detail: composeDetail(
                'Espacio interno para profundizar en mejoras de procesos y coordinación del equipo extendido.',
                ['Evitar agendar reuniones externas durante este bloque.'],
            ),
        },
    },
    {
        id: '9',
        title: 'Planificación de contenidos',
        start: getDate('YEAR-MONTH-21T14:30:00+00:00'),
        end: getDate('YEAR-MONTH-21T16:00:00+00:00'),
        eventColor: 'teal',
        extendedProps: {
            type: 'task',
            location: 'Notion call',
            detail: composeDetail(
                'Definición de calendario editorial, asignación de responsables y aprobación de piezas clave.',
                ['Revisar performance de campañas de emailing previo a la sesión.'],
            ),
            customerId: '9',
            attachments: [
                createAttachment('att-9-0', 'backlog-contenidos.csv', 'text/csv', 82563),
            ],
        },
    },
    {
        id: '10',
        title: 'Business review anual',
        start: getDate('YEAR-MONTH-23'),
        end: getDate('YEAR-MONTH-24T18:00:00+00:00'),
        allDay: true,
        eventColor: 'indigo',
        extendedProps: {
            type: 'review',
            location: 'Madrid HQ',
            detail: composeDetail(
                'Revisión de resultados, evolución financiera y definición de objetivos estratégicos del año siguiente.',
                ['Reservar agenda con el CEO y preparar briefing para prensa.'],
            ),
            customerId: '10',
            attachments: [
                createAttachment(
                    'att-10-0',
                    'balance-anual.pdf',
                    'application/pdf',
                    415632,
                ),
                createAttachment(
                    'att-10-1',
                    'presentacion-board.pptx',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    345632,
                ),
            ],
        },
    },
]

const fallbackAvatar = '/img/avatars/thumb-1.jpg'
const fallbackEmail = 'activities@themenate.com'

const fallbackPersonalInfo = {
    location: 'Por definir',
    title: '',
    birthday: '26/09/2025',
    phoneNumber: '+1 (000) 000-0000',
    facebook: '',
    twitter: '',
    pinterest: '',
    linkedIn: '',
}

const capitalize = (value?: string) => {
    if (!value) {
        return 'Actividad'
    }
    return value.charAt(0).toUpperCase() + value.slice(1)
}

type UserDetail = (typeof userDetailData)[number]

const pickUser = (customerId?: string): UserDetail | undefined => {
    if (!customerId) {
        return undefined
    }
    return userDetailData.find(
        (user) => String(user.id) === String(customerId),
    )
}

const buildTimeLabel = (
    startIso: string,
    endIso?: string,
    allDay?: boolean,
) => {
    const start = dayjs(startIso)
    const end = endIso ? dayjs(endIso) : undefined
    if (allDay || !startIso.includes('T')) {
        return 'All day'
    }
    if (end) {
        return `${start.format('HH:mm')} - ${end.format('HH:mm')}`
    }
    return start.format('HH:mm')
}

const now = dayjs()

export const activityDetailData = eventsData.map((event, index) => {
    const customerId = event.extendedProps?.customerId
    const linkedUser = pickUser(customerId)
    const personalInfo = {
        ...fallbackPersonalInfo,
        ...(linkedUser?.personalInfo ? { ...linkedUser.personalInfo } : {}),
        location:
            event.extendedProps?.location ||
            linkedUser?.personalInfo?.location ||
            fallbackPersonalInfo.location,
        title: event.title,
    }

    return {
        id: event.id,
        name: event.title,
        email: linkedUser?.email || fallbackEmail,
        img: linkedUser?.img || fallbackAvatar,
        role: capitalize(event.extendedProps?.type),
        lastOnline: now.subtract(index, 'day').unix(),
        status: 'active',
        customerId,
        crmId: customerId,
        linkedCustomerId: customerId,
        date: dayjs(event.start).format('YYYY-MM-DD'),
        time: buildTimeLabel(event.start, event.end, event.allDay),
        personalInfo,
        orderHistory: linkedUser?.orderHistory || [],
        paymentMethod: [],
        subscription: [],
        detail: event.extendedProps?.detail,
        attachments: event.extendedProps?.attachments || [],
        isInternal: Boolean(event.extendedProps?.isInternal),
    }
})
