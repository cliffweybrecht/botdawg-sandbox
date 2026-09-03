# Overlap

A fully client-side meeting timezone overlap planner. Add people, their IANA timezones, and working hours; Overlap plots a shared day, highlights the overlapping window, and lets you pick a 30 / 45 / 60 minute slot. Proposed times are shown in UTC and in each person's local zone, ready to copy as plain text or GFM markdown.

This exists so a distributed group can answer when everyone is actually at work on a given date without a calendar product, accounts, or a server. DST transitions are detected and called out (for example America/Denver spring-forward / fall-back).

**This is a local demo and should not be deployed as part of this exercise.**

## Local setup

Requires Node.js 18+ (20+ recommended).


    npm install

## Run

    npm run dev

Open the URL Vite prints (typically http://localhost:5173).

    npm run build
    npm run preview

## Test

    npm test

Vitest covers overlap math, DST edge cases, URL hash encode/decode, and slot/duration selection.

## State

- People and hours persist in localStorage (key overlap.v1).
- The same snapshot is written to the URL hash so a copied link restores the session with no backend.
- Invalid IANA zones, empty grids, no overlap that day, and DST-transition dates have explicit UI states.

## Stack

Vite + TypeScript + HTML/CSS (vanilla, no React). Timezone math uses Intl (and Temporal.ZonedDateTime when the runtime provides it).
