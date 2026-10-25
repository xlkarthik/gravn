# Working on Gravn

Start each session by reading `plan/README.md`, the current part file in `plan/`, and `STATUS.md`,
then continue with the next unchecked item.

- **KISS and DRY.** Prefer the smallest design that works. Shared logic goes in `packages/shared`
  (API calls, schemas, roles, strings, tokens); don't duplicate it per app.
- **Android and web first; iOS later** (DECISIONS.md, D-40).
- **Authorization lives in the database** (RLS and RPCs in `supabase/migrations`). Every new table
  gets RLS, explicit grants and a pgTAP test. Every new function revokes its default EXECUTE grant.
- **Strings** go through `packages/shared/src/locales/en.json`. **Colours and spacing** come from
  `packages/shared/src/tokens.ts`.
- Add Expo native modules with `pnpm exec expo install` (run from `apps/mobile`).
- Never invent test results. Record what ran in `STATUS.md` and assumptions in `DECISIONS.md`.
- No paid resources, store publishing, production deploys or destructive migrations without the
  founder's go-ahead.
