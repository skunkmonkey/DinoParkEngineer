import { featureId, routeId, type FeatureModule, type RouteComponent } from "../../src/shell/public.ts";

export const fixtureLoadCounts = { project: 0, report: 0 };

const loadProject = async (): Promise<RouteComponent> => {
  fixtureLoadCounts.project += 1;
  return (await import("./fixture-route.ts")).FixtureRoute;
};

const loadReport = async (): Promise<RouteComponent> => {
  fixtureLoadCounts.report += 1;
  return (await import("./fixture-route.ts")).FixtureRoute;
};

export const projectFixture: FeatureModule = Object.freeze({
  id: featureId("fixture-projects"),
  routes: Object.freeze([
    Object.freeze({ id: routeId("fixture-projects-home"), path: "/fixtures/projects", load: loadProject }),
    Object.freeze({ id: routeId("fixture-project-detail"), parentId: routeId("fixture-projects-home"), path: "/fixtures/projects/:projectId", load: loadProject }),
  ]),
});

export const reportFixture: FeatureModule = Object.freeze({
  id: featureId("fixture-reports"),
  routes: Object.freeze([
    Object.freeze({ id: routeId("fixture-report"), path: "/fixtures/reports/*rest", load: loadReport }),
  ]),
});
