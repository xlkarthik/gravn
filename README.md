# Gravn

Gym management and fitness tracking: owners run their gym, trainers coach assigned clients,
members log workouts, and anyone can train on their own. Android and web come first; iOS follows
(see DECISIONS.md, D-40).

| Path              | What                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| `apps/mobile`     | Expo (SDK 58) app for members, trainers and owners                                    |
| `apps/web`        | Next.js 16 owner dashboard, platform admin, invitation and auth pages                 |
| `packages/shared` | Types, zod schemas, API calls, roles, i18n strings, design tokens (used by both apps) |
| `supabase`        | Migrations, seed, pgTAP permission tests, auth email templates                        |
| `plan`            | The build plan. Start with `plan/README.md`                                           |

Where things stand: [STATUS.md](STATUS.md). Why things are the way they are: [DECISIONS.md](DECISIONS.md).

## Set up on Windows

1. **Install:** Node.js 24, Git, [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   (WSL2 backend; start it once), and pnpm: `npm install -g pnpm@12.14.0`.
2. **Dependencies:** `pnpm install` in the repo root.
3. **Database:** `pnpm db:start`. The first run pulls about ten images. It prints the API URL,
   the Publishable key and the Mailpit URL (where local auth emails arrive).
4. **Env files:** copy `apps/web/.env.example` to `apps/web/.env.local` and
   `apps/mobile/.env.example` to `apps/mobile/.env.local`, and paste in the Publishable key.
5. **Check:** `pnpm db:reset` (migrations + seed), then `pnpm db:test`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

### Web

`pnpm dev:web`, then open http://localhost:3000. End-to-end smoke test: `pnpm db:reset`, then
`pnpm --filter @gravn/web exec playwright install chromium` (once), then `pnpm --filter @gravn/web test:e2e`.

### Android

The app uses a development build, not Expo Go.

- **Build the dev client**, either way:
  - Cloud: `npx eas-cli@latest login`, then `npx eas-cli@latest build --profile development --platform android`,
    then install the APK from the link on the phone.
  - Local: install Android Studio (it brings the SDK, an emulator and a JDK), then `pnpm --filter @gravn/mobile android`.
- **Reach local Supabase from the phone:** in `apps/mobile/.env.local`, use the PC's LAN IP
  (`ipconfig`, IPv4 Address) instead of 127.0.0.1, and allow ports 54321 and 3000 through Windows
  Firewall (admin PowerShell):
  `New-NetFirewallRule -DisplayName "Gravn dev" -Direction Inbound -Protocol TCP -LocalPort 54321,3000 -Action Allow -Profile Private`
- **Run:** `pnpm dev:mobile` and open the dev build on the phone.

## Seed accounts (local only)

Every password is `password123`.

| Email                                                         | Who                                      |
| ------------------------------------------------------------- | ---------------------------------------- |
| `owner.a@example.test`, `owner.b@example.test`                | Owners of Gym A and Gym B                |
| `trainer.a1@` … `trainer.b2@example.test`                     | Two trainers per gym                     |
| `member.a1@` … `member.b5@example.test`                       | Five members per gym                     |
| `dual@example.test`                                           | Member in Gym A **and** trainer in Gym B |
| `former.a@example.test`                                       | Archived (removed) Gym A member          |
| `coach@example.test`, `client.c1@` … `client.c3@example.test` | Independent coach and clients            |
| `solo@example.test`                                           | Trains alone, no gym                     |
| `admin@example.test`                                          | Platform admin (web `/admin`)            |

A seeded invitation for `new.member@example.test` opens at `/invite/seed-invite-gym-a`.

## Scripts

| Command                                      | Does                                           |
| -------------------------------------------- | ---------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | All packages                                   |
| `pnpm db:start` / `pnpm db:stop`             | Local Supabase in Docker                       |
| `pnpm db:reset`                              | Re-run migrations and seed                     |
| `pnpm db:test`                               | pgTAP permission tests (`supabase/tests`)      |
| `pnpm gen:types`                             | Generate database types into `packages/shared` |
| `pnpm format`                                | Prettier                                       |
