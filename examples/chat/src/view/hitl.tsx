import {
  Button, Checkbox, Column, MarkdownView, Panel, RadioGroup, Row, TextInput,
  defineComponent, useFocusScope, useInput, useStore, useTheme,
} from '@textui/core';
import type { BindingPath, BoxProps, RenderOutput } from '@textui/core';
import type { Answer, PendingInput, Question } from '../ahp/types.js';

/**
 * The block that means the agent is stopped, waiting on a person.
 *
 * It is the only thing on the screen that is waiting on the reader, so it
 * takes the focus, traps it, and is answerable without leaving the keyboard.
 * Rendered as one more bubble in the transcript it scrolls away, and a blocked
 * agent that has scrolled off is a session that looks merely slow.
 *
 * Two kinds, and they are nothing alike:
 *
 *   a **tool confirmation** is a yes or a no about a command, with named
 *   options where the host offers them;
 *
 *   a **question** carries no tool call at all. Its prose is the request's own
 *   message and what is being asked is its questions. Rendering it as a
 *   confirmation loses the entire request - the choices vanish, the question
 *   is never shown, and what is left is a heading and an Approve button.
 */

export const ANSWERS = '$/chat/ui/answers' as BindingPath;

export interface ChatHitlProps extends BoxProps {
  input: PendingInput;
  onApprove(optionId?: string): void;
  onDeny(): void;
  onAnswer(answers: Record<string, Answer>, accepted: boolean): void;
  /** Leave it up, but give the keyboard back. */
  onEscape?(): void;
}

export const ChatHitl: (props: ChatHitlProps) => RenderOutput =
  defineComponent<ChatHitlProps>('ChatHitl', (props) => {
    const { input, onApprove, onDeny, onAnswer, onEscape, ...rest } = props;
    const theme = useTheme();
    // Trapping is the point: the answer is the only thing to do, and tab
    // wandering off into the transcript behind it is how a turn stays blocked
    // with the cursor somewhere else.
    useFocusScope({ id: 'chat.hitl', trap: true, autoFocus: true, restore: true });

    return (
      <Panel
        title={input.kind === 'toolConfirmation' ? (input.call.confirmationTitle ?? 'The agent asks') : 'The agent asks'}
        tone="warning"
        border="single"
        meta={`${theme.glyphs.warning} waiting on you`}
        {...rest}
      >
        {input.kind === 'toolConfirmation'
          ? <ConfirmRequest input={input} onApprove={onApprove} onDeny={onDeny} {...(onEscape ? { onEscape } : {})} />
          : <QuestionForm input={input} onAnswer={onAnswer} {...(onEscape ? { onEscape } : {})} />}
      </Panel>
    );
  });

/** A yes or a no about a command, and the named options the host offered. */
const ConfirmRequest = defineComponent<{
  input: Extract<PendingInput, { kind: 'toolConfirmation' }>;
  onApprove(optionId?: string): void;
  onDeny(): void;
  onEscape?(): void;
}>('ConfirmRequest', ({ input, onApprove, onDeny, onEscape }) => {
  const theme = useTheme();
  const options = input.call.options ?? [];

  // The letters are on the block, not on the application: they only exist
  // while it is up, and while it is up nothing else wants them.
  useInput((event) => {
    if (event.name === 'a') { onApprove(); return true; }
    if (event.name === 'd') { onDeny(); return true; }
    if (event.name === 'escape') { onEscape?.(); return true; }
    const digit = Number(event.name);
    if (Number.isInteger(digit) && digit >= 1 && digit <= options.length) {
      onApprove(options[digit - 1]?.id);
      return true;
    }
    return false;
  }, { global: true });

  return (
    <Column gap={1}>
      {input.call.intention ? <MarkdownView content={input.call.intention} quiet /> : null}
      {input.call.input ? (
        <Column bg="surfaceAlt" padding={[0, 1]}>
          <text content={input.call.input} wrap="word" />
        </Column>
      ) : null}

      {/* Numbered, because option ids are opaque - a live host sends whole
          sentences with punctuation in them - so the number is what a person
          can actually answer with, and it is on the control rather than in a
          list above it. */}
      <Row gap={2}>
        <Button label="Approve" tone="success" variant="solid" icon={theme.glyphs.check} hint="a" autoFocus onPress={() => onApprove()} />
        <Button label="Deny" tone="danger" icon={theme.glyphs.cross} hint="d" onPress={onDeny} />
        {options.map((option, i) => (
          <Button key={option.id} label={option.label} variant="ghost" hint={String(i + 1)} onPress={() => onApprove(option.id)} />
        ))}
      </Row>
    </Column>
  );
});

