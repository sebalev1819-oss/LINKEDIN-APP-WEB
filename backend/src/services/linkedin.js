/**
 * backend/src/services/linkedin.js
 * Core LinkedIn automation engine using Playwright.
 *
 * All public methods:
 *   validateSession(cookie)       → { ok, name, headline }
 *   sendMessage(accId, profileUrl, message) → { ok }
 *   likePost(accId, postUrn)      → { ok }
 *   commentPost(accId, postUrn, text)       → { ok }
 *   viewProfile(accId, profileUrl)          → { ok }
 *   publishPost(accId, text)      → { ok, postUrl }
 *   sendConnectionRequest(accId, profileUrl, note) → { ok }
 *   closeSession(accId)           → void
 */
'use strict';

const { chromium } = require('playwright');

const HEADLESS      = process.env.HEADLESS !== 'false';
const DELAY_MIN     = parseInt(process.env.ACTION_DELAY_MIN || '2000', 10);
const DELAY_MAX     = parseInt(process.env.ACTION_DELAY_MAX || '8000', 10);
const LI_BASE       = 'https://www.linkedin.com';

// Map: accountId → { browser, context, page }
const sessions = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Random delay between DELAY_MIN and DELAY_MAX ms */
function humanDelay(min = DELAY_MIN, max = DELAY_MAX) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));
}

/** Build cookie string to inject into browser context */
function buildCookies(liAt) {
  return [
    { name: 'li_at', value: liAt, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true },
    { name: 'lang', value: 'v=2&lang=es-es', domain: '.linkedin.com', path: '/', httpOnly: false, secure: false },
  ];
}

