# Makefile for Quick API Client browser extension
# ──────────────────────────────────────────────────────────────────────────────
# Targets:
#   make install       — install npm dev dependencies
#   make test          — run the jest test suite
#   make lint          — run eslint
#   make release       — patch bump + test + zip  (default release target)
#   make release-minor — minor bump + test + zip
#   make release-major — major bump + test + zip
#   make pack          — zip without bumping version
#   make clean         — remove dist/ directory
#   make help          — show this help message
# ──────────────────────────────────────────────────────────────────────────────

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

RELEASE_SCRIPT := ./release.sh

# Ensure the release script is executable
$(RELEASE_SCRIPT):
	chmod +x $(RELEASE_SCRIPT)

.PHONY: install
install: ## Install npm development dependencies
	npm install

.PHONY: test
test: ## Run the jest test suite
	npm test

.PHONY: lint
lint: ## Run eslint across all JS files
	npm run lint

.PHONY: release
release: $(RELEASE_SCRIPT) ## Bump patch version, run tests and create zip
	$(RELEASE_SCRIPT) patch

.PHONY: release-minor
release-minor: $(RELEASE_SCRIPT) ## Bump minor version, run tests and create zip
	$(RELEASE_SCRIPT) minor

.PHONY: release-major
release-major: $(RELEASE_SCRIPT) ## Bump major version, run tests and create zip
	$(RELEASE_SCRIPT) major

.PHONY: pack
pack: $(RELEASE_SCRIPT) ## Create zip from current version without bumping
	$(RELEASE_SCRIPT) --no-bump

.PHONY: clean
clean: ## Remove the dist/ output directory
	rm -rf dist/

.PHONY: help
help: ## Show available make targets
	@echo "Quick API Client — available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
