"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import type { RouteComponent, ShellRouteProps } from "../shell/public.ts";
import { ErrorState, Panel } from "../ui/components.tsx";
import { ProductFrame } from "./ProductFrame.tsx";
import { resolveFramedRouteContent } from "./framedRouteModel.ts";
import type { PrimaryDestination } from "./types.ts";

interface RenderBoundaryProps {
  readonly children: ReactNode;
  readonly onRetry: () => void;
  readonly onPark: () => void;
}

interface RenderBoundaryState {
  readonly failed: boolean;
}

class FeatureRenderBoundary extends Component<RenderBoundaryProps, RenderBoundaryState> {
  state: RenderBoundaryState = { failed: false };

  static getDerivedStateFromError(): RenderBoundaryState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorState
        title="Feature rendering failed"
        summary="The destination encountered an error. Navigation and global controls remain available."
        action={<RecoveryActions onRetry={this.props.onRetry} onPark={this.props.onPark} />}
      />
    );
  }
}

function RecoveryActions({ onRetry, onPark }: { readonly onRetry: () => void; readonly onPark: () => void }) {
  return (
    <div className="foundation-actions">
      <button type="button" className="foundation-button" onClick={onRetry}>Try again</button>
      <button type="button" className="foundation-button foundation-button--secondary" onClick={onPark}>Return to Park</button>
    </div>
  );
}

function FramedFeatureRoute({
  destinationId,
  loadContent,
  routeProps,
}: {
  readonly destinationId: PrimaryDestination;
  readonly loadContent: () => Promise<RouteComponent>;
  readonly routeProps: ShellRouteProps;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof resolveFramedRouteContent>> | null>(null);

  useEffect(() => {
    let active = true;
    void resolveFramedRouteContent(loadContent).then((next) => {
      if (active) setResult(next);
    });
    return () => { active = false; };
  }, [attempt, loadContent]);

  const retry = () => {
    setResult(null);
    setAttempt((current) => current + 1);
  };
  const returnToPark = () => routeProps.navigate("/");

  let content: ReactNode;
  if (!result) {
    content = <Panel eyebrow="Feature boundary" title="Loading destination"><p className="foundation-feature-loading" role="status">Preparing this feature inside the product frame.</p></Panel>;
  } else if (!result.ok) {
    content = <ErrorState title="Feature unavailable" summary={result.message} action={<RecoveryActions onRetry={retry} onPark={returnToPark} />} />;
  } else {
    const Loaded = result.Component;
    content = <FeatureRenderBoundary key={attempt} onRetry={retry} onPark={returnToPark}><Loaded {...routeProps} /></FeatureRenderBoundary>;
  }

  return (
    <ProductFrame
      destinationId={destinationId}
      routeKey={`${routeProps.route.id}:${attempt}`}
      navigate={routeProps.navigate}
      heading={routeProps.route.title}
      lede="This feature runs inside the persistent Dino Park Engineer product frame."
    >
      {content}
    </ProductFrame>
  );
}

export function createFramedRouteComponent(
  destinationId: PrimaryDestination,
  loadContent: () => Promise<RouteComponent>,
): RouteComponent {
  return function FramedRouteComponent(routeProps: ShellRouteProps) {
    return <FramedFeatureRoute destinationId={destinationId} loadContent={loadContent} routeProps={routeProps} />;
  };
}
