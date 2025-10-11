.DEFAULT_GOAL := help

ENV ?= dev
APP_PATH ?= /opt/app
SSH_HOST ?= $(DO_HOST)
SSH_USER ?= $(DO_SSH_USER)
SSH_PORT ?= $(DO_SSH_PORT)
COMPOSE_DEV := deploy/docker-compose.dev.yml
COMPOSE_TESTING := deploy/docker-compose.testing.yml
COMPOSE_PROD := deploy/docker-compose.prod.yml

## Show available make targets
help:
	@grep -E '^[a-zA-Z_-]+:.*?##' Makefile | sed 's/:.*##/: /'

## Start local development stack with live reloaders
dev-up:
	docker compose -f $(COMPOSE_DEV) up -d --build

## Stop local development stack
dev-down:
	docker compose -f $(COMPOSE_DEV) down

## Follow logs from the local stack
dev-logs:
	docker compose -f $(COMPOSE_DEV) logs -f

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
		echo "Unknown environment $(ENV)." && exit 1; \
	fi
	mkdir -p backups
	docker compose -f deploy/docker-compose.$(ENV).yml exec -T db pg_dump -U $$POSTGRES_USER $$POSTGRES_DB | gzip > backups/`date +%Y%m%d%H%M%S`_$(ENV).sql.gz

## Rollback the remote deployment to the previous release. Provide SSH_HOST, SSH_USER, SSH_PORT via env vars or make vars.
rollback:
	@if [ -z "$(SSH_HOST)" ] || [ -z "$(SSH_USER)" ]; then \
		echo "SSH_HOST and SSH_USER are required"; exit 1; \
	fi
	ssh -p $(SSH_PORT) $(SSH_USER)@$(SSH_HOST) "set -e; PREVIOUS=\$$(readlink -f $(APP_PATH)/previous || true); if [ -z \"\$${PREVIOUS}\" ]; then echo 'No previous release found'; exit 1; fi; ln -sfn \$${PREVIOUS} $(APP_PATH)/current; cd $(APP_PATH)/current/deploy; docker compose -f docker-compose.$(ENV).yml up -d --remove-orphans"
