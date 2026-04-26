.DEFAULT_GOAL := help

ENV ?= dev
APP_PATH ?= /opt/app
SSH_HOST ?= $(DO_HOST)
SSH_USER ?= $(DO_SSH_USER)
SSH_PORT ?= $(DO_SSH_PORT)
APP_STACK_NAME ?= admin-dashboard-dev
POSTGRES_STACK_NAME ?= postgres-local
POSTGRES_CONTAINER_NAME ?= postgres-local
POSTGRES_VOLUME_NAME ?= postgres-local
POSTGRES_NETWORK_NAME ?= postgres-local
STACK_RUNTIME_ROOT ?= ../.docker/$(APP_STACK_NAME)
POSTGRES_HOST_PORT ?= 5432
COMPOSE_DEV := deploy/docker-compose.dev.yml
COMPOSE_AI := deploy/docker-compose.channel-adapter.yml
COMPOSE_AI_PLATFORM := ai-platform/docker-compose.yml
COMPOSE_POSTGRES_LOCAL := deploy/docker-compose.postgres-local.yml
COMPOSE_TESTING := deploy/docker-compose.testing.yml
COMPOSE_PROD := deploy/docker-compose.prod.yml
DEV_STACK_ENV := APP_STACK_NAME=$(APP_STACK_NAME) STACK_RUNTIME_ROOT=$(STACK_RUNTIME_ROOT) POSTGRES_NETWORK_NAME=$(POSTGRES_NETWORK_NAME)
POSTGRES_STACK_ENV := POSTGRES_STACK_NAME=$(POSTGRES_STACK_NAME) POSTGRES_CONTAINER_NAME=$(POSTGRES_CONTAINER_NAME) POSTGRES_VOLUME_NAME=$(POSTGRES_VOLUME_NAME) POSTGRES_NETWORK_NAME=$(POSTGRES_NETWORK_NAME) POSTGRES_HOST_PORT=$(POSTGRES_HOST_PORT)

## Show available make targets
help:
	@grep -E '^[a-zA-Z_-]+:.*?##' Makefile | sed 's/:.*##/: /'

## Prepare local bind mounts for the canonical dev stack
prepare-dev-stack:
	APP_STACK_NAME=$(APP_STACK_NAME) sh scripts/prepare-dev-stack.sh

## Ensure the external local PostgreSQL stack is available as postgres-local
postgres-up:
	$(POSTGRES_STACK_ENV) sh scripts/ensure-postgres-local.sh

## Stop the external local PostgreSQL stack
postgres-down:
	$(POSTGRES_STACK_ENV) docker compose -f $(COMPOSE_POSTGRES_LOCAL) down

## Start the canonical ai-platform stack
ai-platform-up:
	docker compose -f $(COMPOSE_AI_PLATFORM) up -d --build

## Stop the canonical ai-platform stack
ai-platform-down:
	docker compose -f $(COMPOSE_AI_PLATFORM) down

## Follow logs from the canonical ai-platform stack
ai-platform-logs:
	docker compose -f $(COMPOSE_AI_PLATFORM) logs -f

## Start local development stack with live reloaders
dev-up: ai-platform-up prepare-dev-stack postgres-up
	$(DEV_STACK_ENV) docker compose -f $(COMPOSE_DEV) -f $(COMPOSE_AI) --profile ai up -d --build

## Render the canonical local development stack config
dev-config:
	$(DEV_STACK_ENV) docker compose -f $(COMPOSE_DEV) -f $(COMPOSE_AI) --profile ai config

## Stop local development stack
dev-down:
	$(DEV_STACK_ENV) docker compose -f $(COMPOSE_DEV) -f $(COMPOSE_AI) --profile ai down

## Follow logs from the local stack
dev-logs:
	$(DEV_STACK_ENV) docker compose -f $(COMPOSE_DEV) -f $(COMPOSE_AI) --profile ai logs -f

## Validate that all env files include required keys
env-check:
	node scripts/check-env.mjs

## Run testing stack locally (requires env files)
testing-up:
	docker compose -f $(COMPOSE_TESTING) up -d --build

## Tear down testing stack
testing-down:
	docker compose -f $(COMPOSE_TESTING) down

## Run production stack locally (requires env files)
prod-up:
	docker compose -f $(COMPOSE_PROD) up -d --build

## Tear down production stack
prod-down:
	docker compose -f $(COMPOSE_PROD) down

## Generate a compressed backup of the PostgreSQL database using docker compose
backup:
	@if [ ! -f deploy/docker-compose.$(ENV).yml ]; then \
		if [ "$(ENV)" != "dev" ]; then echo "Unknown environment $(ENV)." && exit 1; fi; \
	fi
	mkdir -p backups
	@if [ "$(ENV)" = "dev" ]; then \
		$(POSTGRES_STACK_ENV) docker compose -f $(COMPOSE_POSTGRES_LOCAL) exec -T db pg_dump -U $$POSTGRES_USER $$POSTGRES_DB | gzip > backups/`date +%Y%m%d%H%M%S`_$(ENV).sql.gz; \
	else \
		docker compose -f deploy/docker-compose.$(ENV).yml exec -T db pg_dump -U $$POSTGRES_USER $$POSTGRES_DB | gzip > backups/`date +%Y%m%d%H%M%S`_$(ENV).sql.gz; \
	fi

## Rollback the remote deployment to the previous release. Provide SSH_HOST, SSH_USER, SSH_PORT via env vars or make vars.
rollback:
	@if [ -z "$(SSH_HOST)" ] || [ -z "$(SSH_USER)" ]; then \
		echo "SSH_HOST and SSH_USER are required"; exit 1; \
	fi
	ssh -p $(SSH_PORT) $(SSH_USER)@$(SSH_HOST) "set -e; PREVIOUS=\$$(readlink -f $(APP_PATH)/previous || true); if [ -z \"\$${PREVIOUS}\" ]; then echo 'No previous release found'; exit 1; fi; ln -sfn \$${PREVIOUS} $(APP_PATH)/current; cd $(APP_PATH)/current/deploy; docker compose -f docker-compose.$(ENV).yml up -d --remove-orphans"
