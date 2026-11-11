# Web 卡片设计复刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, responsive HTML/CSS/JS recreation of the supplied “设计鉴赏-Web卡片设计 1” page with separately stored SVG illustrations and selectable card navigation.

**Architecture:** Keep the feature isolated under `design-recreation/`. `index.html` owns semantic card content, `styles.css` owns all layout and visual tokens, `assets/*.svg` owns each illustration, and `app.js` owns selection/navigation behavior. `placeholder.html` is a static destination that reads the `tool` query parameter and offers a return link.

**Tech Stack:** Native HTML, CSS, vanilla JavaScript, standalone SVG assets; no build step or runtime dependency.

---

### Task 1: Create the asset set

**Files:**
- Create: `design-recreation/assets/pdf-word.svg`
- Create: `design-recreation/assets/pdf-merge.svg`
- Create: `design-recreation/assets/video-mp4.svg`
- Create: `design-recreation/assets/pdf-ppt.svg`
- Create: `design-recreation/assets/ppt-create.svg`
- Create: `design-recreation/assets/realtime-record.svg`
- Create: `design-recreation/assets/reading-assistant.svg`

- [ ] **Step 1: Add shared SVG conventions**

Use a `viewBox="0 0 320 240"`, rounded geometry, `linearGradient` fills, and `filter` drop shadows. Keep all text out of the SVG so the page remains searchable and responsive.

- [ ] **Step 2: Draw the four feature illustrations**

Use stacked paper/file planes for PDF tools, a translucent play plane and `.MP4` pill for the video asset, and a circular refresh accent for the PPT asset. Keep each file self-contained so it can be swapped independently.

- [ ] **Step 3: Draw the three utility icons**

Use compact 64×64 style compositions for the PPT monitor, microphone/waveform, and document/upload icons. Export them with transparent backgrounds and the same purple/blue/cyan visual language.

- [ ] **Step 4: Validate the assets**

Run:

```powershell
Get-ChildItem design-recreation/assets/*.svg | Measure-Object
```

Expected: `Count` is `7`, and every SVG begins with `<svg` and contains a `viewBox`.

### Task 2: Build the page structure

**Files:**
- Create: `design-recreation/index.html`

- [ ] **Step 1: Add document shell and metadata**

Create a standards-based document with `lang="zh-CN"`, viewport metadata, page title, and a stylesheet/script reference relative to the file.

- [ ] **Step 2: Add the hero heading**

Use a heading split into `.title-cn`, `.title-en`, and `.title-index` so white and lime text can be styled independently.

- [ ] **Step 3: Add the feature card grid**

Create four `<article class="tool-card tool-card--feature" data-tool="...">` elements. Each has a label, `<h2>`, description, `<img>` asset, and a button-like link with `data-action="navigate"`.

- [ ] **Step 4: Add the utility card grid**

Create three `.tool-card--utility` cards using the utility SVGs, description text, and action controls. Give every card a meaningful `aria-label` through its heading and a visible focus target.

### Task 3: Implement styling and responsive layout

**Files:**
- Create: `design-recreation/styles.css`

- [ ] **Step 1: Define tokens and base styles**

Set OKLCH-inspired dark background colors, lime accent, cool text colors, an 8px spacing scale, rounded corners, and `cubic-bezier(0.16, 1, 0.3, 1)` transitions. Use a system sans stack that renders Chinese cleanly without external font downloads.

- [ ] **Step 2: Style the desktop composition**

Use a centered shell with max width, 2×2 feature grid, 3-column utility grid, generous dark gutters, soft card gradients, and illustration placement aligned to the lower-right of feature cards.

- [ ] **Step 3: Add hover, focus, and selected states**

`.tool-card:hover`, `.tool-card:focus-within`, and `.tool-card.is-selected` should increase contrast, lift 4px, and add a lime/purple outline. Keep text readable over every gradient.

- [ ] **Step 4: Add responsive breakpoints**

At 1024px keep the 2×2 feature layout; between 720px and 1023px use two columns for both groups; below 720px stack feature cards and make utility cards a horizontal snap-scrolling row. Add a reduced-motion media query that removes lifts and transitions.

### Task 4: Implement navigation behavior

**Files:**
- Create: `design-recreation/app.js`

- [ ] **Step 1: Define the tool map**

Store each slug’s display name and short description in a `toolDetails` object keyed by `pdf-word`, `pdf-merge`, `video-mp4`, `pdf-ppt`, `ppt-create`, `realtime-record`, and `reading-assistant`.

- [ ] **Step 2: Wire click and keyboard activation**

Listen for clicks on `.tool-card` and `[data-action="navigate"]`. Add `is-selected` to the card, then set `window.location.href = \`placeholder.html?tool=${encodeURIComponent(slug)}\``. Let native links remain keyboard accessible and prevent duplicate event handling with `event.preventDefault()` only on card-level activation.

- [ ] **Step 3: Add a short selection feedback state**

Keep the selected class until navigation begins, and set `aria-current="true"` on the active card link before assigning the destination.

- [ ] **Step 4: Validate behavior with a browser**

Open `design-recreation/index.html`, click each card and action control, and verify the destination includes the expected `tool` slug. Use Tab, Enter, and Space to confirm keyboard activation and visible focus.

### Task 5: Build the placeholder destination page

**Files:**
- Create: `design-recreation/placeholder.html`
- Modify: `design-recreation/app.js` (only if shared tool metadata needs exporting)

- [ ] **Step 1: Add the placeholder document**

Create a matching dark shell with a heading, description, a “返回工具总览” link, and a small status chip indicating that the destination is a local placeholder.

- [ ] **Step 2: Read and render the query parameter**

Use `new URLSearchParams(window.location.search).get('tool')`, find its entry in the local `toolDetails` map, and fall back to the overview message when the slug is missing or unknown.

- [ ] **Step 3: Verify back navigation**

Open each destination manually and confirm the return link points to `index.html` and preserves a valid page load without a build server.

### Task 6: Run final review and checks

**Files:**
- Modify: `design-recreation/index.html`, `design-recreation/styles.css`, `design-recreation/app.js`, or assets only when verification exposes a concrete issue.

- [ ] **Step 1: Run static syntax checks**

```powershell
node --check design-recreation/app.js
```

Expected: exit code `0` with no syntax output.

- [ ] **Step 2: Serve the folder locally**

```powershell
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=path.resolve('design-recreation');http.createServer((req,res)=>{const p=path.join(root,req.url==='/'?'index.html':decodeURIComponent(req.url.slice(1)));fs.readFile(p,(e,d)=>{res.writeHead(e?404:200,{'Content-Type':p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':p.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(e?'Not found':d);});}).listen(52342,()=>console.log('http://localhost:52342'));"
```

- [ ] **Step 3: Inspect desktop and mobile screenshots**

Check the page at desktop width and a narrow mobile width. Confirm no clipped text, broken asset URLs, or horizontal overflow outside the intended utility row.

- [ ] **Step 4: Run the repository checks**

```powershell
pnpm typecheck
pnpm test -- --runInBand
```

Expected: existing repository checks remain green because the new standalone directory does not import into `src/`.

- [ ] **Step 5: Summarize deliverables**

Report the absolute path to `design-recreation/index.html`, the asset directory, the local preview URL, and the validation commands used.
