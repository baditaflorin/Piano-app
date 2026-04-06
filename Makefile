# Piano Pro Makefile
# Simplifies common development tasks

.PHONY: help serve clean

help:
	@echo "Piano Pro Development Commands:"
	@echo "  make serve    - Start the local development server (port 3000)"
	@echo "  make clean    - Currently no-op (placeholder for future build steps)"
	@echo "  make help     - Show this help message"

serve:
	@echo "Starting Paul's Piano server on http://localhost:3000/piano.html..."
	npx -y serve . -l 3000

clean:
	@echo "No temporary files to clean."
