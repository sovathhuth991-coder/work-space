# Workspace Hub

A personal productivity progressive web app — dashboard, scheduler, task manager,
timer/pomodoro, reading tracker, journal, habits, analytics, and a local-LLM AI
assistant, all running client-side with no backend.

## Before deploying

Run the CSS linter once to catch duplicate/conflicting rules before zipping up
a new version (this is what caught the sidebar-menu bug):

```
npm install
npm run lint:css
```

No build step otherwise — edit the files directly and deploy as usual.