/**
 * A question, with its questions.
 *
 * Every answer names its own kind, keyed by question id, and a required one
 * left empty is not sendable - accepting with no answers resumes the agent on
 * the answers it already had, which for a question it has just asked is none.
 */
const QuestionForm = defineComponent<{
  input: Extract<PendingInput, { kind: 'chatInput' }>;
  onAnswer(answers: Record<string, Answer>, accepted: boolean): void;
  onEscape?(): void;
}>('QuestionForm', ({ input, onAnswer, onEscape }) => {
  const theme = useTheme();
  // Draft answers live in the store, not in this component: AHP has an action
  // for a draft answer precisely because another client may be looking at the
  // same question, and a value only this box knows is one nobody else can see.
  const [draft, setDraft] = useStore<Record<string, Answer>>(`${ANSWERS}/${input.id}` as BindingPath, {});
  const answers = draft ?? {};

  const set = (id: string, answer: Answer | null): void => {
    const next = { ...answers };
    if (answer === null) delete next[id];
    else next[id] = answer;
    setDraft(next);
  };

  const missing = input.questions.filter((question) => question.required && !answers[question.id]);

  useInput((event) => {
    if (event.name === 'escape') { onEscape?.(); return true; }
    return false;
  }, { global: true });

  return (
    <Column gap={1}>
      <MarkdownView content={input.message} />
      {input.questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          answer={answers[question.id] ?? null}
          onChange={(answer) => set(question.id, answer)}
        />
      ))}

      <Row gap={2}>
        <Button
          label="Send"
          tone="success"
          variant="solid"
          icon={theme.glyphs.check}
          hint="enter"
          disabled={missing.length > 0}
          onPress={() => onAnswer(answers, true)}
        />
        <Button label="Decline" variant="ghost" icon={theme.glyphs.cross} onPress={() => onAnswer({}, false)} />
        {missing.length > 0 ? (
          <text content={`${theme.glyphs.warning} ${missing.length} still to answer`} fg="warning" />
        ) : null}
      </Row>
    </Column>
  );
});

/** One question, rendered by its kind. The kind decides the answer's shape. */
const QuestionField = defineComponent<{
  question: Question;
  answer: Answer | null;
  onChange(answer: Answer | null): void;
}>('QuestionField', ({ question, answer, onChange }) => {
  const theme = useTheme();
  const options = question.options ?? [];
  const selectedMany = answer?.kind === 'selected-many' ? answer.value : [];

  return (
    <Column gap={0}>
      <Row gap={1}>
        <text content={question.message} bold wrap="word" flex={1} />
        {question.required ? <text content="required" fg="warning" /> : null}
      </Row>

      {question.kind === 'boolean' ? (
        <Checkbox
          label="yes"
          checked={answer?.kind === 'boolean' ? answer.value : false}
          onChange={(checked: boolean) => onChange({ kind: 'boolean', value: checked })}
        />
      ) : null}

      {question.kind === 'single-select' ? (
        <RadioGroup
          options={options.map((option, i) => ({ value: option.id, label: `${i + 1}. ${option.label}` }))}
          {...(answer?.kind === 'selected' ? { value: answer.value } : {})}
          onChange={(value: string) => onChange({ kind: 'selected', value })}
        />
      ) : null}

      {question.kind === 'multi-select' ? (
        <Column>
          {options.map((option, i) => (
            <Checkbox
              key={option.id}
              label={`${i + 1}. ${option.label}`}
              checked={selectedMany.includes(option.id)}
              onChange={(checked: boolean) => onChange({
                kind: 'selected-many',
                value: checked
                  ? [...selectedMany, option.id]
                  : selectedMany.filter((id) => id !== option.id),
              })}
            />
          ))}
        </Column>
      ) : null}

      {question.kind === 'text' || question.kind === 'number' || question.kind === 'integer' ? (
        <TextInput
          value={answer && 'value' in answer ? String(answer.value) : ''}
          label={question.kind === 'text' ? 'answer' : 'number'}
          hideLabel
          onChange={(value: string) => onChange(
            value === '' ? null
              : question.kind === 'text' ? { kind: 'text', value }
                : { kind: 'number', value: Number(value) },
          )}
        />
      ) : null}

      {question.allowFreeformInput && question.kind !== 'text' ? (
        // Freeform answers *instead of* choosing, never as one more choice: a
        // host reading only the selection must not be handed typed words in
        // the field where it expects an option id.
        <Row gap={1}>
          <text content={theme.glyphs.chevronRight} fg="subtle" />
          <TextInput
            value={answer?.kind === 'text' ? answer.value : ''}
            label="or say it in words"
            flex={1}
            onChange={(value: string) => onChange(value === '' ? null : { kind: 'text', value })}
          />
        </Row>
      ) : null}
    </Column>
  );
});
