// Mock data — replace with real API responses when backend is ready.

export const metrics = {
  connections:  { value: 4827, delta: 12.4, trend: [30, 42, 38, 55, 60, 72, 85], goal: 5000 },
  messages:     { value: 312,  delta: 8.1,  trend: [15, 22, 18, 28, 35, 30, 42], goal: 400  },
  profileViews: { value: 1249, delta: -2.3, trend: [60, 58, 62, 55, 50, 48, 52], goal: 1500 },
  leads:        { value: 87,   delta: 23.5, trend: [5,  8,  12, 15, 18, 22, 28], goal: 100  },
};

// Multi-range chart data
export const chartData = {
  '7d': {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    connections: [34, 42, 38, 55, 60, 28, 22],
    messages:    [18, 22, 25, 30, 35, 15, 12],
    views:       [85, 102, 95, 118, 130, 70, 65],
  },
  '30d': {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
    connections: [204, 258, 195, 279],
    messages:    [88,  115, 102, 129],
    views:       [510, 682, 598, 715],
  },
  '90d': {
    labels: ['Ene', 'Feb', 'Mar', 'Abr'],
    connections: [780,  920,  1050, 1100],
    messages:    [310,  390,  428,  460],
    views:       [1980, 2340, 2650, 2890],
  },
};

// Backward compat alias
export const weeklyChart = chartData['7d'];

export const activity = [
  { icon: '🤝', type: 'connection', text: 'María González aceptó tu solicitud de conexión',          time: 'Hace 3 min'  },
  { icon: '💬', type: 'message',    text: 'Carlos Ramírez respondió tu mensaje de seguimiento',      time: 'Hace 18 min' },
  { icon: '👀', type: 'view',       text: 'Ana Silva vio tu perfil 2 veces esta semana',             time: 'Hace 1 h'    },
  { icon: '🚀', type: 'campaign',   text: 'Campaña HR Directors LATAM alcanzó 40% de respuesta',    time: 'Hace 2 h'    },
  { icon: '📝', type: 'post',       text: 'Tu post "Bienestar como KPI" superó 5k impresiones',     time: 'Hace 5 h'    },
  { icon: '✨', type: 'connection', text: 'Juan Pérez reaccionó a tu publicación',                   time: 'Hace 6 h'    },
];

