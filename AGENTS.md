# AGENTS.md

This file provides guidance for working with the react-tz-globepicker project.

## Project Overview

**react-tz-globepicker** is an interactive 3D globe component for timezone selection in React. It is framework-agnostic, uses bundled geodata, and supports advanced visualization modes.

## Features
- Interactive 3D globe visualization (drag, zoom)
- Clickable timezone markers with tooltips
- Animated fly-to transitions
- Multiple boundary modes (nautic, iso8601, iana)
- Bundled timezone and country data
- No UI framework dependencies (pure React)

## Development Workflow

```bash
pnpm install           # Install dependencies
pnpm dev               # Start demo server (http://localhost:3000)
pnpm build             # Build package
pnpm lint              # Run ESLint
pnpm type-check        # TypeScript validation
pnpm format            # Format code
pnpm gen:globe         # Update globe data from sources
```

## Demo
- Demo app is in `demo/` (Vite + React)
- Components for demo UI are in `demo/src/components/`

## Data Sources
- [Natural Earth 10m Time Zones](https://github.com/nvkelso/natural-earth-vector): authoritative timezone boundaries
- [visionscarto-world-atlas](https://github.com/visionscarto/world-atlas): simplified world country boundaries
- Data is processed by `scripts/update-globe-data.ts` and bundled in `src/data/globe-data.json`

## Directory Structure
- `src/components/TzGlobePicker/` — main globe component and helpers
- `src/components/TzGlobePreloader/` — preloader component
- `src/utils/` — timezone utilities, marker builders, coordinate maps
- `src/data/` — bundled geodata
- `demo/` — demo app

## Export Surface
- Main: `TzGlobePicker`, `TzGlobePreloader`
- Types: `TzGlobePickerProps`, `TzBoundaryMode`, `GlobeState`, `MarkerEntry`, etc.
- Constants: `COLORS`, `TILT`, `GRATICULE_STEP`, `MAX_BOUNDARY_AREA`, ...
- Utils: `buildMarkerList`, `CANONICAL_MARKERS`, `TIMEZONE_COORDINATES`, `getUtcOffsetMinutes`, ...

## Coding Standards
- **Explicit return types required** on all functions
- Validate all inputs with Zod schemas (demo only)
- Avoid type casts unless necessary
- Use component-local CSS and standard React `style`/`className` patterns
- Keep demo and library styling framework-agnostic
- Prefer reusable class names for shared styles, inline styles for one-off examples

## Commit Guidelines
- Group by feature/domain
- Lowercase semantic messages: `feat(globe): add marker`, `fix(data): update boundaries`
- Do not combine unrelated changes
- Stage and commit each group separately

## Post-Task Process
- Run `pnpm lint` and `pnpm type-check` after any change
- Run `pnpm build` if config or critical files changed

## Contact
- Maintainer: Marcio Merlone (<mmerlone@gmail.com>)


