# Workspace Hub

A personal productivity progressive web app — dashboard, scheduler, task manager,
timer/pomodoro, reading tracker, journal, habits, analytics, and a local-LLM AI
assistant, all running client-side with no backend.

## Cross-device sync (TinyBase + PartyKit)

Workspace Hub can sync your data across devices using TinyBase (CRDT data store)
and PartyKit (real-time sync server).

### 1. Install dependencies

```
npm install
```

### 2. Build TinyBase IIFE bundles

```
npm run build:tinybase
```

This generates browser-ready bundles in `WorkspaceShared/`.

### 3. Deploy the PartyKit sync server

Create a PartyKit project and deploy `partykit/server.js`:

```
npm run sync:dev   # local dev server on port 1999
partykit deploy    # deploy to PartyKit cloud
```

Set your PartyKit URL and room in the browser console or config:

```javascript
window.PARTYKIT_URL = 'your-project.partykit.dev';
window.PARTYKIT_ROOM = 'workspace-hub-sync';
```

### 4. Run locally

```
python -m http.server 8000
# or
npm run lint:css
```

## Before deploying

Run the CSS linter once to catch duplicate/conflicting rules before zipping up
a new version (this is what caught the sidebar-menu bug):

```
npm install
npm run lint:css
```

No build step otherwise — edit the files directly and deploy as usual.
