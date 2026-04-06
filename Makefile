NODE = $(HOME)/.nvm/versions/node/v20.20.2/bin/node
NPX  = $(HOME)/.nvm/versions/node/v20.20.2/bin/npx

.PHONY: build serve clean

build:
	$(NPX) esbuild src/app.ts \
		--bundle \
		--format=esm \
		--outfile=dist/app.js \
		--sourcemap \
		--platform=browser \
		--target=es2020

serve: build
	@echo "Starting Paul's Piano at http://localhost:3000/piano.html"
	$(NPX) serve . -l 3000

watch:
	$(NPX) esbuild src/app.ts \
		--bundle \
		--format=esm \
		--outfile=dist/app.js \
		--sourcemap \
		--platform=browser \
		--target=es2020 \
		--watch

clean:
	rm -rf dist/

help:
	@echo "make build  - compile TypeScript"
	@echo "make serve  - build and start server"
	@echo "make watch  - watch and rebuild on changes"
	@echo "make clean  - remove dist/"
