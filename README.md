# 📖 Kwik Reads

> Static. Woven. No build step, no framework, no fetch-and-parse — just HTML pages linked together like a web.

**Status:** `v2.0.0` (rewrite) | **First Story:** *The Ghost in the Silicon*

---

## The Idea

Quick Reads is a serialized fiction platform made of plain HTML, CSS, and JS. Nothing compiles. Nothing fetches markdown at runtime and converts it in the browser. A chapter is a page. A page is a file. You write it, drop it in a folder, push it, and it's live.

The design language is **interwoven** — purple, blue, and red threading through dark backgrounds, nodes connecting to nodes, transitions that feel like moving *along a strand* rather than just switching screens. The site should feel like a network you're traveling through, not a document viewer.

**No build step.** No `npm run build`. No router parsing markdown client-side. What you write is (almost) what ships.

---

## Architecture

```
kwik-reads/
├── index.html                      # Landing page — story grid
├── css/
│   └── style.css                   # Shared theme: colors, type, transitions
├── js/
│   └── transitions.js              # Shared interactive/transition behavior
├── template/
│   ├── chapter-template.html       # Skeleton the script fills in
│   └── story-index-template.html   # Skeleton for a story's landing page
├── scripts/
│   ├── new-chapter.js              # Local-only generator (never runs in browser/CI)
│   └── manifest.json               # Script-maintained record of stories/chapters/order
├── stories/
│   └── ghost-in-the-silicon/
│       ├── index.html              # Generated: cover, synopsis, chapter list
│       ├── ch-01.html              # Generated: content + prev/next
│       ├── ch-02.html
│       └── ch-NN.html
└── assets/
    └── covers/
```

Every chapter is a **real, standalone `.html` file** — but you never hand-edit its `<head>`, its shared chrome, or its `prev`/`next` links. The script owns all of that. There is no central JSON that the *browser* fetches and parses before anything renders — `manifest.json` is read only by the script on your machine, never shipped to or used by the live site. There is no markdown-to-HTML conversion happening in the visitor's browser, and no build step in CI. The story lives directly in the HTML, but the HTML is machine-written from your plain text.

---

## Theme: Purple / Blue / Red

```css
:root {
    --void:        #0a0a12;   /* background */
    --thread-1:    #6c5ce7;   /* purple — primary */
    --thread-2:    #4a7dff;   /* blue — secondary */
    --thread-3:    #e63965;   /* red — accent / alert */
    --text:        #e8e8f0;
    --text-dim:    #9a9ab0;
}
```

Palette is locked in. The "interwoven / web" feeling — connecting lines, node motifs, transitions that feel like traveling along a thread rather than a hard cut — is the right direction but **intentionally not fully specced yet**. Rather than guess at a motif now, this is a "come back and iterate together" item once there's real content on the page to design around. For now: solid color theme, `transitions.js` handles page-to-page transitions, and `prefers-reduced-motion` is respected wherever animation is added — but the specific visual language of "interwoven" is TBD.

**Open design question (revisit later):** what actually renders the thread/node motif — SVG line art between story cards, an animated canvas/background, or something simpler like colored connector bars in the nav? Pick this once `transitions.js` exists and there's something to react to.

---

## Workflow: Grab, Write, Run, Push

This is the whole loop once the script exists — a new chapter should be close to "paste text, done":

1. Write the chapter in any plain `.txt` file — no HTML, no markdown syntax, just prose separated by blank lines.
2. Run the script: `node scripts/new-chapter.js --story your-story-slug --file my-chapter.txt`
3. The script does everything else (see below).
4. `git add . && git commit -m "add chapter N" && git push` — live in a minute or two.

**What the script owns, so you don't hand-edit HTML:**

