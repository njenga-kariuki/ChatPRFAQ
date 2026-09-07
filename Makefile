.PHONY: setup dev dev-fake api web test build fixture types evals live-check docker

PY := backend/.venv/bin/python

setup:           ## install backend and frontend dependencies
	cd backend && uv venv -q .venv && VIRTUAL_ENV=.venv uv pip install -q -e ".[dev]"
	cd web && npm install

api:             ## backend on :8000 (reads backend/.env)
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

api-fake:        ## backend on :8000 with the offline provider, streaming at a human pace
	cd backend && LLM_PROVIDER=fake FAKE_STREAM_DELAY_S=0.02 .venv/bin/uvicorn app.main:app --reload --port 8000

web:             ## frontend dev server on :5173 (proxies /api to :8000)
	cd web && npm run dev

dev:             ## backend + frontend for local development
	$(MAKE) -j2 api web

dev-fake:        ## same, with the offline provider
	$(MAKE) -j2 api-fake web

test:            ## backend tests + frontend typecheck, unit tests and build
	cd backend && .venv/bin/python -m pytest -q
	cd web && npm run typecheck && npm test -- --run && npm run build

build:           ## production build of the frontend (served by the backend from web/dist)
	cd web && npm run build

types:           ## regenerate the OpenAPI document and the frontend types
	cd backend && .venv/bin/python scripts/export_openapi.py ../web/openapi.json
	cd web && npm run gen:types

fixture:         ## re-record the fake run used by tests and the demo route
	cd backend && .venv/bin/python scripts/make_fixture.py ../web/fixtures

evals:           ## run the seed ideas through the council and grade them (uses the configured provider)
	cd backend && .venv/bin/python -m app.evals.run_evals --out evals/results.json

live-check:      ## one cheap live request to validate the API key and request shape
	cd backend && .venv/bin/python scripts/live_check.py

docker:          ## build and run the single-image deployment
	docker build -f deploy/Dockerfile -t chatprfaq .
	docker run --rm -p 8000:8000 -e ANTHROPIC_API_KEY -e LLM_PROVIDER chatprfaq