export const campaigns = [
  {
    id: 'c1', name: 'HR Directors LATAM Q2',
    description: 'Outreach a directores de RRHH en empresas de +500 empleados en Chile y México.',
    status: 'active', progress: 68,
    stats: { sent: 312, accepted: 184, replies: 67 },
    steps: [
      { label: 'Visita perfil', state: 'done'    },
      { label: 'Conexión',      state: 'done'    },
      { label: 'Mensaje 1',     state: 'active'  },
      { label: 'Follow-up',     state: 'pending' },
    ],
  },
  {
    id: 'c2', name: 'CEOs Bienestar MX',
    description: 'CEOs y founders de startups de bienestar y salud en México post-WTW.',
    status: 'active', progress: 42,
    stats: { sent: 148, accepted: 89, replies: 31 },
    steps: [
      { label: 'Visita perfil', state: 'done'    },
      { label: 'Conexión',      state: 'active'  },
      { label: 'Mensaje 1',     state: 'pending' },
      { label: 'Follow-up',     state: 'pending' },
    ],
  },
  {
    id: 'c3', name: 'Brokers Argentina Retención',
    description: 'Brokers clave en AR para consolidar relación y detectar oportunidades.',
    status: 'paused', progress: 22,
    stats: { sent: 68, accepted: 34, replies: 9 },
    steps: [
      { label: 'Visita perfil', state: 'done'    },
      { label: 'Conexión',      state: 'done'    },
      { label: 'Mensaje 1',     state: 'pending' },
      { label: 'Follow-up',     state: 'pending' },
    ],
  },
  {
    id: 'c4', name: 'Warm Nurture VitaCare',
    description: 'Seguimiento a prospectos de rehabilitación premium en Buenos Aires.',
    status: 'draft', progress: 0,
    stats: { sent: 0, accepted: 0, replies: 0 },
    steps: [
      { label: 'Visita perfil', state: 'pending' },
      { label: 'Conexión',      state: 'pending' },
      { label: 'Mensaje 1',     state: 'pending' },
      { label: 'Follow-up',     state: 'pending' },
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
      { dir: 'in',  text: '¡Hola Sebastián! Gracias por contactarme. Justo estamos evaluando proveedores para el próximo trimestre.', time: '11:15' },
      { dir: 'in',  text: '¿Gracias por tu mensaje! Me interesa conocer más sobre Care Assistance. ¿Podrías enviarme un deck?', time: '11:42' },
    ],
  },
  {
    id: 't2', name: 'Carlos Ramírez', initials: 'CR', title: 'CEO @ WellnessLab México',
    time: '09:18', preview: 'Perfecto, agendemos la llamada para el martes que viene.',
    unread: true, filter: 'customers',
    messages: [
      { dir: 'in',  text: 'Hola Sebastián, tengo interés en una alianza estratégica para México.', time: '09:05' },
      { dir: 'out', text: '¡Hola Carlos! Encantado. ¿Qué tal una llamada la próxima semana?', time: '09:12' },
      { dir: 'in',  text: 'Perfecto, agendemos la llamada para el martes que viene.', time: '09:18' },
    ],
  },
  {
    id: 't3', name: 'Ana Silva', initials: 'AS', title: 'People Ops @ Rappi',
    time: 'Ayer', preview: 'Compartí la propuesta internamente, en una semana te cuento.',
    unread: false, filter: 'prospects',
    messages: [
      { dir: 'out', text: 'Hola Ana, te envío la propuesta que acordamos.', time: 'Ayer' },
      { dir: 'in',  text: 'Compartí la propuesta internamente, en una semana te cuento.', time: 'Ayer' },
    ],
  },
  {
    id: 't4', name: 'Juan Pérez', initials: 'JP', title: 'Broker @ Willis Towers Watson',
    time: 'Ayer', preview: 'Confirmamos la reunión del jueves a las 15hs.',
    unread: false, filter: 'partners',
    messages: [
      { dir: 'out', text: 'Juan, confirmamos jueves 15hs?', time: 'Ayer' },
      { dir: 'in',  text: 'Confirmamos la reunión del jueves a las 15hs.', time: 'Ayer' },
    ],
  },
  {
    id: 't5', name: 'Laura Méndez', initials: 'LM', title: 'CFO @ BH Health Group',
    time: '2d', preview: 'Gracias por el follow-up, lo revisamos en el board.',
    unread: false, filter: 'prospects',
    messages: [
      { dir: 'out', text: 'Hola Laura, adjunto el caso de éxito de Chile.', time: '2d' },
      { dir: 'in',  text: 'Gracias por el follow-up, lo revisamos en el board.', time: '2d' },
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
    { id: 'l1', name: 'Diego Fuentes',  company: 'Falabella Retail', initials: 'DF', tags: ['hr', 'latam'],    score: 82, time: '2h' },
    { id: 'l2', name: 'Sofía Herrera',  company: 'Walmart México',   initials: 'SH', tags: ['hr', 'wellness'], score: 74, time: '5h' },
    { id: 'l3', name: 'Martín Vega',    company: 'MercadoLibre',     initials: 'MV', tags: ['ceo', 'latam'],   score: 88, time: '1d' },
  ],
  contacted: [
    { id: 'l4', name: 'Valentina Rojas', company: 'Copec Energy', initials: 'VR', tags: ['hr'],            score: 70, time: '3d' },
    { id: 'l5', name: 'Andrés López',    company: 'Bimbo México',  initials: 'AL', tags: ['hr', 'wellness'], score: 85, time: '4d' },
  ],
  engaged: [
    { id: 'l6', name: 'Paula Sánchez', company: 'Cornershop',    initials: 'PS', tags: ['ceo', 'wellness'], score: 91, time: '1w' },
    { id: 'l7', name: 'Roberto Díaz',  company: 'Banco de Chile', initials: 'RD', tags: ['hr', 'latam'],    score: 78, time: '5d' },
  ],
  won: [
    { id: 'l8', name: 'Carolina Bravo', company: 'Globant', initials: 'CB', tags: ['hr', 'wellness'], score: 95, time: '2w' },
  ],
};

export const scheduledPosts = [
  { id: 'p1', date: 'Mié 10 Abr · 09:00', type: 'Thought leadership',
    text: 'El bienestar corporativo ya no es un beneficio: es un KPI. En los últimos 12 meses vimos cómo las empresas que miden salud de colaboradores reducen rotación un 34%...' },
  { id: 'p2', date: 'Vie 12 Abr · 08:30', type: 'Caso de éxito',
    text: '¿Cómo ayudamos a una empresa de 1.200 colaboradores en Chile a bajar 22% el ausentismo en 6 meses? 🧵 Un thread sobre implementación de Care Assistance...' },
  { id: 'p3', date: 'Lun 15 Abr · 10:00', type: 'Storytelling',
    text: 'Hace 3 años, cuando empezamos Care Assistance, pensábamos que el producto era una app. Hoy sé que el producto real es la confianza que construimos con HR en LATAM.' },
];

export const calendarDays = (() => {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const days = [];

  // Previous month overflow
  const prevTotal = new Date(year, month, 0).getDate();
  for (let i = firstDow - 1; i >= 0; i--) days.push({ n: prevTotal - i, out: true });

  // Current month
  const scheduledDays = new Set([today + 1, today + 3, today + 6, today + 10, today + 14].filter(d => d <= totalDays));
  const colors = ['cyan', 'blue', 'purple', 'cyan', 'blue'];
  let ci = 0;
  for (let d = 1; d <= totalDays; d++) {
    const entry = { n: d, out: false, today: d === today };
    if (scheduledDays.has(d)) entry.scheduled = colors[ci++ % colors.length];
    days.push(entry);
  }

  // Next month fill
  const rem = 7 - (days.length % 7);
  if (rem < 7) for (let i = 1; i <= rem; i++) days.push({ n: i, out: true });
  return days;
})();

// ── Automations ───────────────────────────────────────────────────────────────
export const automations = [
  {
    id: 'a0',
    name: 'Smart Engage — HR Directors LATAM',
    type: 'smart_engage',
    status: 'active',
    trigger: 'cron_5min',
    triggerLabel: 'Cada 5 min · Busca + actúa automáticamente',
    target: { titles: ['HR Director', 'People Manager', 'CHRO'], keywords: ['bienestar', 'wellness', 'RRHH', 'salud laboral'], industries: ['Healthcare', 'Corporate'], countries: ['Argentina', 'Chile', 'México'], minScore: 40, actions: { like: true, comment: true, connect: true, message: false } },
    content: {},
    schedule: { dailyLimit: 20, hours: '09:00-18:00', days: ['Mon','Tue','Wed','Thu','Fri'] },
    stats: { actionsToday: 14, total: 456, successRate: 92 },
    lastRun: 'Hace 5 min',
  },
  {
    id: 'a1',
    name: 'Bienvenida a nuevas conexiones HR',
    type: 'message',
    status: 'active',
    trigger: 'new_connection',
    triggerLabel: 'Nueva conexión aceptada',
    target: { titles: ['HR Director', 'People Manager'], industries: ['Salud', 'Retail'] },
    content: { template: 'Hola {{nombre}}, gracias por conectar! En Care Assistance ayudamos a empresas como {{empresa}} a medir el bienestar de sus equipos. ¿Tienen agenda esta semana?' },
    schedule: { dailyLimit: 15, hours: '09:00-18:00', days: ['Mon','Tue','Wed','Thu','Fri'] },
    stats: { actionsToday: 8, total: 312, successRate: 94 },
    lastRun: 'Hace 12 min',
  },
  {
    id: 'a2',
    name: 'Like a posts de RRHH y Bienestar',
    type: 'like',
    status: 'active',
    trigger: 'post_published',
    triggerLabel: 'Post publicado por conexión',
    target: { titles: ['HR', 'People', 'CHRO'], keywords: ['bienestar', 'wellness', 'salud laboral'] },
    content: {},
    schedule: { dailyLimit: 50, hours: '08:00-20:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
    stats: { actionsToday: 34, total: 2840, successRate: 99 },
    lastRun: 'Hace 3 min',
  },
  {
    id: 'a3',
    name: 'Follow-up si no responden en 5 días',
    type: 'followup',
    status: 'active',
    trigger: 'no_reply',
    triggerLabel: 'Sin respuesta tras 5 días',
    target: { titles: ['CEO', 'Founder', 'Director'] },
    content: { template: 'Hola {{nombre}}, te escribo nuevamente brevemente. ¿Tuviste oportunidad de ver mi mensaje? Quedo a tu disposición.' },
    schedule: { dailyLimit: 10, hours: '10:00-17:00', days: ['Mon','Tue','Wed','Thu','Fri'] },
    stats: { actionsToday: 3, total: 128, successRate: 38 },
    lastRun: 'Hace 1 h',
  },
  {
    id: 'a4',
    name: 'Comentar posts de CEOs de bienestar',
    type: 'comment',
    status: 'paused',
    trigger: 'post_published',
    triggerLabel: 'Post publicado por prospecto',
    target: { titles: ['CEO', 'Founder'], keywords: ['salud', 'bienestar', 'cultura'] },
    content: { template: 'Excelente perspectiva, {{nombre}}. En Care Assistance vemos exactamente esto con nuestros clientes en LATAM. 💪' },
    schedule: { dailyLimit: 8, hours: '09:00-19:00', days: ['Mon','Tue','Wed','Thu','Fri'] },
    stats: { actionsToday: 0, total: 89, successRate: 82 },
    lastRun: 'Hace 2 días',
  },
  {
    id: 'a5',
    name: 'Ver perfiles de leads calientes',
    type: 'view',
    status: 'active',
    trigger: 'lead_created',
    triggerLabel: 'Lead nuevo en CRM',
    target: { titles: ['HR', 'People', 'Bienestar'], industries: ['Tecnología', 'Finanzas'] },
    content: {},
    schedule: { dailyLimit: 30, hours: '08:00-18:00', days: ['Mon','Tue','Wed','Thu','Fri'] },
    stats: { actionsToday: 18, total: 940, successRate: 98 },
    lastRun: 'Hace 25 min',
  },
  {
    id: 'a6',
    name: 'Endorsar skills de conexiones clave',
    type: 'endorse',
    status: 'paused',
    trigger: 'manual',
    triggerLabel: 'Lista manual de contactos',
    target: { titles: ['HR Director', 'CHRO'] },
    content: {},
    schedule: { dailyLimit: 5, hours: '10:00-15:00', days: ['Tue','Thu'] },
    stats: { actionsToday: 0, total: 44, successRate: 100 },
    lastRun: 'Hace 3 días',
  },
];

export const automationStats = {
  active: 5,
  actionsToday: 77,
  messagesSent: 11,
  successRate: 95,
};

export const automationLog = [
  { time: '17:14', type: 'like',     name: 'María González', company: 'Banco Santander', initials: 'MG', action: 'Like al post "El bienestar como KPI"',           result: 'success' },
  { time: '17:08', type: 'view',     name: 'Diego Fuentes',  company: 'Falabella',        initials: 'DF', action: 'Vista de perfil (lead score 82)',                result: 'success' },
  { time: '16:52', type: 'message',  name: 'Laura Méndez',   company: 'BH Health Group',  initials: 'LM', action: 'Mensaje bienvenida enviado',                    result: 'success' },
  { time: '16:41', type: 'like',     name: 'Carlos Ramírez', company: 'WellnessLab MX',   initials: 'CR', action: 'Like al post "Cultura organizacional en 2026"', result: 'success' },
  { time: '16:30', type: 'followup', name: 'Ana Torres',     company: 'Copec Energy',     initials: 'AT', action: 'Follow-up secuencia día 5',                     result: 'success' },
  { time: '16:18', type: 'view',     name: 'Sofía Herrera',  company: 'Walmart México',   initials: 'SH', action: 'Vista de perfil (lead score 74)',                result: 'success' },
  { time: '15:57', type: 'message',  name: 'Juan Pérez',     company: 'Willis T. Watson', initials: 'JP', action: 'Mensaje bienvenida enviado',                    result: 'success' },
  { time: '15:44', type: 'comment',  name: 'Paula Sánchez',  company: 'Cornershop',       initials: 'PS', action: 'Comentario en post sobre wellness',             result: 'fail'    },
];

// ── LinkedIn Accounts (cookie-based) ─────────────────────────────────────────
export const linkedinAccounts = [
  {
    id: 'acc1',
    name: 'Sebastián Levin',
    headline: 'Founder @ Care Assistance · B2B Health LATAM',
    initials: 'SL',
    cookieSet: true,
    cookieExpiry: '28 de abril · 18 días restantes',
    sessionHealth: 94,
    status: 'active',
    connectedAt: '2026-03-22',
    stats: {
      actionsToday: 63,
      actionsWeek: 312,
      postsPublished: 8,
      connectionsThisMonth: 142,
    },
    limits: { daily: 150, used: 63 },
  },
];

// ── Post Queue ────────────────────────────────────────────────────────────────
export const postQueue = [
  {
    id: 'pq1',
    accountId: 'acc1',
    accountName: 'Sebastián Levin',
    status: 'scheduled',
    scheduledAt: 'Mié 10 Abr · 09:00',
    type: 'Thought leadership',
    text: 'El bienestar corporativo ya no es un beneficio: es un KPI. En los últimos 12 meses vimos cómo las empresas que miden salud de colaboradores reducen rotación un 34%...\n\n¿Tu empresa ya mide esto?\n\n#bienestar #RRHH #HRLatam #wellness',
    hashtags: ['#bienestar', '#RRHH', '#HRLatam', '#wellness'],
    estimatedReach: '2.4K',
  },
  {
    id: 'pq2',
    accountId: 'acc1',
    accountName: 'Sebastián Levin',
    status: 'scheduled',
    scheduledAt: 'Vie 12 Abr · 08:30',
    type: 'Caso de éxito',
    text: '¿Cómo ayudamos a una empresa de 1.200 colaboradores en Chile a bajar 22% el ausentismo en 6 meses? 🧵\n\nUn thread sobre implementación de Care Assistance:\n\n#CasoDeExito #CareAssistance #HRLatam',
    hashtags: ['#CasoDeExito', '#CareAssistance', '#HRLatam'],
    estimatedReach: '3.1K',
  },
  {
    id: 'pq3',
    accountId: 'acc1',
    accountName: 'Sebastián Levin',
    status: 'published',
    publishedAt: 'Lun 8 Abr · 09:15',
    type: 'Storytelling',
    text: 'Hace 3 años, cuando empezamos Care Assistance, pensábamos que el producto era una app. Hoy sé que el producto real es la confianza que construimos con HR en LATAM.',
    hashtags: ['#startup', '#founders', '#LATAM'],
    metrics: { likes: 187, comments: 34, views: 4820, reposts: 12 },
  },
  {
    id: 'pq4',
    accountId: 'acc1',
    accountName: 'Sebastián Levin',
    status: 'published',
    publishedAt: 'Jue 4 Abr · 08:00',
    type: 'Insight de datos',
    text: '📊 Dato sorprendente: el 67% de las empresas en LATAM no mide el ROI de sus programas de bienestar. Las que sí lo miden retienen 2.3x más talento clave.',
    hashtags: ['#datos', '#bienestar', '#HRLatam', '#talento'],
    metrics: { likes: 312, comments: 58, views: 8200, reposts: 41 },
  },
  {
    id: 'pq5',
    accountId: 'acc1',
    accountName: 'Sebastián Levin',
    status: 'draft',
    type: 'Borrador',
    text: 'Idea: post sobre la diferencia entre wellness reactivo y preventivo en empresas LATAM...',
    hashtags: [],
  },
];

export const suggestedHashtags = {
  'Thought leadership': ['#liderazgo', '#RRHH', '#HRLatam', '#futuroDelTrabajo', '#bienestar', '#talento'],
  'Caso de éxito':      ['#casoDeExito', '#resultados', '#HRLatam', '#empresa', '#impacto'],
  'Storytelling':       ['#startup', '#founders', '#emprendimiento', '#LATAM', '#propósito'],
  'Insight de datos':   ['#datos', '#estadísticas', '#RRHH', '#bienestar', '#talento'],
  'Engagement':         ['#pregunta', '#comunidad', '#HRLatam', '#bienestar', '#debate'],
};