- **Text → HTML:** splits the `.txt` on blank lines into `<p>` tags and drops that into `chapter-template.html`.
- **Naming:** derives `ch-01.html`, `ch-02.html`, etc. from the next available number in that story's folder — simple, predictable naming scheme, no manual numbering mistakes.
- **Manifest:** reads/writes `scripts/manifest.json` — the script's own record of which stories exist, which chapters each has, and their order. This is *not* fetched by the live site; it only exists so the script knows what to auto-link.
- **Prev/Next:** using the manifest, it sets (and, importantly, *fixes up neighboring files' links too*) the `← Previous` / `Next →` `<a href>` on the new chapter and on the chapters before/after it. This is the piece that would be the most annoying to keep consistent by hand once you're past a handful of chapters, so it's worth having the script own it even if you keep everything else minimal.
- **Story landing page:** regenerates `stories/your-slug/index.html`'s chapter list from the manifest, so it can never drift out of sync with what chapter files actually exist.
- **Root landing page:** optionally regenerates the story grid in the root `index.html` from the manifest too, so adding a brand-new story is just as "grab and write" as adding a chapter.

**Adding a brand-new story:**
```
node scripts/new-chapter.js --story your-story-slug --file ch01.txt --new-story --title "Your Story Title" --cover assets/covers/your-cover.jpg
```
The `--new-story` flag has it create the folder, seed the manifest entry, and generate the story's `index.html` from `story-index-template.html`, then proceed exactly like a normal chapter add.

**Kept genuinely manual, by design:** the *prose itself*, chapter titles, and cover art. Everything mechanical is the script's job; everything creative stays yours.

---

## Navigation Model

- **Landing page (`index.html`)** — grid of story cards, each linking to that story's `index.html`.
- **Story page (`stories/slug/index.html`)** — cover, synopsis, chapter list, "Start Reading" → `ch-01.html`.
- **Chapter page** — the chapter content, plus a `← Previous` / `Next →` bar. These are just `<a href="ch-02.html">` links baked into the HTML at write time. No JS is required for navigation to function — JS only adds the transition polish on top.

No `stories.json`. No client-side fetch of story metadata to render the landing page — the landing page's story cards are either hand-written or generated once by the same local script that generates chapters.

---

## Deployment

Because there's no build step, you don't need a GitHub Actions build/deploy pipeline at all:

1. Repo Settings → **Pages** → Source → **Deploy from a branch** → `main` → `/ (root)`
2. Every `git push` to `main` **is** the deploy. New chapter file shows up live within a minute or two of pushing, automatically — no workflow YAML required.

(If you later want PR previews or a staging step, that's when an Actions workflow earns its keep — not before.)

---

## Keeping Shared Chrome Minimal

Every generated page pulls shared styling and behavior via plain tags rather than inlining anything:

```html
<link rel="stylesheet" href="../../css/style.css">
<script src="../../js/transitions.js" defer></script>
```

This means the vast majority of future changes — theme tweaks, new transition behavior, footer text — happen in exactly two files (`style.css`, `transitions.js`) and never require touching or regenerating existing chapter HTML. The only things the script needs to regenerate when something changes are the *structural* pieces: prev/next links, the manifest-driven chapter lists, and the templates themselves.

## What Makes This Different From v1

| | v1 (deleted) | v2 (this) |
|---|---|---|
| Chapter format | `.md`, fetched + parsed client-side | Standalone `.html`, script-generated from plain text |
| Story metadata | Central `stories.json`, fetched by the browser at runtime | `manifest.json`, read only by the local script — never shipped to the browser |
| Deploy | GitHub Actions build/upload/deploy | Native GitHub Pages branch deploy |
| Nav | JS router computes prev/next from JSON at page load | Script bakes `prev`/`next` `<a href>` into each file ahead of time |
| New chapter | Write markdown, manually register in JSON | `node scripts/new-chapter.js` on a `.txt` file — grab, write, run, push |
| Shared chrome updates | Edit `router.js`/`ui.js` | Edit `style.css`/`transitions.js` only — chapter HTML untouched |

---

## License

MIT — see [`LICENSE`](./LICENSE)
