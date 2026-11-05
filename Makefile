# GNU Make needs one shell executable, not "/usr/bin/env bash".
ifeq ($(OS),Windows_NT)
BASH ?= $(subst \,/,$(or $(ProgramW6432),$(PROGRAMW6432),$(ProgramFiles),$(PROGRAMFILES)))/Git/bin/bash.exe
else
BASH ?= bash
endif
SHELL := $(BASH)
.DEFAULT_GOAL := help
.NOTPARALLEL:
NODE ?= node
NPM ?= npm
ZIP ?= zip
ZIP_BIN ?= $(ZIP)
# Info-ZIP reserves ZIP for default options, so keep the legacy Make alias local.
unexport ZIP
JQ ?= jq
RELEASE_SCRIPT ?= ./release.sh
DIST_DIR ?= dist/generated
export NODE NPM ZIP_BIN JQ DIST_DIR
.PHONY: help install test test-dependencies lint check build dev pack package release release-minor release-major clean guard-dist
help: ## Show commands and publishing/version-bump distinctions
	@"$(NODE)" scripts/make-support.mjs help
install: ## Install locked JavaScript development dependencies
	"$(NPM)" ci
test: ## Run Jest serially with the repository coverage configuration
	"$(NPM)" test -- --runInBand
test-dependencies: ## Verify the maintained dependency compatibility adapters
	"$(NPM)" run test:dependencies
lint: ## Run the repository ESLint configuration
	"$(NPM)" run lint
check: lint test-dependencies test ## Run all source/dependency regression gates
build: lint test-dependencies ## Validate the source extension; no compilation is required
dev: build ## Print instructions for loading the validated unpacked extension
	@"$(NODE)" -e "console.log('Load this repository using Load unpacked at chrome://extensions/; reload after editing.')"
guard-dist:
	@"$(NODE)" scripts/make-support.mjs guard "$(DIST_DIR)"
pack: guard-dist ## Run existing release gates and ZIP the current version without a bump
	"$(BASH)" "$(RELEASE_SCRIPT)" --no-bump
package: pack ## Alias for local version-preserving packaging
release: guard-dist ## Explicit patch bump and local package; script may prompt about a git tag
	"$(BASH)" "$(RELEASE_SCRIPT)" patch
release-minor: guard-dist ## Explicit minor bump and local package
	"$(BASH)" "$(RELEASE_SCRIPT)" minor
release-major: guard-dist ## Explicit major bump and local package
	"$(BASH)" "$(RELEASE_SCRIPT)" major
clean: guard-dist ## Remove only the selected dist output and test coverage
	"$(NODE)" scripts/make-support.mjs clean "$(DIST_DIR)" coverage
