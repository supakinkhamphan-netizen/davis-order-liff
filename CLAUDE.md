# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The LIFF frontend for the Davis multi-zone order system — a single ~70KB `index.html` (no build step, no framework, no dependencies beyond the LINE LIFF SDK). It is the runner-facing screen: order board, claim/deliver actions, inline fulfil forms, and the manager dashboard.

It is one half of a two-repo system:

| Part | Repo | Deploy |
|---|---|---|
| Frontend LIFF page (this repo) | `davis-order-liff` | `git push` → GitHub Pages build |
| Backend (Apps Script) | `davis-order-bot` (`~/davis-order-bot`) | `clasp push` → `clasp deploy` |

## `git push` is not a release

Pushing here only starts a **GitHub Pages build**. The change is live when that build finishes and GitHub's CDN stops serving the cached copy — several minutes, sometimes longer. A page that looks unchanged right after a push is normal; check the raw file content on the `main` branch through the GitHub API before assuming the deploy failed.

The backend half is worse: `clasp push` alone changes **nothing** users can see, because the production deployment is pinned to a numbered version. Only `clasp deploy` releases it. A frontend change that depends on a new backend endpoint therefore needs both halves shipped, in that order — backend first.

## How it talks to the backend

Every call is a POST to the Apps Script web app, whose production URL is **hardcoded in this file** (`AKfycbw67bRdK_Ff-…`, around line 202). Requests carry a LIFF ID token or access token; the backend (`order-liff-api.js`) verifies it and refuses anything it cannot attribute to a registered staff member. There is no public/unauthenticated path — the board shows room numbers and money.

The board polls every 10 seconds. The poll pauses while an inline form is open, so anything that leaves `openForms` non-empty by mistake freezes the whole screen (this has happened — see the comment above `formBodyHtml`).

## Conventions

- Thai first. Never use colour as the only carrier of meaning — this is read one-handed, on old phones, in a dark shop, at 1am.
- Payment options must stay in step with the three Apps Script forms in the backend repo (`order-request-form.html`, `order-food-form.html`, `order-fulfill-form.html`). This file is the one that gets forgotten.
- `index.html1` is an old local backup, gitignored, not served.
