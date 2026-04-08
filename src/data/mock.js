// Mock data — replace with real API responses when backend is ready.
// Schema is stable; services/api.js consumes these shapes.

export const metrics = {
  connections: { value: 4827, delta: 12.4, trend: [30, 42, 38, 55, 60, 72, 85] },
  messages: { value: 312, delta: 8.1, trend: [15, 22, 18, 28, 35, 30, 42] },
  profileViews: { value: 1249, delta: -2.3, trend: [60, 58, 62, 55, 50, 48, 52] },
  leads: { value: 87, delta: 23.5, trend: [5, 8, 12, 15, 18, 22, 28] },
};

export const weeklyChart = {
  labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  connections: [34, 42, 38, 55, 60, 28, 22],
  messages: [18, 22, 25, 30, 35, 15, 12],
  views: [85, 102, 95, 118, 130, 70, 65],
};

export const activity = [
  { icon: '🤝', text: '<strong>María González</strong> aceptó tu solicitud de conexión', time: 'Hace 3 min' },
  { icon: '💬', text: '<strong>Carlos Ramírez</strong> respondió tu mensaje de seguimiento', time: 'Hace 18 min' },
  { icon: '👀', text: '<strong>Ana Silva</strong> vio tu perfil 2 veces esta semana', time: 'Hace 1 h' },
  { icon: '🚀', text: 'Campaña <strong>HR Directors LATAM</strong> alcanzó 40% de respuesta', time: 'Hace 2 h' },
  { icon: '📝', text: 'Tu post <strong>"Bienestar como KPI"</strong> superó 5k impresiones', time: 'Hace 5 h' },
  { icon: '✨', text: '<strong>Juan Pérez</strong> reaccionó a tu publicación', time: 'Hace 6 h' },
];

export const campaigns = [
  {
    id: 'c1',
    name: 'HR Directors LATAM Q2',
    description: 'Outreach a directores de RRHH en empresas de +500 empleados en Chile y México.',
    status: 'active',
    progress: 68,
    stats: { sent: 312, accepted: 184, replies: 67 },
    steps: [
      { label: 'Visita perfil', state: 'done' },
      { label: 'Conexión', state: 'done' },
      { label: 'Mensaje 1', state: 'active' },
      { label: 'Follow-up', state: 'pending' },
    ],
  },
  {
    id: 'c2',
    name: 'CEOs Bienestar MX',
    description: 'CEOs y founders de startups de bienestar y salud en México post-WTW.',
    status: 'active',
    progress: 42,
    stats: { sent: 148, accepted: 89, replies: 31 },
    steps: [
      { label: 'Visita perfil', state: 'done' },
      { label: 'Conexión', state: 'active' },
      { label: 'Mensaje 1', state: 'pending' },
      { label: 'Follow-up', state: 'pending' },
    ],
  },
  {
    id: 'c3',
    name: 'Brokers Argentina Retención',
    description: 'Brokers clave en AR para consolidar relación y detectar oportunidades.',
    status: 'paused',
    progress: 22,
    stats: { sent: 68, accepted: 34, replies: 9 },
    steps: [
      { label: 'Visita perfil', state: 'done' },
      { label: 'Conexión', state: 'done' },
      { label: 'Mensaje 1', state: 'pending' },
      { label: 'Follow-up', state: 'pending' },
    ],
  },
  {
    id: 'c4',
    name: 'Warm Nurture VitaCare',
    description: 'Seguimiento a prospectos de rehabilitación premium en Buenos Aires.',
    status: 'draft',
    progress: 0,
    stats: { sent: 0, accepted: 0, replies: 0 },
    steps: [
      { label: 'Visita perfil', state: 'pending' },
      { label: 'Conexión', state: 'pending' },
      { label: 'Mensaje 1', state: 'pending' },
      { label: 'Follow-up', state: 'pending' },
    ],
  },
];

