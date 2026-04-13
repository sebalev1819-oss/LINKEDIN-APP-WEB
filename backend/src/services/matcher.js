/**
 * backend/src/services/matcher.js
 * Profile & post matching engine for Smart Engage.
 * Scores profiles/posts against targeting criteria to find relevant matches.
 */
'use strict';

/**
 * Score a profile against targeting criteria.
 * @param {{ name, headline, profileUrl, location }} profile
 * @param {{ titles, keywords, industries, countries }} criteria
 * @returns {number} 0-100 match score
 */
function scoreProfile(profile, criteria) {
  let score = 0;
  const hl = (profile.headline || '').toLowerCase();
  const loc = (profile.location || '').toLowerCase();

  // Title match: +30 if headline contains any target title
  if (criteria.titles?.length) {
    const match = criteria.titles.some(t => hl.includes(t.toLowerCase()));
    if (match) score += 30;
  }

  // Keyword match: +10 per keyword found (max 30)
  if (criteria.keywords?.length) {
    let kwScore = 0;
    for (const kw of criteria.keywords) {
      if (hl.includes(kw.toLowerCase())) kwScore += 10;
    }
    score += Math.min(kwScore, 30);
  }

  // Location match: +20 if location contains any target country
  if (criteria.countries?.length) {
    const match = criteria.countries.some(c => loc.includes(c.toLowerCase()));
    if (match) score += 20;
  }

  // Industry match: +15 if headline mentions target industry
  if (criteria.industries?.length) {
    const match = criteria.industries.some(i => hl.includes(i.toLowerCase()));
    if (match) score += 15;
  }

  // Name exists bonus: +5 (valid profile)
  if (profile.name && profile.name.trim().length > 1) score += 5;

  return Math.min(score, 100);
}

/**
 * Score a feed post against targeting criteria.
 * @param {{ author, postText, hashtags }} post
 * @param {{ keywords, titles }} criteria
 * @returns {number} 0-100 relevance score
 */
function scorePost(post, criteria) {
  let score = 0;
  const text = (post.postText || '').toLowerCase();
  const authorHl = (post.author?.headline || '').toLowerCase();

  // Keyword in post text: +15 per keyword (max 45)
  if (criteria.keywords?.length) {
    let kwScore = 0;
    for (const kw of criteria.keywords) {
      if (text.includes(kw.toLowerCase())) kwScore += 15;
    }
    score += Math.min(kwScore, 45);
  }

  // Author title match: +25
  if (criteria.titles?.length) {
    const match = criteria.titles.some(t => authorHl.includes(t.toLowerCase()));
    if (match) score += 25;
  }

  // Hashtag overlap: +10 per matching hashtag (max 20)
  if (criteria.keywords?.length && post.hashtags?.length) {
    let tagScore = 0;
    for (const tag of post.hashtags) {
      const cleanTag = tag.replace('#', '').toLowerCase();
      if (criteria.keywords.some(kw => cleanTag.includes(kw.toLowerCase()) || kw.toLowerCase().includes(cleanTag))) {
        tagScore += 10;
      }
    }
    score += Math.min(tagScore, 20);
  }

  // Post length bonus: +10 for substantial posts (>100 chars = real content)
  if (text.length > 100) score += 10;

  return Math.min(score, 100);
}

/**
 * Filter and rank profiles by match score.
 * @param {Array} profiles
 * @param {object} criteria
 * @param {number} minScore — minimum score to include (default 40)
 * @returns {Array} scored and sorted profiles
 */
function filterAndRankProfiles(profiles, criteria, minScore = 40) {
  return profiles
    .map(p => ({ ...p, matchScore: scoreProfile(p, criteria) }))
    .filter(p => p.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Filter and rank feed posts by relevance.
 */
function filterAndRankPosts(posts, criteria, minScore = 30) {
  return posts
    .map(p => ({ ...p, matchScore: scorePost(p, criteria) }))
    .filter(p => p.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
  scoreProfile,
  scorePost,
  filterAndRankProfiles,
  filterAndRankPosts,
};
