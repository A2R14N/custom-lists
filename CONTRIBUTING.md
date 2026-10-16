# Contributing

Use Node.js 24 and npm. Install both packages from the repository root:

```sh
npm run setup
```

Run `npm run dev` for the API and `npm run dev:ui` in a second terminal for the interface. The Vite server proxies API requests to port 7700.

Before submitting a change:

```sh
npm run format
npm run check
```

The check runs formatting validation, the isolated regression suite, TypeScript checking, and the frontend build. Tests use synthetic data and mocked network calls; no real Redis credentials are needed. Keep environment files, install URLs, logs, and local review output out of commits.

Keep changes focused. Add behavior tests for fixes involving parsing, imports, cache isolation, or state transitions. See [the architecture notes](docs/architecture.md) for module boundaries and compatibility rules.
