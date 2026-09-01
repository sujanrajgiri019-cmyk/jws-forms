# JWS Forms

A Google-Forms-style form builder for Windows, in the school's own colours, with the
JWS mark on every form — and responses saved straight into Excel on your own PC.
No Google account, no internet connection, no data leaving the school.

---

## Three looks, picked per form

The thing that makes this ours rather than a copy of Google Forms: **Form style**
is a setting on each form, chosen in the editor the way you'd choose letterhead.
An admissions form and a canteen poll should not wear the same suit.

| Style | What it is | Use it for |
| --- | --- | --- |
| **Register** | No cards, no boxes. Oversized orange numerals in the margin, hairline rules, inputs that are a line you write on. Taken from an admission register. | Admissions, records, anything a parent prints or signs. |
| **Panel** | The shield on a solid orange wall that never scrolls away, carrying the title, sections and live progress. Choices are chips you tap. | Longer sectioned forms — events, trips, staff returns. The default. |
| **Focus** | One question at a time, answerable from the keyboard (press **B**, press Enter). The shield ghosts into a corner. | Public forms and feedback. The one people finish on a phone. |

All three are white and orange, all three carry the mark, and all three write into
the same Excel columns. Switch style at any time — nothing about the questions or
the collected responses changes.

**A form is always light.** Even with the app in dark theme, the form itself stays
white-and-orange, because it is the school's public face and should look identical
on a parent's phone, on the office PC and on a printout.

## What it does today

**Build** — a drag-and-drop editor with 15 question types:

| Group | Types |
| --- | --- |
| Text | Short answer, Paragraph, Number, Email, Phone |
| Choice | Multiple choice, Checkboxes, Dropdown (each with an optional "Other", and shuffle) |
| Scale | Linear scale (0/1 → 10, with end labels), Star rating |
| Grid | Multiple-choice grid, Checkbox grid |
| Date & time | Date, Time |
| Layout | Section heading |

Every question supports help text and a Required toggle, and can be duplicated,
deleted or dragged into a new position. Options inside a question are draggable too.
Edits autosave.

**Preview** — see the form exactly as a respondent will, at laptop or phone width,
switching between the three styles as you go. Nothing is written to the workbook.

**Collect**, three ways, all landing in the same file:

- **Fill in on this PC** — a kiosk view on the school computer. Hand someone the
  keyboard, they answer, it saves, and "Submit another response" resets for the
  next person.
- **Wi-Fi link** — this PC serves the form to phones on the same network.
- **Public link** — a real https address anyone can open from anywhere, including
  a parent at home. See *Sharing* below.

**Read** — a Responses table inside the app, searchable, plus a one-click
**Open in Excel**.

**Update** — new versions are published to GitHub and offered in-app.

---

## Where your data lives

```
Documents\JWS Forms\
├─ forms\<id>.json                          the form definitions
├─ responses\
│  ├─ Annual Sports Day (a1b2c3).xlsx       one workbook per form  ← open this
│  └─ .recovery\<id>.jsonl                  append-only safety log
└─ (settings live in AppData\Roaming\JWSForms)
```

You can move that folder anywhere — including OneDrive or a shared drive, which
gives every response an automatic off-site backup — from **Settings → Change folder**.

### How responses are written

You asked for responses to go **straight into .xlsx**, so they do — there is no
database in between. Each submission is written by *read the workbook → merge the
new row → write a fresh file → rename it over the old one*. That matters in
practice:

- The file on disk is always a complete, valid workbook. Killing the app
  mid-write cannot leave a half-written file.
- **Add a question to a form that already has responses** and the new column is
  appended; older rows simply keep an empty cell there. Values are matched to
  columns by header name, not by position, so reordering questions never
  scrambles old data.
- Rename a form and its workbook is renamed with it — responses stay attached.

One thing to know: **if the workbook is open in Excel when someone submits,
Windows locks the file and the write fails.** The app shows a clear message
telling you to close Excel, and the response is *already* safe in
`responses\.recovery\<id>.jsonl` (written before the workbook is touched). Close
Excel, submit again, or copy the line out of the recovery log. If you expect a
busy session, keep Excel closed and read responses inside the app instead.

The generated sheet has the JWS orange header row, frozen header, autofilter,
alternating row tint and sensible column widths.

---

## Running it on your PC

**One-time setup**

1. **Node.js 20 or newer** — <https://nodejs.org> (LTS installer).
2. **Rust** — <https://rustup.rs> (run `rustup-init.exe`, accept the defaults).
3. **Microsoft C++ Build Tools** — in the Visual Studio Installer, tick
   *Desktop development with C++*. Tauri needs this to link the Windows binary.
4. **WebView2** — already present on Windows 10/11; the installer adds it if missing.

**Then, in this folder**

```powershell
npm install         # once, and after any dependency change
npm run app         # development: hot-reloading app window
npm run release     # produces the installer
```

`npm run release` writes the setup file to:

```
src-tauri\target\release\bundle\nsis\JWS Forms_0.1.0_x64-setup.exe
```

That single .exe is what you give people. It installs per-user, so it needs no
administrator rights.

---

## Publishing a release (and how updating works)

**Once, ever — create the signing keys**

```powershell
npm run tauri signer generate -- -w %USERPROFILE%\.tauri\jws-forms.key
```

This prints a **public key** and writes a **private key**. Then:

1. Paste the public key into `src-tauri\tauri.conf.json` →
   `plugins.updater.pubkey`, replacing `REPLACE_WITH_YOUR_TAURI_UPDATER_PUBLIC_KEY`.
