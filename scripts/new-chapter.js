#!/usr/bin/env node
'use strict';

/**
 * new-chapter.js — local-only generator. Never runs in the browser or in CI.
 *
 * Add a chapter to an existing story:
 *   node scripts/new-chapter.js --story ghost-in-the-silicon --file my-chapter.txt --chapter-title "Boot Sequence"
 *
 * Create a brand-new story and its first chapter in one go:
 *   node scripts/new-chapter.js --story your-slug --file ch01.txt --new-story \
 *     --title "Your Story Title" --synopsis "One line hook." --cover assets/covers/your-cover.jpg
 *
 * Requires Node 15+ (uses String.prototype.replaceAll).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const CHAPTER_TEMPLATE_PATH = path.join(ROOT, 'template', 'chapter-template.html');
const STORY_TEMPLATE_PATH = path.join(ROOT, 'template', 'story-index-template.html');
const ROOT_INDEX_PATH = path.join(ROOT, 'index.html');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function toCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const args = { newStory: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = toCamel(token.slice(2));
    const next = argv[i + 1];
    if (key === 'newStory' || next === undefined || next.startsWith('--')) {
      args[key] = true; // boolean flag
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { stories: {} };
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pad(num) {
  return String(num).padStart(2, '0');
}

// Split plain text on blank lines into <p> tags. Single newlines inside a
// paragraph become <br> (soft line breaks), not new paragraphs.
function textToParagraphs(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `  <p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function navLinkHtml(direction, href, label) {
  if (!href) {
    const fallback = direction === 'prev' ? '&larr; Start of story' : 'More coming soon &rarr;';
    return `<span class="nav-link nav-${direction} is-disabled">${fallback}</span>`;
  }
  const text = direction === 'prev' ? `&larr; ${escapeHtml(label)}` : `${escapeHtml(label)} &rarr;`;
  return `<a href="${href}" class="nav-link nav-${direction}">${text}</a>`;
}

// Replace everything between two literal marker comments, regardless of
// what template placeholder or previously-generated content sits there.
function patchBetweenMarkers(html, startMarker, endMarker, replacementHtml) {
  const pattern = new RegExp(`(${startMarker})[\\s\\S]*?(${endMarker})`);
  if (!pattern.test(html)) {
    fail(`Could not find markers ${startMarker} / ${endMarker} — template or generated file may be out of sync.`);
  }
  return html.replace(pattern, `$1\n  ${replacementHtml}\n  $2`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.story) fail('Missing --story <slug>');
  if (!args.file) fail('Missing --file <path-to-txt>');

  const storySlug = args.story;
  const storyDir = path.join(ROOT, 'stories', storySlug);
  const manifest = readManifest();

  if (args.newStory) {
    if (!args.title) fail('--new-story requires --title "Story Title"');
    if (manifest.stories[storySlug]) fail(`Story "${storySlug}" already exists in manifest.json.`);

    fs.mkdirSync(storyDir, { recursive: true });
    manifest.stories[storySlug] = {
      title: args.title,
      synopsis: args.synopsis || '',
      cover: args.cover || '',
      chapters: [],
    };
    console.log(`✓ Created story "${args.title}" (${storySlug})`);
  }

  const story = manifest.stories[storySlug];
  if (!story) fail(`Story "${storySlug}" not found in manifest.json. Use --new-story to create it first.`);

  fs.mkdirSync(storyDir, { recursive: true });

  const textPath = path.resolve(args.file);
  if (!fs.existsSync(textPath)) fail(`Chapter text file not found: ${textPath}`);

  const rawText = fs.readFileSync(textPath, 'utf8');
  const contentHtml = textToParagraphs(rawText);
  if (!contentHtml) fail(`${textPath} produced no paragraphs — is the file empty?`);

  const chapterNum = story.chapters.length + 1;
  const chapterId = `ch-${pad(chapterNum)}`;
  const chapterFile = `${chapterId}.html`;
  const chapterTitle = args.chapterTitle || `Chapter ${chapterNum}`;
  const prevChapter = story.chapters[story.chapters.length - 1] || null;

  // --- Build the new chapter file ---
  let chapterHtml = fs.readFileSync(CHAPTER_TEMPLATE_PATH, 'utf8');
  chapterHtml = chapterHtml
    .replaceAll('{{STORY_TITLE}}', escapeHtml(story.title))
    .replaceAll('{{CHAPTER_TITLE}}', escapeHtml(chapterTitle))
    .replaceAll('{{CHAPTER_NUM}}', pad(chapterNum))
    .replaceAll('{{CONTENT}}', contentHtml);

  const prevHref = prevChapter ? `${prevChapter.id}.html` : null;
  chapterHtml = patchBetweenMarkers(
    chapterHtml,
    '<!-- NAV_PREV -->',
    '<!-- /NAV_PREV -->',
    navLinkHtml('prev', prevHref, prevChapter && prevChapter.title)
  );
  chapterHtml = patchBetweenMarkers(
    chapterHtml,
    '<!-- NAV_NEXT -->',
    '<!-- /NAV_NEXT -->',
    navLinkHtml('next', null, null) // this is the newest chapter — no next yet
  );

  fs.writeFileSync(path.join(storyDir, chapterFile), chapterHtml);
  console.log(`✓ Wrote stories/${storySlug}/${chapterFile}`);

  // --- Fix up the previous chapter's "next" link to point here ---
  if (prevChapter) {
    const prevFilePath = path.join(storyDir, `${prevChapter.id}.html`);
    let prevHtml = fs.readFileSync(prevFilePath, 'utf8');
    prevHtml = patchBetweenMarkers(
      prevHtml,
      '<!-- NAV_NEXT -->',
      '<!-- /NAV_NEXT -->',
      navLinkHtml('next', chapterFile, chapterTitle)
    );
    fs.writeFileSync(prevFilePath, prevHtml);
    console.log(`✓ Updated "next" link on ${prevChapter.id}.html`);
  }

  // --- Update manifest ---
  story.chapters.push({ id: chapterId, title: chapterTitle });
  writeManifest(manifest);
  console.log('✓ Updated scripts/manifest.json');

  regenerateStoryIndex(storySlug, story);
  regenerateRootIndex(manifest);

  console.log(`\nDone — "${story.title}" now has ${story.chapters.length} chapter(s).\n`);
}

function regenerateStoryIndex(storySlug, story) {
  const storyDir = path.join(ROOT, 'stories', storySlug);
  let html = fs.readFileSync(STORY_TEMPLATE_PATH, 'utf8');

  const chapterListHtml = story.chapters
    .map(
      (ch) =>
        `<a href="${ch.id}.html" class="chapter-list-item"><span class="chapter-list-num">${ch.id.replace(
          'ch-',
          ''
        )}</span><span class="chapter-list-title">${escapeHtml(ch.title)}</span></a>`
    )
    .join('\n  ');

  const firstChapterHref = story.chapters.length ? `${story.chapters[0].id}.html` : '#';

  html = html
    .replaceAll('{{STORY_TITLE}}', escapeHtml(story.title))
    .replaceAll('{{SYNOPSIS}}', escapeHtml(story.synopsis || ''))
    .replaceAll('{{COVER_SRC}}', story.cover || '')
    .replaceAll('{{FIRST_CHAPTER_HREF}}', firstChapterHref);

  html = patchBetweenMarkers(html, '<!-- CHAPTER_LIST -->', '<!-- /CHAPTER_LIST -->', chapterListHtml);

  fs.writeFileSync(path.join(storyDir, 'index.html'), html);
  console.log(`✓ Regenerated stories/${storySlug}/index.html`);
}

function regenerateRootIndex(manifest) {
  if (!fs.existsSync(ROOT_INDEX_PATH)) {
    console.warn('⚠ Root index.html not found — skipping story grid regeneration.');
    return;
  }

  let html = fs.readFileSync(ROOT_INDEX_PATH, 'utf8');

  const storyEntries = Object.entries(manifest.stories);
  const cardsHtml = storyEntries.length
    ? storyEntries
        .map(([slug, s]) => {
          const cover = s.cover
            ? `<img class="story-card-cover" src="${s.cover}" alt="" onerror="this.style.display='none'">`
            : '';
          return `<a href="stories/${slug}/index.html" class="story-card">
    ${cover}
    <h2 class="story-card-title">${escapeHtml(s.title)}</h2>
    <p class="story-card-synopsis">${escapeHtml(s.synopsis || '')}</p>
  </a>`;
        })
        .join('\n  ')
    : `<p class="empty-state">No stories yet — run <code>scripts/new-chapter.js --new-story</code> to add one.</p>`;

  html = patchBetweenMarkers(html, '<!-- STORY_CARDS_START -->', '<!-- STORY_CARDS_END -->', cardsHtml);
  fs.writeFileSync(ROOT_INDEX_PATH, html);
  console.log('✓ Regenerated root index.html');
}

main();