/** Get or create a browser context for a given account */
async function getContext(accountId, cookie) {
  if (sessions.has(accountId)) {
    return sessions.get(accountId);
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1366,768',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });

  // Inject LinkedIn session cookie
  await context.addCookies(buildCookies(cookie));

  const page = await context.newPage();

  // Anti-detection: remove navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const session = { browser, context, page };
  sessions.set(accountId, session);
  return session;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate that a li_at cookie belongs to a real session.
 * Returns the account name and headline if valid.
 */
async function validateSession(cookie) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    await context.addCookies(buildCookies(cookie));
    const page = await context.newPage();

    await page.goto(`${LI_BASE}/in/me`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await humanDelay(1000, 2000);

    // If redirected to login page, cookie is invalid
    if (page.url().includes('/login') || page.url().includes('/authwall')) {
      return { ok: false, error: 'Sesión inválida o expirada' };
    }

    // Extract name and headline
    const name = await page.$eval(
      'h1.text-heading-xlarge, h1[class*="profile-name"]',
      el => el.innerText.trim(),
    ).catch(() => 'Usuario de LinkedIn');

    const headline = await page.$eval(
      '.text-body-medium.break-words, .profile-headline, div[class*="profile-section-card"] .text-body-medium',
      el => el.innerText.trim(),
    ).catch(() => 'LinkedIn Member');

    return { ok: true, name, headline };
  } catch (err) {
    console.error('[LinkedIn] validateSession error:', err.message);
    return { ok: false, error: err.message };
  } finally {
    await browser?.close();
  }
}

/**
 * Send a direct message to a LinkedIn profile.
 * @param {string} accountId - ID of the account in DB
 * @param {string} cookie    - li_at cookie for the account
 * @param {string} profileUrl  - Full LinkedIn profile URL
 * @param {string} message   - Message text to send
 */
async function sendMessage(accountId, cookie, profileUrl, message) {
  try {
    const { page } = await getContext(accountId, cookie);

    // Navigate to profile
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(1500, 3000);

    // Click "Message" button on profile
    const msgBtn = page.locator('button:has-text("Mensaje"), button:has-text("Message")').first();
    await msgBtn.waitFor({ timeout: 8000 });
    await msgBtn.click();
    await humanDelay(1000, 2000);

    // Wait for message compose area
    const textArea = page.locator('.msg-form__contenteditable, div[contenteditable="true"]').first();
    await textArea.waitFor({ timeout: 8000 });

    // Type message with human-like delays
    await textArea.click();
    for (const char of message) {
      await page.keyboard.type(char, { delay: Math.random() * 80 + 30 });
    }

    await humanDelay(800, 1500);

    // Send (Enter or click send button)
    const sendBtn = page.locator('button.msg-form__send-button').first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await humanDelay(1000, 2000);
    console.log(`[LinkedIn] Message sent to ${profileUrl}`);
    return { ok: true };
  } catch (err) {
    console.error('[LinkedIn] sendMessage error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Like a LinkedIn post by its URL.
 */
async function likePost(accountId, cookie, postUrl) {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    // Find like button (not already liked)
    const likeBtn = page.locator(
      'button[aria-label*="Like"], button[aria-label*="Me gusta"]',
    ).first();
    await likeBtn.waitFor({ timeout: 8000 });

    const isLiked = await likeBtn.getAttribute('aria-pressed').catch(() => 'false');
    if (isLiked === 'true') {
      return { ok: true, skipped: true, reason: 'Already liked' };
    }

    await likeBtn.click();
    await humanDelay(500, 1500);
    console.log(`[LinkedIn] Post liked: ${postUrl}`);
    return { ok: true };
  } catch (err) {
    console.error('[LinkedIn] likePost error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Comment on a LinkedIn post.
 */
async function commentPost(accountId, cookie, postUrl, commentText) {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    // Click on "Comment" button to open compose area
    const commentBtn = page.locator('button[aria-label*="Comentar"], button[aria-label*="Comment"]').first();
    await commentBtn.waitFor({ timeout: 8000 });
    await commentBtn.click();
    await humanDelay(1000, 2000);

    // Type comment
    const textArea = page.locator('.comments-comment-box__form div[contenteditable="true"]').first();
    await textArea.waitFor({ timeout: 8000 });
    await textArea.click();

    for (const char of commentText) {
      await page.keyboard.type(char, { delay: Math.random() * 90 + 30 });
    }

    await humanDelay(1000, 2000);

    // Submit comment
    const postBtn = page.locator('button.comments-comment-box__submit-button').first();
    if (await postBtn.isVisible()) {
      await postBtn.click();
    } else {
      await page.keyboard.press('Control+Enter');
    }

    await humanDelay(1000, 2500);
    console.log(`[LinkedIn] Comment posted on ${postUrl}`);
    return { ok: true };
  } catch (err) {
    console.error('[LinkedIn] commentPost error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * View a LinkedIn profile (generates visibility signal).
 */
async function viewProfile(accountId, cookie, profileUrl) {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Scroll down to simulate reading the profile
    await humanDelay(1500, 3000);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.6));
    await humanDelay(1500, 3000);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
    await humanDelay(500, 1500);

    const name = await page.$eval('h1.text-heading-xlarge', el => el.innerText.trim()).catch(() => '');
    console.log(`[LinkedIn] Profile viewed: ${name || profileUrl}`);
    return { ok: true, name };
  } catch (err) {
    console.error('[LinkedIn] viewProfile error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Publish a text post on LinkedIn.
 */
async function publishPost(accountId, cookie, text) {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(`${LI_BASE}/feed/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await humanDelay(3000, 5000);

    console.log('[LinkedIn] publishPost: buscando botón "Comenzar publicación"...');

    // LinkedIn changes class names often — try multiple selectors
    const startSelectors = [
      'button.share-box-feed-entry__trigger',
      'button[aria-label*="Comenzar una publicación"]',
      'button[aria-label*="Start a post"]',
      'button[aria-label*="Crear una publicación"]',
      '.share-box-feed-entry__trigger',
      '[data-control-name="share.feedshare_module.reshare_article_post"]',
    ];

    let started = false;
    for (const sel of startSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          started = true;
          console.log(`[LinkedIn] publishPost: botón encontrado con: ${sel}`);
          break;
        }
      } catch {}
    }

    // Last resort: look for any clickable element in the share box area
    if (!started) {
      try {
        await page.locator('.share-box-feed-entry').first().click();
        started = true;
        console.log('[LinkedIn] publishPost: using share-box-feed-entry fallback');
      } catch {}
    }

    if (!started) {
      throw new Error('No se encontró el botón "Comenzar publicación". LinkedIn puede haber cambiado su UI.');
    }

    await humanDelay(2000, 4000);

    // Editor area — multiple possible selectors
    const editorSelectors = [
      'div.ql-editor[data-placeholder]',
      'div[contenteditable="true"][data-placeholder]',
      'div[role="textbox"][contenteditable="true"]',
      '.share-creation-state__content div[contenteditable]',
    ];

    let editor = null;
    for (const sel of editorSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 4000 })) {
          editor = el;
          console.log(`[LinkedIn] publishPost: editor encontrado: ${sel}`);
          break;
        }
      } catch {}
    }

    if (!editor) {
      throw new Error('No se encontró el área de texto del post.');
    }

    await editor.click();
    await humanDelay(500, 1000);

    // Type with human-like speed
    for (const char of text) {
      await page.keyboard.type(char, { delay: Math.random() * 60 + 20 });
      if (char === '\n') await humanDelay(200, 500);
    }

    await humanDelay(2000, 4000);

    // Post button — try multiple selectors
    const postBtnSelectors = [
      'button.share-actions__primary-action',
      'button[aria-label="Publicar"]',
      'button[aria-label="Post"]',
      'button:has-text("Publicar")',
      'button:has-text("Post")',
    ];

    let posted = false;
    for (const sel of postBtnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          posted = true;
          console.log(`[LinkedIn] publishPost: publicado con selector: ${sel}`);
          break;
        }
      } catch {}
    }

    if (!posted) throw new Error('No se encontró el botón "Publicar".');

    await humanDelay(3000, 6000);
    console.log('[LinkedIn] Post publicado exitosamente en LinkedIn ✅');
    return { ok: true };
  } catch (err) {
    console.error('[LinkedIn] publishPost error:', err.message);
    return { ok: false, error: err.message };
  }
}


/**
 * Send a connection request with an optional note.
 */
async function sendConnectionRequest(accountId, cookie, profileUrl, note = '') {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    // Click "Connect" button
    const connectBtn = page.locator(
      'button:has-text("Conectar"), button:has-text("Connect")',
    ).first();
    await connectBtn.waitFor({ timeout: 10000 });
    await connectBtn.click();
    await humanDelay(1000, 2500);

    // Add a note if provided
    if (note) {
      const addNoteBtn = page.locator('button:has-text("Agregar nota"), button:has-text("Add a note")').first();
      if (await addNoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addNoteBtn.click();
        await humanDelay(500, 1500);

        const noteArea = page.locator('textarea#custom-message').first();
        await noteArea.waitFor({ timeout: 5000 });
        for (const char of note.slice(0, 300)) {
          await page.keyboard.type(char, { delay: Math.random() * 70 + 25 });
        }
        await humanDelay(800, 1500);
      }
    }

    // Send
    const sendBtn = page.locator('button[aria-label*="Enviar ahora"], button:has-text("Enviar"), button:has-text("Send")').first();
    await sendBtn.waitFor({ timeout: 5000 });
    await sendBtn.click();
    await humanDelay(1000, 2000);

    console.log(`[LinkedIn] Connection request sent to ${profileUrl}`);
    return { ok: true };
  } catch (err) {
    console.error('[LinkedIn] sendConnectionRequest error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Like posts from the LinkedIn feed (for automation).
 * Scrolls through the feed and likes up to `limit` posts that aren't already liked.
 */
async function likePostsFromFeed(accountId, cookie, limit = 5) {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(`${LI_BASE}/feed/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    let liked = 0;
    let scrolls = 0;

    while (liked < limit && scrolls < 5) {
      // Find all visible like buttons that haven't been pressed yet
      const buttons = await page.locator(
        'button[aria-label*="Like"][aria-pressed="false"], button[aria-label*="Me gusta"][aria-pressed="false"]'
      ).all();

      for (const btn of buttons) {
        if (liked >= limit) break;
        try {
          const visible = await btn.isVisible();
          if (!visible) continue;
          await btn.scrollIntoViewIfNeeded();
          await humanDelay(500, 1500);
          await btn.click();
          liked++;
          console.log(`[LinkedIn] Liked post ${liked}/${limit} from feed`);
          await humanDelay(DELAY_MIN, DELAY_MAX);
        } catch {}
      }

      // Scroll down for more posts
      if (liked < limit) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
        await humanDelay(1500, 3000);
        scrolls++;
      }
    }

    return { ok: true, liked };
  } catch (err) {
    console.error('[LinkedIn] likePostsFromFeed error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Endorse a skill on a profile.
 */
async function endorseSkill(accountId, cookie, profileUrl) {
  try {
    const { page } = await getContext(accountId, cookie);
    await page.goto(`${profileUrl}/details/skills/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    const endorseBtn = page.locator('button:has-text("Recomendar"), button:has-text("Endorse")').first();
    if (await endorseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await endorseBtn.click();
      await humanDelay(1000, 2000);
      return { ok: true };
    }

    return { ok: false, error: 'No endorse button found' };
  } catch (err) {
    console.error('[LinkedIn] endorseSkill error:', err.message);
    return { ok: false, error: err.message };
  }
}

/** Close browser session for an account */
async function closeSession(accountId) {
  const session = sessions.get(accountId);
  if (session) {
    await session.browser.close().catch(() => {});
    sessions.delete(accountId);
    console.log(`[LinkedIn] Session closed for account ${accountId}`);
  }
}

/** Close all open sessions (called on server shutdown) */
async function closeAllSessions() {
  for (const [id, session] of sessions.entries()) {
    await session.browser.close().catch(() => {});
    sessions.delete(id);
  }
  console.log('[LinkedIn] All sessions closed');
}

module.exports = {
  validateSession,
  sendMessage,
  likePost,
  likePostsFromFeed,
  commentPost,
  viewProfile,
  publishPost,
  sendConnectionRequest,
  endorseSkill,
  closeSession,
  closeAllSessions,
};
