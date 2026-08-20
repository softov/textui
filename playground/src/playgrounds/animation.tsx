import {
  Button, Column, Gauge, Panel, Progress, Row, Sparkline, Spinner,
  useFrame, useRuntime, useState, useTicker, useTween,
} from '@textui/core';

/**
 * Animation.
 *
 * One driver runs all of it, so the switch below stops every moving thing at
 * once and each component renders its final state rather than a frozen frame.
 * That is what makes "disable animations" a real setting rather than a wish.
 */
export function AnimationPlayground() {
  const runtime = useRuntime();
  const [enabled, setEnabled] = useState(runtime.animation.enabled);
  const [target, setTarget] = useState(20);
  const eased = useTween(target, 400);
  const frame = useFrame(8);

  const [history, setHistory] = useState<number[]>(() => Array.from({ length: 30 }, () => 50));
  useTicker(() => {
    setHistory((previous) => [
      ...previous.slice(1),
      50 + Math.round(Math.sin(Date.now() / 400) * 35),
    ]);
  }, { fps: 8 });

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Driver">
        <Row gap={2}>
          <Button
            label={enabled ? 'Disable animations' : 'Enable animations'}
            tone={enabled ? 'danger' : 'success'}
            autoFocus
            onPress={() => {
              runtime.animation.enabled = !enabled;
              setEnabled(!enabled);
            }}
          />
          <text content={`frame ${frame}`} fg="muted" />
        </Row>
      </Panel>

      <Panel title="Indeterminate">
        <Column gap={0}>
          <Spinner label="Working" />
          <Progress label="unknown" />
        </Column>
      </Panel>

      <Panel title="Tweened value">
        <Column gap={0}>
          <Row gap={1}>
            <Button label="20" onPress={() => setTarget(20)} />
            <Button label="60" onPress={() => setTarget(60)} />
            <Button label="95" onPress={() => setTarget(95)} />
          </Row>
          <Gauge label="eased" value={Math.round(eased)} thresholds={[{ at: 80, tone: 'danger' }]} />
        </Column>
      </Panel>

      <Panel title="Live series">
        <Sparkline values={history} chartWidth={40} showValue />
      </Panel>
    </Column>
  );
}
