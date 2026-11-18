---
title: A playground test failed once under pnpm test, and its name was not kept
status: open
date: 2026-11-17
severity: minor
refs:
  - "[code://playground/test/playgrounds.test.tsx](../../playground/test/playgrounds.test.tsx) - the suite that mounts every playground"
  - git://1bfcba7 - the commit the run was on, with the dialog, form and tabs changes not yet committed
---

## Symptom

One `pnpm test` run on 2026-11-17 printed `playground test: Tests 1 failed | 193 passed (194)`.
The log was cut to its summary lines, so the name and the error of the case are lost.
Three runs of the playground suite alone and five more runs of `pnpm test` passed, with 194 of 194.

## Cause

Unknown. `pnpm test` runs the packages side by side, so a case with a deadline may run out of time under load.
`useApp() outside an application` from `ComposerPlayground` is written to stderr in runs that pass too, so it is not the failure.

## Impact

A release run can go red at random, and a rerun would hide the case.

## Workaround

None. The next failure keeps its full log.

## Fix

Run `pnpm test` with its whole output kept until the case fails again, and read its name and its error.