2. In the same file, replace `REPLACE_OWNER/REPLACE_REPO` in the `endpoints` URL
   with your GitHub owner and repository.
3. In the GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `TAURI_SIGNING_PRIVATE_KEY` — the *contents* of the private key file
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you chose (blank if none)

> Keep the private key file safe and out of Git. If it is lost, installed copies
> can no longer be updated — everyone would need to reinstall by hand.

**Every release after that**

```powershell
# bump the version in BOTH package.json and src-tauri/tauri.conf.json, then:
git commit -am "Release 0.1.1"
git tag v0.1.1
git push --follow-tags
```

`.github/workflows/release.yml` builds on Windows, runs the typecheck and the Rust
tests, signs the installer and publishes a GitHub Release with `latest.json`
attached. Installed copies see the new version on next launch and update with one
click — nobody has to download anything manually.

---

## Sharing

Open a form → **Share** → **Go live**. You get a public https address and a QR code
sized for printing on a poster.

**How it works.** This PC runs the form; Cloudflare's `cloudflared` gives that PC a
temporary public web address and forwards traffic to it. No account, no port
forwarding, no hosting bill. The first time you share, the app downloads the
helper (about 25 MB) into its own folder; after that it is instant.

**What you must know before sending a link out:**

- **The link lives as long as the app does.** Close JWS Forms, or let the PC
  sleep, and the form goes offline. Reopening gives you a *new* address, so send
  the link fresh each time rather than printing it in next year's prospectus.
- **Anyone with the link can submit.** Treat it like a public web address. Don't
  collect anything you wouldn't put on a noticeboard, and switch **Accepting
  responses** off when the deadline passes.
- Windows may ask to allow **JWS Forms** through the firewall the first time —
  choose **Private networks** and allow.
- On the school network the local address (also shown) is faster.

For a permanent address that survives restarts — `forms.jws.edu.np` — you'd need a
domain and always-on hosting. That's a different build; ask when you want it.

The shared page is `src-tauri/public_form.html`. It embeds **the app's own
`src/form-styles.css`** at request time and serves the same bundled fonts, so the
phone view and the desktop view cannot drift apart. Its column-naming and
validation rules mirror `src/lib/answers.ts` — **if you change one, change the
other.**

---

## Project layout

```
src/                      React + TypeScript frontend
├─ styles.css             the app's design system (tokens, light + dark)
├─ form-styles.css        the three form looks — also served to phones
├─ assets/fonts/          Archivo + Public Sans, bundled so it works offline
├─ types.ts               form / question / answer shapes
├─ lib/
│  ├─ api.ts              every call into Rust (plus a browser-only fallback)
│  ├─ store.ts            app state + autosave (zustand)
│  ├─ answers.ts          column naming, validation, progress
│  └─ questionTypes.tsx   the question-type registry — add new types here
├─ components/            Logo, icon set, buttons/modals/menus/toasts
├─ builder/               the editor canvas
├─ fill/
│  ├─ FormRenderer.tsx    one component, three styles
│  └─ Field.tsx           the respondent-facing controls
└─ screens/               Home, Builder, Preview, Fill, Responses, Share, Settings

src-tauri/                Rust backend
├─ src/excel.rs           read/merge/write .xlsx  (unit tested)
├─ src/storage.rs         folder layout, form JSON, recovery log
├─ src/server.rs          the local form server (axum) + fonts + stylesheet
├─ src/tunnel.rs          public sharing via cloudflared  (unit tested)
├─ src/models.rs          serde shapes shared with the frontend
├─ src/lib.rs             the Tauri commands the UI calls
├─ fonts/                 the same two woff2 files, served to phones
└─ public_form.html       the page phones see
```

Checks:

```powershell
npx tsc --noEmit                  # frontend types
cd src-tauri; cargo test --lib    # Excel engine tests
```

---

## Adding a new question type

1. Add the name to `QuestionType` in `src/types.ts`.
2. Add an entry to `TYPES` in `src/lib/questionTypes.tsx` (label, group, icon, and
   which editor controls it needs).
3. Render the editing UI in `src/builder/QuestionCard.tsx` → `Body`.
4. Render the respondent UI in `src/fill/Field.tsx`, then check it in all three
   styles from the Preview screen. `form-styles.css` restyles the same markup, so
   most types need no per-style work.
5. If it needs special column naming or validation, extend `src/lib/answers.ts`
   **and** mirror it in `src-tauri/public_form.html`.

---

## Typography

**Archivo** for display, set wide (`font-stretch: 118%`) and heavy — it gives the
headings an institutional confidence without looking like a default. **Public Sans**
for body and interface text. Both are variable fonts bundled as woff2 in
`src/assets/fonts/`; nothing is fetched from Google, so the app and the shared page
both work with no internet connection.

## About the logo

`src/assets/logo.svg` and `shield.svg` were vector-traced from the `logo/images.png`
you supplied, and are drawn with `fill="currentColor"` so the same file renders in
orange on paper and in white on the orange banner. The source image is 225 px, so
the trace is as smooth as that original allows — if you have the logo as a vector
(.svg, .ai, .eps) or a large PNG, drop it in over these two files and every screen,
the installer icon and the shared page pick it up. App icons live in
`src-tauri/icons/`; regenerate them with `npm run tauri icon <path-to-png>`.

Brand orange is **#F06522**, sampled from the mark. The full ramp is at the top of
`src/styles.css`.

---

## Not built yet

Deliberately left for a later round: file-upload questions, conditional/branching
logic ("if Yes, go to section 3"), response charts and summaries, printing a blank
form to PDF, and a permanent domain with always-on hosting. Say the word and any of
these can go in next.
