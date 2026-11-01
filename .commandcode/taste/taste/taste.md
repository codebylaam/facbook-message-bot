# Taste

- Prefers React 19 with the React Compiler enabled. Confidence: 0.85
- Uses Astryx as the design system and explicitly avoids Tailwind. Confidence: 0.85
- Every form should use TanStack Form with its form-context architecture (not ad-hoc form state). Confidence: 0.85
- Uses TanStack Query for data fetching (with axios only when needed). Confidence: 0.8
- Expects standard React patterns/conventions to be followed before writing any component. Confidence: 0.8
- Backend stack: Hono + Postgres, always run with Bun. Confidence: 0.85
- Wants Bun JS used consistently rather than Node/npm tooling. Confidence: 0.8
- Local/dev containers via Podman and podman-compose; quadlet is intended later for VPS deployment. Confidence: 0.8
- Wants a proper, explicit step-by-step plan before implementation work. Confidence: 0.85
- Prefers the plan persisted in a `Plan.md` file in the repo rather than only in chat. Confidence: 0.8
- Executes a plan incrementally, delegating it phase-by-phase (e.g. "implement phase 1") rather than requesting the whole plan in one go. Confidence: 0.6
- When a clarifying question was declined or misunderstood, asks for it to be re-explained plainly. Confidence: 0.5
- Works in Bangla, Banglish, and English — expects the product/content to support all three. Confidence: 0.6
