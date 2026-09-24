# YADRA-THE-TWO-SAIYANS

`index.html` is a GENERATED file. Edit `dev/game-template.html` (and `dev/combat-core.js`), then run:

    node dev/build.js

## Check that index.html matches the source

    node dev/check-build.js

## After cloning: turn on the pre-commit hook

    git config core.hooksPath .githooks

The hook runs `node dev/check-build.js` and stops the commit if `index.html` is out of sync.
It can be skipped with `--no-verify`, so GitHub Actions (`.github/workflows/check-build.yml`)
runs the same check on every push and pull request.