export const threads = [
  {
    id: 't1', name: 'María González', initials: 'MG', title: 'HR Director @ Banco Santander Chile',
    time: '11:42', preview: '¡Gracias por tu mensaje! Me interesa conocer más sobre Care Assistance...',
    unread: true, filter: 'prospects',
    messages: [
      { dir: 'out', text: 'Hola María, vi que estás liderando el programa de bienestar en Santander. Me encantaría contarte cómo ayudamos a empresas similares en Chile.', time: '10:28' },
      { dir: 'in', text: '¡Hola Sebastián! Gracias por contactarme. Justo estamos evaluando proveedores para el próximo trimestre.', time: '11:15' },
      { dir: 'in', text: '¿Gracias por tu mensaje! Me interesa conocer más sobre Care Assistance. ¿Podrías enviarme un deck?', time: '11:42' },
    ],
  },
  {
    id: 't2', name: 'Carlos Ramírez', initials: 'CR', title: 'CEO @ WellnessLab México',
    time: '09:18', preview: 'Perfecto, agendemos la llamada para el martes que viene.',
    unread: true, filter: 'customers',
    messages: [
      { dir: 'in', text: 'Hola Sebastián, tengo interés en una alianza estratégica para México.', time: '09:05' },
      { dir: 'out', text: '¡Hola Carlos! Encantado. ¿Qué tal una llamada la próxima semana?', time: '09:12' },
      { dir: 'in', text: 'Perfecto, agendemos la llamada para el martes que viene.', time: '09:18' },
    ],
  },
  {
    id: 't3', name: 'Ana Silva', initials: 'AS', title: 'People Ops @ Rappi',
    time: 'Ayer', preview: 'Compartí la propuesta internamente, en una semana te cuento.',
    unread: false, filter: 'prospects',
    messages: [
      { dir: 'out', text: 'Hola Ana, te envío la propuesta que acordamos.', time: 'Ayer' },
      { dir: 'in', text: 'Compartí la propuesta internamente, en una semana te cuento.', time: 'Ayer' },
    ],
  },
  {
    id: 't4', name: 'Juan Pérez', initials: 'JP', title: 'Broker @ Willis Towers Watson',
    time: 'Ayer', preview: 'Confirmamos la reunión del jueves a las 15hs.',
    unread: false, filter: 'partners',
    messages: [
      { dir: 'out', text: 'Juan, confirmamos jueves 15hs?', time: 'Ayer' },
      { dir: 'in', text: 'Confirmamos la reunión del jueves a las 15hs.', time: 'Ayer' },
    ],
  },
  {
    id: 't5', name: 'Laura Méndez', initials: 'LM', title: 'CFO @ BH Health Group',
    time: '2d', preview: 'Gracias por el follow-up, lo revisamos en el board.',
    unread: false, filter: 'prospects',
    messages: [
      { dir: 'out', text: 'Hola Laura, adjunto el caso de éxito de Chile.', time: '2d' },
      { dir: 'in', text: 'Gracias por el follow-up, lo revisamos en el board.', time: '2d' },
    ],
  },
];

export const quickTemplates = [
  'Gracias por conectar 👋',
  'Agendemos una llamada',
  'Te envío el deck',
  'Follow-up cordial',
];

export const leads = {
  new: [
    { id: 'l1', name: 'Diego Fuentes', company: 'Falabella Retail', initials: 'DF', tags: ['hr', 'latam'], score: 82, time: '2h' },
    { id: 'l2', name: 'Sofía Herrera', company: 'Walmart México', initials: 'SH', tags: ['hr', 'wellness'], score: 74, time: '5h' },
    { id: 'l3', name: 'Martín Vega', company: 'MercadoLibre', initials: 'MV', tags: ['ceo', 'latam'], score: 88, time: '1d' },
  ],
  contacted: [
    { id: 'l4', name: 'Valentina Rojas', company: 'Copec Energy', initials: 'VR', tags: ['hr'], score: 70, time: '3d' },
    { id: 'l5', name: 'Andrés López', company: 'Bimbo México', initials: 'AL', tags: ['hr', 'wellness'], score: 85, time: '4d' },
  ],
  engaged: [
    { id: 'l6', name: 'Paula Sánchez', company: 'Cornershop', initials: 'PS', tags: ['ceo', 'wellness'], score: 91, time: '1w' },
    { id: 'l7', name: 'Roberto Díaz', company: 'Banco de Chile', initials: 'RD', tags: ['hr', 'latam'], score: 78, time: '5d' },
  ],
  won: [
    { id: 'l8', name: 'Carolina Bravo', company: 'Globant', initials: 'CB', tags: ['hr', 'wellness'], score: 95, time: '2w' },
  ],
};

export const scheduledPosts = [
  {
    id: 'p1', date: 'Mié 10 Abr · 09:00', type: 'Thought leadership',
    text: 'El bienestar corporativo ya no es un beneficio: es un KPI. En los últimos 12 meses vimos cómo las empresas que miden salud de colaboradores reducen rotación un 34%...',
  },
  {
    id: 'p2', date: 'Vie 12 Abr · 08:30', type: 'Caso de éxito',
    text: '¿Cómo ayudamos a una empresa de 1.200 colaboradores en Chile a bajar 22% el ausentismo en 6 meses? 🧵 Un thread sobre implementación de Care Assistance...',
  },
  {
    id: 'p3', date: 'Lun 15 Abr · 10:00', type: 'Storytelling',
    text: 'Hace 3 años, cuando empezamos Care Assistance, pensábamos que el producto era una app. Hoy sé que el producto real es la confianza que construimos con HR en LATAM.',
  },
];

export const calendarDays = (() => {
  // Placeholder month: April 2026
  const days = [];
  for (let i = 30; i <= 31; i++) days.push({ n: i, out: true });
  for (let i = 1; i <= 30; i++) {
    const scheduled =
      i === 10 ? 'cyan' :
      i === 12 ? 'blue' :
      i === 15 ? 'purple' :
      i === 22 ? 'cyan' :
      i === 25 ? 'blue' : null;
    days.push({ n: i, out: false, today: i === 8, scheduled });
  }
  for (let i = 1; i <= 3; i++) days.push({ n: i, out: true });
  return days;
})();
