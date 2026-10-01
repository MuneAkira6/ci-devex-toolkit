# The image both arms run in: ci-devex-ioab:local.
#
# Built with `--network none`. Nothing is downloaded: pnpm is copied from this repository's own
# node_modules/pnpm (the harness puts it into the build context), so there is no corepack, no
# `npm install -g` and no tarball from the internet.
FROM node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df

# pnpm 11.28.0, invoked as `node /opt/pnpm/bin/pnpm.cjs` — no PATH shim to go wrong.
COPY pnpm /opt/pnpm
# The three timed phases, which run inside the container and print one JSON line each.
COPY phases.ts /opt/ioab/phases.ts

# pnpm aborts an offline install without a TTY unless it is told this is CI (F13).
ENV CI=true

WORKDIR /w
