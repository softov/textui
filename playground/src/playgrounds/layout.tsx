import {
  Center, Column, Divider, Grid, Panel, Row, ScrollView, Splitter, useSize,
} from '@textui/core';

/**
 * Layout.
 *
 * Resize the terminal while this is open: every box here is sized by the
 * engine, so what you see is what the flex subset actually does rather than a
 * screenshot of what it did once.
 */
export function LayoutPlayground() {
  const size = useSize();

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1}>
        <text content="Layout" bold />
        <text content={`${size.width}x${size.height}`} fg="muted" />
      </Row>

      <Panel title="Row: flex 1 / 2 / 1">
        <Row gap={1} height={3}>
          <Panel flex={1} border="single"><text content="1" /></Panel>
          <Panel flex={2} border="single"><text content="2" /></Panel>
          <Panel flex={1} border="single"><text content="1" /></Panel>
        </Row>
      </Panel>

      <Panel title="Justify">
        <Column gap={0}>
          <Row justify="start" gap={1}><text content="start" /><text content="." /></Row>
          <Row justify="center" gap={1}><text content="center" /><text content="." /></Row>
          <Row justify="end" gap={1}><text content="end" /><text content="." /></Row>
          <Row justify="between"><text content="between" /><text content="." /></Row>
        </Column>
      </Panel>

      <Row gap={1} flex={1}>
        <Panel title="Grid" flex={1}>
          <Grid columns={3} gap={1}>
            {Array.from({ length: 6 }, (_, i) => (
              <text key={i} content={`cell ${i + 1}`} />
            ))}
          </Grid>
        </Panel>

        <Panel title="Scroll" flex={1}>
          <ScrollView height={6}>
            {Array.from({ length: 30 }, (_, i) => (
              <text key={i} content={`line ${i + 1}`} />
            ))}
          </ScrollView>
        </Panel>
      </Row>

      <Divider label="splitter" />

      <Splitter direction="row" size="40%" height={4}>
        <Center><text content="left 40%" /></Center>
        <Center><text content="right, the rest" /></Center>
      </Splitter>
    </Column>
  );
}
