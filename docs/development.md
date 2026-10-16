# Development and deployment

## Local development

Use Node.js 24, matching Vercel. Run commands from the repository root:

```sh
npm run setup
npm run dev
```

In another terminal:

```sh
npm run dev:ui
```

The API listens on `http://localhost:7700`. Vite prints its frontend URL and proxies API, catalog preview, and configured manifest requests to that API. The backend uses Node's built-in watch mode.

| Command             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run setup`     | Install both lockfiles                    |
| `npm test`          | Run isolated regression tests             |
| `npm run typecheck` | Check frontend scripts and templates      |
| `npm run build`     | Typecheck and build the frontend          |
| `npm run format`    | Format supported source/config/docs files |
| `npm run check`     | Check formatting, run tests, build        |
| `npm start`         | Serve the built frontend and addon API    |

Install both packages before running tests: frontend state tests import Vue. Tests mock external calls and never load `.env` credentials or contact real accounts.

## Configuration

- `PORT` defaults to `7700` for the Node server.
- Set server environment variables in your shell or Vercel. The backend does not load `.env` files.
- Optional `VITE_APP_URL` sets the base URL used for install links at build time. Otherwise the UI uses its current origin.
- Do not put Redis or provider credentials in frontend environment variables. Each user supplies their own credentials through the interface.

## Vercel

Use the repository root, framework preset **Other**, and Node.js **24.x**. `vercel.json` installs the backend lockfile, installs the frontend lockfile before testing, runs tests, and builds Vue. Addon/API requests route to `api/index.js`, with the built configuration page included in the function. Private responses use `private, no-store` and `no-referrer`.

Imports advance in bounded steps within a 60-second function budget. Hosting-plan limits still apply. Back up the user's Redis before a deployment that changes persistence behavior; this repository's tests never modify real Redis data.

Keep source changes in GitHub as well as Vercel. A direct source upload to Vercel does not commit or push local changes to the linked repository.

## Local production build

Run `npm run build` before `npm start` to serve the built interface and addon API together on port 7700. The local entry point supports development and verification; production hosting uses Vercel's `api/index.js` entry point.

## Automation

The GitHub Actions CI workflow runs `npm run setup` and `npm run check` on pushes and pull requests. It needs no deployment credentials or external database. Formatting rules are shared through Prettier and EditorConfig; generated output and local review files are ignored.
