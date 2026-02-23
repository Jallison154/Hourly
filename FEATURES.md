# Hourly — Features Overview

## Where We Started

The app began as a time-tracking PWA with:

- **Auth** — Login and register; JWT-based sessions
- **Clock in/out** — Start/stop the clock with optional manual time
- **Time entries** — Add and edit entries manually; view on a timesheet
- **Breaks** — Basic break tracking (lunch, rest, other) on entries
- **Pay periods** — Monthly pay period (e.g. 11th–10th) and weekly breakdowns
- **Timesheet** — List of entries by pay period
- **Paycheck calculator** — Gross/net and tax estimates
- **Dashboard** — Metrics (hours, pay, charts)
- **Profile** — Name, hourly rate, pay period settings
- **Multi-user** — Each user has their own entries and settings
- **PWA** — Installable on mobile; basic responsive layout

So at the start you had: clock in/out, manual entries, breaks, timesheet, paycheck estimate, dashboard, and profile — with room to grow.

---

## Current Features

### Authentication & Account

- **Login / Register** — Email + password; email normalized (lowercase, trim)
- **Profile** — Name, photo, hourly rate, overtime rate, time rounding (5/10/15/30 min), pay period type (weekly/monthly), pay period end day, paycheck adjustment, **filing status (single/married)**, state, state tax rate, change password
- **Tax settings** — Federal and Montana state tax with standard deductions and progressive brackets; display reflects filing status
- **Export data** — Download time entries as CSV (re-importable “Hours Keeper” style)
- **Import data** — Import CSV (Hours Keeper format); duplicate detection
- **Pull-to-refresh** — On Dashboard, Clock, Timesheet, Profile, Import

### Clock & Time Entries

- **Clock in / Clock out** — With optional custom time; rounding (configurable) applied
- **Break on clock-out** — Prompt: 15 min, 30 min, 1 hr, or custom; stored on the entry
- **Manual entries** — Add from Clock or Timesheet; overlap checks
- **Edit entries** — From Timesheet (and from Paycheck week modal): change clock in/out, notes
- **Break management** — Add, edit, delete breaks on any entry (Timesheet edit)
- **Active timer** — When clocked in: live elapsed time, current earnings, hours left to 40 (updates in real time; goes negative for overtime)
- **Manual entry section** — Hidden while clocked in for a cleaner Clock page
- **Weekly summary (Clock page)** — This week: hours worked, overtime, hours left to 40, days worked, days in a row, days until pay period end

### Timesheet

- **Single Timesheet page** — Combines old Timesheet + Paycheck into one view
- **Pay period selector** — Choose pay period; entries and weeks for that period
- **Weekly breakdown** — Each week shows entries, hours, and pay (regular + OT)
- **Pay summary** — Gross, net, federal tax, state tax (MT progressive), FICA (Social Security + Medicare) for the period
- **Week detail modal** — Click a week to see full breakdown and **edit entries** (same as Timesheet)
- **Actions menu (⋮)** — Add Entry, Copy as Text, Email, link to Schedule
- **Copy as Text** — Plain summary: pay period range, total hours, then weekly totals (e.g. “Nov 11–15: 43:55”)
- **Email** — Opens mailto with that text and subject based on pay period

### Pay & Taxes

- **Pay period logic** — Weekly (Sun–Sat) or monthly (e.g. 11th–10th); only hours inside the period count
- **Overtime** — 1.5× after 40 hours per week; weekly boundaries respected within pay period
- **Federal tax** — 2024 brackets + standard deduction (single / married)
- **Montana state tax** — Progressive (4.7% / 5.9%) + state standard deduction; filing status
- **FICA** — Social Security + Medicare; separate display where used
- **Filing status** — Single vs married; affects federal and MT deductions and brackets

### Schedule (Standalone)

- **Weekly schedule page** — Not tied to profile or dashboard
- **Per-day hours** — Enter estimated hours per day (Mon–Sun) in **HH:MM** (e.g. 5:55 = 5h 55m)
- **Totals** — Total weekly hours; estimated weekly/monthly pay if hourly rate set
- **Link** — From Timesheet dropdown (⋮) → Schedule

### Admin Dashboard (Separate from User Accounts)

- **Password-protected** — Single admin password (e.g. in `.env`); no user login
- **Route** — `/admin`; separate from app nav
- **Team overview** — “This week” (Sun–Sat): team size, how many clocked in, total team hours
- **Per-user** — Name, email, **clocked in?**, **current week hours**, **hours left to 40** (or “-X OT”)
- **Auto-refresh** — Data refreshes every 15 seconds; pull-to-refresh still works
- **Layout** — Styled like the Clock page (cards, summary, list)
- **CORS** — Backend allows `X-Admin-Token` header for admin API

### Navigation & Layout

- **Main tabs** — Dashboard, Clock (center), Timesheet (+ bottom nav on mobile)
- **Profile** — User photo/avatar in **top-right** (web nav); also from Dashboard
- **Clock page** — No logo on mobile; clock in/out and timer grouped clearly
- **Mobile** — Bottom nav; icons centered; pull-to-refresh on main pages

### Data & Backend

- **Database** — SQLite (e.g. `file:./prisma/dev.db`); relative path so it doesn’t reset on deploy
- **Schema updates** — Install/setup scripts add new columns when needed and preserve data (e.g. `filingStatus`, `weeklySchedule`)
- **Validation** — Profile and entries accept empty strings where appropriate (e.g. profile image, state, notes) and normalize to null
- **Export CSV** — Compatible with import format (Hours Keeper style)

### Technical Notes

- **Frontend** — React, TypeScript, Vite, Tailwind, Framer Motion, Heroicons
- **Backend** — Node, Express, Prisma, SQLite (or PostgreSQL if configured)
- **Auth** — JWT; `authenticate` middleware for user routes; admin uses `ADMIN_PASSWORD` + `X-Admin-Token` header

---

## Summary

**At the start:** Clock in/out, manual entries, breaks, timesheet, paycheck estimate, dashboard, profile, multi-user, PWA.

**Now:** All of that plus: filing status and accurate federal/MT taxes, break-on-clock-out and break editing, live “hours left” and timer, combined Timesheet + pay summary, week modal with editable entries, copy/email timesheet, HH:MM weekly schedule, password-protected admin dashboard with team hours and clock status, profile in nav, pull-to-refresh, export/import, and data-preserving install/database setup.
