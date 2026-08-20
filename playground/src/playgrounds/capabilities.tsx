import {
  Badge, Column, Grid, KeyValue, Panel, Progress, Row, Sparkline, StatusDot,
  useCapabilities, useRuntime, useSize,
} from '@textui/core';

/**
 * Capabilities.
 *
 * The same content rendered under whatever the terminal actually supports.
 * Force a downgrade from the runner (`--ascii`, `--mono`) and watch every
 * glyph and colour fall back without a single component being told.
 */
export function CapabilitiesPlayground() {
  const caps = useCapabilities();
  const size = useSize();
  const runtime = useRuntime();
  const theme = runtime.theme();

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Detected">
        <KeyValue
          columns={2}
          items={[
            { label: 'colour depth', value: `${caps.colorDepth}-bit`, tone: caps.colorDepth === 0 ? 'warning' : 'success' },
            { label: 'unicode', value: caps.unicode },
            { label: 'wide chars', value: String(caps.wideChars) },
            { label: 'mouse', value: String(caps.mouse) },
            { label: 'paste', value: String(caps.paste) },
            { label: 'hyperlinks', value: String(caps.hyperlinks) },
            { label: 'alt screen', value: String(caps.altScreen) },
            { label: 'sync output', value: String(caps.synchronizedOutput) },
            { label: 'kitty keys', value: String(caps.kittyKeyboard) },
            { label: 'size', value: `${size.width}x${size.height}` },
          ]}
        />
      </Panel>

      <Grid columns={2} gap={1}>
        <Panel title="Glyph vocabulary">
          <Column gap={0}>
            <Row gap={2}>
              <StatusDot status="up" label="up" />
              <StatusDot status="degraded" label="degraded" />
              <StatusDot status="down" label="down" />
            </Row>
            <Row gap={1}>
              <text content={theme.glyphs.check} fg="success" />
              <text content={theme.glyphs.cross} fg="danger" />
              <text content={theme.glyphs.warning} fg="warning" />
              <text content={theme.glyphs.info} fg="info" />
              <text content={theme.glyphs.chevronRight} />
              <text content={theme.glyphs.ellipsis} />
            </Row>
            <text content={theme.glyphs.blocks.join('')} fg="accent" />
          </Column>
        </Panel>

        <Panel title="Under the current depth">
          <Column gap={0}>
            <Row gap={1}>
              <Badge label="success" tone="success" />
              <Badge label="warning" tone="warning" />
              <Badge label="danger" tone="danger" />
            </Row>
            <Progress label="progress" value={0.62} barWidth={18} />
            <Sparkline values={[1, 4, 2, 8, 5, 9, 3, 7, 6, 2]} chartWidth={18} />
          </Column>
        </Panel>
      </Grid>

      <Panel title="Borders">
        <Row gap={1}>
          {(['single', 'round', 'double', 'bold', 'ascii'] as const).map((style) => (
            <box key={style} border={style} width={11} height={3}>
              <text content={style} textAlign="center" />
            </box>
          ))}
        </Row>
      </Panel>
    </Column>
  );
}
