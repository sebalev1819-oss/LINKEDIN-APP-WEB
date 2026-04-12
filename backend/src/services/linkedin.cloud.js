/**
 * backend/src/services/linkedin.cloud.js
 * Stub del servicio LinkedIn para entorno cloud (Render/Railway).
 * Playwright require un browser real y no funciona en cloud gratis.
 * Las automatizaciones deben ejecutarse desde la PC local.
 */
'use strict';

const CLOUD_MSG = 'La automatización de LinkedIn requiere ejecución local. Levantá el backend en tu PC para usar esta función.';

const stub = async () => ({ ok: false, cloud: true, error: CLOUD_MSG });

module.exports = {
  validateSession:       stub,
  sendMessage:           stub,
  likePost:              stub,
  likePostsFromFeed:     stub,
  commentPost:           stub,
  viewProfile:           stub,
  publishPost:           stub,
  sendConnectionRequest: stub,
  endorseSkill:          stub,
  closeSession:          async () => {},
  closeAllSessions:      async () => {},
};
