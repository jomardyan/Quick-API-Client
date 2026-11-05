# GNU Make workflow

Run `make` or `make help` to list the project commands. The default only prints help; it does not install, build, publish or start a server. Use GNU Make; executable variables accept a single executable path, including spaces (put flags in the documented argument variables).

`pack`/`package` preserve the version and invoke the existing release.sh gates, then verify ZIP integrity. Explicit release aliases bump versions and may offer local git tagging; they are never part of check/build/default. Packaging requires Bash, jq and zip; NODE/NPM/JQ/ZIP_BIN are executable overrides (the legacy ZIP Make variable remains accepted without exporting Info-ZIP options). The default output is dist/generated/ to preserve the tracked historical ZIPs in dist/. DIST_DIR must remain under dist/ and must not contain tracked files. Browser package tests consume that generated ZIP.

On Windows, Bash-based Makefiles default to Git for Windows under ProgramFiles; override `BASH="C:/path/to/bash.exe"` for another installation. Other projects keep their native command dispatcher. Use `make -n TARGET` to inspect recipes before optional setup, server, package or release operations; a dry run is not evidence that those operations passed.

Generated-output cleanup validates containment and refuses tracked source or symlink/junction targets where its helper is used. No clean target is intended to remove dependency installations, merchant/user files, settings, credentials or production databases. Install explicit development dependencies before running validation. Security audit commands preserve scanner failures and may need network access.
