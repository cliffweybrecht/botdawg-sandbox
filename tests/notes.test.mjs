import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTitle,
  classify,
  splitLines,
  groupTitles,
  formatItem,
  toReleaseMarkdown,
} from '../lib/group.mjs';

describe('splitLines', () => {
  it('drops blanks, comments, and trims', () => {
    const lines = splitLines('# comment\n\nfeat: add login\n  \nfix: crash\n');
    assert.deepEqual(lines, ['feat: add login', 'fix: crash']);
  });
});

describe('parseTitle', () => {
  it('parses type, scope, and subject', () => {
    const p = parseTitle('feat(auth): add SSO');
    assert.equal(p.type, 'feat');
    assert.equal(p.scope, 'auth');
    assert.equal(p.subject, 'add SSO');
    assert.equal(p.breaking, false);
  });

  it('detects bang breaking change', () => {
    const p = parseTitle('feat(api)!: drop v1 routes');
    assert.equal(p.breaking, true);
    assert.equal(p.type, 'feat');
    assert.equal(p.subject, 'drop v1 routes');
  });

  it('detects BREAKING CHANGE text', () => {
    const p = parseTitle('chore: rename env vars BREAKING CHANGE');
    assert.equal(p.breaking, true);
  });

  it('parses optional PR numbers', () => {
    const p = parseTitle('#412 feat: dark mode');
    assert.equal(p.number, '412');
    assert.equal(p.type, 'feat');
    assert.equal(p.subject, 'dark mode');
  });

  it('handles unprefixed titles', () => {
    const p = parseTitle('Improve README examples');
    assert.equal(p.type, null);
    assert.equal(p.subject, 'Improve README examples');
  });
});

describe('classify', () => {
  it('maps feat/feature to features', () => {
    assert.equal(classify(parseTitle('feat: x')), 'features');
    assert.equal(classify(parseTitle('feature: x')), 'features');
  });

  it('maps fix/bugfix to fixes', () => {
    assert.equal(classify(parseTitle('fix: y')), 'fixes');
    assert.equal(classify(parseTitle('bugfix: y')), 'fixes');
  });

  it('maps docs/chore/unknown to other', () => {
    assert.equal(classify(parseTitle('docs: z')), 'other');
    assert.equal(classify(parseTitle('chore: z')), 'other');
    assert.equal(classify(parseTitle('refactor: z')), 'other');
    assert.equal(classify(parseTitle('plain title')), 'other');
  });

  it('breaking wins over feat/fix', () => {
    assert.equal(classify(parseTitle('feat!: nuke cache')), 'breaking');
    assert.equal(classify(parseTitle('fix!: change status codes')), 'breaking');
    assert.equal(classify(parseTitle('breaking: new auth scheme')), 'breaking');
  });
});

describe('groupTitles', () => {
  it('buckets mixed titles', () => {
    const g = groupTitles(
      [
        'feat: add export',
        'fix: null pointer',
        'feat!: remove legacy flag',
        'docs: update README',
        'chore: bump deps',
      ].join('\n'),
    );
    assert.equal(g.features.length, 1);
    assert.equal(g.fixes.length, 1);
    assert.equal(g.breaking.length, 1);
    assert.equal(g.other.length, 2);
  });
});

describe('formatItem + toReleaseMarkdown', () => {
  it('emits GFM sections in Features / Fixes / Breaking / Other order', () => {
    const md = toReleaseMarkdown(
      ['feat: add export', '#9 fix: crash on empty', 'feat!: drop Node 16', 'docs: examples'].join('\n'),
      { version: '1.2.0' },
    );
    assert.match(md, /^## v1\.2\.0\n/);
    assert.match(md, /### Features\n\n- add export/);
    assert.match(md, /### Fixes\n\n- crash on empty \(#9\)/);
    assert.match(md, /### Breaking\n\n- drop Node 16/);
    assert.match(md, /### Other\n\n- examples/);
    const iFeat = md.indexOf('### Features');
    const iFix = md.indexOf('### Fixes');
    const iBr = md.indexOf('### Breaking');
    const iOth = md.indexOf('### Other');
    assert.ok(iFeat < iFix && iFix < iBr && iBr < iOth);
  });

  it('formatItem uses PR numbers when present', () => {
    assert.equal(formatItem(parseTitle('#12 feat: foo')), '- foo (#12)');
    assert.equal(formatItem(parseTitle('feat: foo')), '- foo');
  });

  it('empty paste yields a placeholder', () => {
    const md = toReleaseMarkdown('   \n# only comment\n');
    assert.match(md, /No changes grouped yet/);
  });
});
