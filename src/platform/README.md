# Platform Foundation public integration

Downstream features import only from `src/platform/public.ts` and the
Application Shell public entry point. Foundation is discovered automatically;
no central shell import list is edited.

Use `createFramedRouteRegistration` for product routes. Its shell-facing lazy
loader resolves the persistent Product Frame first, then loads feature content
inside the frame. Content load and render failures therefore keep primary
navigation, global controls, notifications, preferences, and recovery actions
available.

```ts
const route = createFramedRouteRegistration({
  id: "engineering-skill-detail",
  path: "/engineering/skills/:id",
  title: "Skill detail",
  destinationId: "engineering",
  load: () => import("./SkillDetail.tsx").then((module) => module.SkillDetail),
});
```

Features may connect simulation controls through `PresentationRegistry` using
the exported `SimulationControlPort`. The port owns authoritative confirmed
state; Platform Foundation only requests changes and renders the result.
