/**
 * Shipkit grouping — pure functions for conventional-commit PR titles.
 * Keep in sync with the inline copy in notes.html.
 */

const PREFIX_RE = /^\s*(?:(?:#)?(\d+)\s+)?(?:([a-zA-Z]+)(?:\(([^)]*)\))?(!)?\s*:\s*)?(.+?)\s*$/;

/**
 * @typedef {'features'|'fixes'|'breaking'|'other'} GroupId
 */

/**
 * Parse a single PR title / conventional-commit subject.
 * @param {string} line
 * @returns {{ raw: string, number: string|null, type: string|null, scope: string|null, breaking: boolean, subject: string }}
 */
export function parseTitle(line) {
  const raw = String(line ?? '').replace(/\r$/, '');
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw, number: null, type: null, scope: null, breaking: false, subject: '' };
  }

  const breakingInText = /\bBREAKING[- ]CHANGE\b/i.test(trimmed);
  const m = trimmed.match(PREFIX_RE);
  if (!m) {
    return { raw, number: null, type: null, scope: null, breaking: breakingInText, subject: trimmed };
  }

  const number = m[1] || null;
  const type = m[2] ? m[2].toLowerCase() : null;
  const scope = m[3] || null;
  const bang = Boolean(m[4]);
  const subject = (m[5] || trimmed).trim();

  return {
    raw,
    number,
    type,
    scope,
    breaking: bang || breakingInText || type === 'breaking',
    subject,
  };
}

/**
 * Map a parsed title to a group id.
 * Priority: breaking > feat > fix > other (docs, chore, unknown, unprefixed).
 * @param {ReturnType<typeof parseTitle>} parsed
 * @returns {GroupId}
 */
export function classify(parsed) {
  if (!parsed || !parsed.subject) return 'other';
  if (parsed.breaking) return 'breaking';
  const t = parsed.type;
  if (t === 'feat' || t === 'feature') return 'features';
  if (t === 'fix' || t === 'bugfix' || t === 'bug') return 'fixes';
  return 'other';
}

/**
 * Split pasted text into non-empty title lines.
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^#(?!\d)/.test(l));
}

/**
 * @param {string} text
 * @returns {{ features: ReturnType<typeof parseTitle>[], fixes: ReturnType<typeof parseTitle>[], breaking: ReturnType<typeof parseTitle>[], other: ReturnType<typeof parseTitle>[] }}
 */
export function groupTitles(text) {
  const groups = { features: [], fixes: [], breaking: [], other: [] };
  for (const line of splitLines(text)) {
    const parsed = parseTitle(line);
    if (!parsed.subject) continue;
    groups[classify(parsed)].push(parsed);
  }
  return groups;
}

/**
 * Format a parsed title as a GitHub-flavored markdown list item.
 * @param {ReturnType<typeof parseTitle>} parsed
 * @returns {string}
 */
export function formatItem(parsed) {
  const label = parsed.subject;
  if (parsed.number) {
    return `- ${label} (#${parsed.number})`;
  }
  return `- ${label}`;
}

const SECTION_META = [
  { id: 'features', heading: '### Features' },
  { id: 'fixes', heading: '### Fixes' },
  { id: 'breaking', heading: '### Breaking' },
  { id: 'other', heading: '### Other' },
];

/**
 * Build GitHub Release markdown from pasted titles.
 * @param {string} text
 * @param {{ version?: string, intro?: string }} [opts]
 * @returns {string}
 */
export function toReleaseMarkdown(text, opts = {}) {
  const groups = groupTitles(text);
  const version = opts.version ? String(opts.version).trim() : '';
  const intro = opts.intro ? String(opts.intro).trim() : '';
  const parts = [];

  if (version) parts.push(`## ${version.startsWith('v') ? version : `v${version}`}`, '');
  if (intro) parts.push(intro, '');

  let any = false;
  for (const { id, heading } of SECTION_META) {
    const items = groups[id];
    if (!items.length) continue;
    any = true;
    parts.push(heading, '');
    for (const item of items) parts.push(formatItem(item));
    parts.push('');
  }

  if (!any) {
    parts.push('_No changes grouped yet. Paste PR titles, one per line._', '');
  }

  return parts.join('\n').trimEnd() + '\n';
}

export const GROUP_IDS = ['features', 'fixes', 'breaking', 'other'];
export const SECTION_HEADINGS = SECTION_META;
