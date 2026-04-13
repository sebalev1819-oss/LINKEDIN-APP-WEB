/**
 * backend/src/services/ai-comments.js
 * AI-powered comment generator using Claude API (Haiku for speed/cost).
 * Generates contextual, professional comments for LinkedIn posts.
 */
'use strict';

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  Anthropic = null;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Fallback templates when API is unavailable
const FALLBACK_TEMPLATES = [
  'Muy buen análisis, gracias por compartir esta perspectiva.',
  'Interesante punto de vista. Coincide con lo que estamos viendo en el sector.',
  'Excelente contenido. Esto resuena mucho con nuestra experiencia en bienestar corporativo.',
  'Gran reflexión. La tendencia que mencionás es clave para el futuro del trabajo.',
  'Valioso aporte. En nuestra experiencia con empresas en LATAM vemos resultados similares.',
  'Muy relevante para quienes trabajamos en capital humano. Gracias por compartirlo.',
  'Buen punto. El impacto medible es lo que más interesa a las organizaciones hoy.',
  'Coincido plenamente. Los datos respaldan esta visión del bienestar como estrategia.',
  'Gracias por poner estos temas sobre la mesa. Cada vez más relevante en la región.',
  'Excelente perspectiva. En Care Assistance vemos tendencias similares con nuestros clientes.',
];

// Track recent comments to avoid repetition
const recentComments = [];
const MAX_RECENT = 20;

/**
 * Generate a contextual comment for a LinkedIn post using Claude API.
 * @param {object} opts
 * @param {string} opts.postText — The post content
 * @param {string} opts.authorName — Post author's name
 * @param {string} opts.authorHeadline — Author's headline/title
 * @returns {Promise<string>} Generated comment
 */
async function generateComment({ postText, authorName, authorHeadline }) {
  // Try Claude API first
  if (Anthropic && ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

      const truncatedPost = postText.slice(0, 500);

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Generá un comentario profesional de 1-2 oraciones en español para este post de LinkedIn.

Post de ${authorName} (${authorHeadline}):
"${truncatedPost}"

Reglas:
- Máximo 200 caracteres
- Tono: founder de bienestar corporativo en LATAM, profesional pero cercano
- Debe mostrar que leíste el post (referenciá algo específico del contenido)
- No uses más de 1 emoji
- No empieces con "Excelente" ni "Gran post"
- Aportá una perspectiva o dato complementario si es posible
- Escribí en español rioplatense natural

Respondé SOLO con el comentario, sin comillas ni explicación.`,
        }],
      });

      const comment = response.content[0]?.text?.trim();
      if (comment && comment.length > 10 && comment.length <= 300) {
        // Check for repetition
        if (!recentComments.includes(comment)) {
          trackComment(comment);
          return comment;
        }
      }
    } catch (err) {
      console.error('[AI Comments] Claude API error:', err.message);
    }
  }

  // Fallback to templates
  return pickFallbackTemplate();
}

/**
 * Generate a personalized connection note.
 */
async function generateConnectionNote({ name, headline, context }) {
  if (Anthropic && ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `Generá una nota de conexión para LinkedIn (máx 280 caracteres) en español.

Destinatario: ${name} — ${headline}
Contexto: ${context || 'Encontrado via búsqueda de perfiles de HR/bienestar en LATAM'}
Quién soy: Sebastián Levin, founder de Care Assistance (bienestar corporativo B2B en Argentina, Chile y México)

Reglas:
- Máximo 280 caracteres (límite de LinkedIn)
- Mencioná algo específico del perfil del destinatario
- Proponé valor, no pidas nada
- Tono profesional pero cercano
- Sin emojis

Respondé SOLO con la nota.`,
        }],
      });

      const note = response.content[0]?.text?.trim();
      if (note && note.length <= 300) return note;
    } catch (err) {
      console.error('[AI Comments] Connection note error:', err.message);
    }
  }

  // Fallback
  const firstName = name?.split(' ')[0] || '';
  return `Hola ${firstName}, vi tu perfil y me pareció muy interesante tu experiencia en ${headline?.split(' ')[0] || 'el sector'}. Trabajo en bienestar corporativo en LATAM y creo que podemos generar sinergia. Saludos, Sebastián.`;
}

function pickFallbackTemplate() {
  // Pick a template not recently used
  const available = FALLBACK_TEMPLATES.filter(t => !recentComments.includes(t));
  const pool = available.length > 0 ? available : FALLBACK_TEMPLATES;
  const comment = pool[Math.floor(Math.random() * pool.length)];
  trackComment(comment);
  return comment;
}

function trackComment(comment) {
  recentComments.push(comment);
  if (recentComments.length > MAX_RECENT) recentComments.shift();
}

/**
 * Check if Claude API is configured.
 */
function isAIAvailable() {
  return !!(Anthropic && ANTHROPIC_API_KEY);
}

module.exports = {
  generateComment,
  generateConnectionNote,
  isAIAvailable,
};
