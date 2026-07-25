# Learning OS — Product Brief

> A self-contained brief for designing and building this application. It defines **what** the product is,
> **who** it serves, and the **principles** any implementation must honor. It deliberately does **not**
> prescribe a data model, a stack, or a schema — designing those is the implementer's job. Where it
> constrains implementation, it does so through principles and use cases, not through code.
>
> **The task:** read this, then propose an architecture, data model, and phased implementation plan.

---

## 1. What this is

Learning OS is a **personal, local-first web application for structuring and sustaining self-directed
study** across multiple unrelated knowledge areas over a span of months.

It is not a course platform, not a note-taking app, and not a flashcard app — though it borrows from all
three. Its reason to exist is to answer, at any moment, three questions that generic tools leave
unanswered:

1. **Consistency** — Is the learner making sustained progress, or have they quietly stopped?
2. **Coverage** — How much of the intended material has been worked through?
3. **Retention** — How much of what was studied is still known, versus quietly forgotten?

The third is the one almost no tool answers, and it is the heart of this product. Coverage and
consistency are common; **retention over time is rare, and here it is a first-class metric.**

The application runs entirely in the browser. In its initial scope there is no backend, no account, and
no synchronization — all data lives on the user's device.

---

## 2. Who it is for

The target user is an **experienced software engineer pursuing structured self-study while working full
time.** Stating this precisely matters, because it rules some things in and many things out.

- **Time-poor and easily interrupted.** Study happens in evening or weekend blocks, often after a full
  workday. The cognitive budget *during* study is low, and the design must respect that.
- **Studies heterogeneous areas at once.** Not one subject but a spread — some conceptual, some
  practice-based, some project-based. A single rigid structure would fit none of them well.
- **Technically fluent.** Comfortable with Markdown, code blocks, keyboard-driven tools, and diagrams.
  The interface can assume this rather than hand-holding.
- **Self-motivated but attrition-prone.** No external deadline enforces the study. The product's job is
  to *lower the cost of staying consistent* — not to gamify, pressure, or nag.

The product is **single-user and single-device** in this scope. It does not target teams, classrooms, or
cross-device use.

---

## 3. The central principle (read this before anything else)

Every decision in this product serves one principle. Understanding it is prerequisite to evaluating any
design choice:

> **Logging the study must never cost more than doing the study.**

Personal tracking tools share a failure mode. The cost of logging creeps upward — one more required
field, one more classification prompt — until, on a tired evening, the user stops logging. Once logging
lapses for a few days, the data is incomplete, the metrics mislead, and the tool is abandoned. **These
tools die from an excess of required inputs, not from a lack of features.**

The structural countermeasure is to separate two kinds of activity into **different moments in time**:

- **Capture** — writing notes, drawing diagrams, saving references. This *is* the value of studying. It
  must be free, immediate, and always available.
- **Organize** — assigning statuses, tags, difficulty, classifications. This is overhead. It is deferred
  to a dedicated, low-pressure moment, never demanded mid-study.

A rule follows, and it should govern both the interface and the data design:

> **If a field does not change a decision the user makes, it must not be asked for.**

Any design that reintroduces friction into the moment of study — a mandatory "session summary" dialog, a
required category picker before starting — works against the product's core purpose, even when it looks
like a reasonable feature in isolation. **When a proposed feature and this principle conflict, the
principle wins.**

---

## 4. The three-moment interaction model

The application is organized around three recurring moments, each with a different cognitive load. This
is the most important structural idea and it should shape every screen.

**Plan — low load, weekly.** Done unhurried, roughly once a week. The **only** moment where entering
metadata is appropriate, because the user is already thinking about structure: creating and arranging
topics, setting time estimates and expectations, attaching references, laying out a weekly schedule.

**Study — high load, daily.** The moment of actual learning. The **only required action is start/stop.**
The application asks nothing else: no required fields, no completion prompts, no modal on stopping.
Everything else is *optional, frictionless capture* — notes, diagrams, pasted links, a global
quick-capture inbox for stray thoughts. Whatever is captured attaches automatically to what is being
studied; the user never picks a destination. Provenance is recorded for free.

**Review — medium load, weekly.** The moment that turns messy capture into retrievable knowledge. A
dedicated activity, done weekly, where all the deferred organizing happens: triaging the capture inbox,
turning concepts into review items, adjusting the plan, revisiting the week's diagrams. Organization
lives here — pulled out of the study moment entirely.

The cycle repeats: **Plan → Study → Review → Plan.**

---

## 5. The modeling challenge

The target user studies areas that are genuinely different in nature. A naive design builds a separate
module per area; a lazy design forces them all into one rigid shape. Neither works. The implementation
should find a **single generic structure that specializes by type** — so that a practice-drill area and a
diagram-heavy conceptual area are the same kind of thing wearing different clothes, not two separate
systems.

The eight use cases below are the test of that genericity. An architecture that handles all eight cleanly
through one model has succeeded; one that needs a special case per area has found a gap. They are the
acceptance criteria for the model design.

---

## 6. Use cases

### UC-1 · Algorithms & data structures — *repeated timed exercise with retention*

The user solves practice problems, often the same class repeatedly. Each attempt has a result (clean
solve / solved with a hint / failed) and a duration. Weakness clusters by *pattern* (e.g. two pointers,
sliding window, dynamic programming), so the user needs to see which patterns are weak. A problem solved
three weeks ago and never revisited is effectively unknown — so **spaced repetition is essential here**
and should be on by default.

*Requires:* per-item attempt history; aggregation by pattern; spaced repetition over practice items, not
just flashcards.

### UC-2 · System design — *conceptual, diagram-first*

Best understood by drawing. Each concept benefits from a freeform canvas with reusable starting templates
(load balancer, cache, replicated database, message queue). The user also wants to rehearse full design
exercises under a time limit, capturing the resulting diagram as a snapshot.

*Requires:* canvas as a first-class artifact of a study item; a timed exercise mode; saved diagram
snapshots that remain editable later.

### UC-3 · A spoken/practiced language — *continuous practice, deliberately narrow*

The user logs listening and speaking time and captures useful expressions (a phrase, where it was seen,
its context). **This area is kept intentionally thin** (see §8): it records *that* and *how much* was
studied and captures raw material, but does not attempt adaptive assessment or decide what to practice
next. Reference video with **notes pinned to a timestamp** (a note anchored to a moment in a video) is
especially valuable here.

*Requires:* time-only logging with light capture; timestamp-anchored notes against embedded video; a firm
boundary against scope creep.

### UC-4 · Language/framework depth (e.g. a language, a runtime, a UI framework) — *conceptual + applied*

The user deepens tools they already use professionally. Items are concept notes with code snippets, plus
project items with subtasks and a link to a real repository. A distinctive need: recording **where a
concept was actually applied in real work** — connecting theory to practice is what makes it stick, and
no generic tool captures this.

*Requires:* rich Markdown with code; project items with subtasks and external links; an "applied here"
reference.

### UC-5 · Raw coding practice — *pure consistency, zero metadata*

Short timed drills to keep skills sharp. Here **nothing matters except that it happened** — no notes, no
metadata, no classification, just done/not-done and a streak. This use case deliberately exercises the
model's ability to support an area that rejects almost all of the product's features.

*Requires:* an item type that is intentionally metadata-free; the streak as its only visible metric.

### UC-6 · A research-oriented technical area (e.g. applied AI) — *reading + building*

The user reads papers (capturing each paper's one-sentence key idea) and builds implementations. Diagrams
of pipelines and architectures are common.

*Requires:* reading items with a distilled "key idea"; project items; heavy canvas use.

### UC-7 · Interview / assessment preparation — *cross-cutting, time-boxed*

Cutting across several areas, the user rehearses under interview-like conditions: a timed exercise, a
checklist of what a good answer covers, a captured artifact. This should **reuse** the timed-exercise and
checklist machinery from UC-1 and UC-2 rather than inventing new structure — a good test of whether the
model composes.

*Requires:* reuse of timed-exercise and checklist patterns across areas.

### UC-8 · General reference capture — *frictionless inbox*

Across every area, the user frequently has a stray thought, link, or question mid-study or mid-planning
that doesn't yet belong anywhere. A single global quick-capture drops it into an inbox with automatic
context, to be triaged later during Review.

*Requires:* a capture concept decoupled from any single study item; automatic context; deferred triage.

---

## 7. Progress is three numbers, not one

A single "percent complete" is misleading and is rejected. The product surfaces three independent
metrics, mapping to the three questions in §1:

- **Coverage** — how much of the planned material is done. "How far through am I?"
- **Retention** — how much of what was learned is still fresh, derived from a spaced-repetition schedule.
  "How much do I still know?" The metric most tools lack.
- **Consistency** — study time against a weekly target, plus a streak of active days. "Am I keeping this
  up?"

Study items move through a lifecycle from untouched to mastered, with a distinct **needs-review** state
that the spaced-repetition system triggers on its own. Mastery is not permanent: failing a review returns
an item to needs-review. This is what makes retention a live signal rather than a one-time checkbox — and
it implies the model must track review history, not just current state, if a retention *trend* is ever to
be shown.

---

## 8. Scope boundaries and non-goals

Scope creep is the second most likely way this product fails, after logging friction. So, explicitly:

- **The spoken-language area (UC-3) is intentionally minimal.** Adaptive language assessment — diagnosing
  level, detecting plateaus, recommending what to practice — is a large separate problem, potentially the
  domain of a dedicated tool. Learning OS records language *study time and raw captures* and stops there.
  A useful test when unsure: if a feature decides *what to study next*, it is out of scope; if it records
  *that studying happened*, it is in scope.
- **No AI in the initial scope.** It is sensible to *reserve room* for it in the design (so it can be
  added later without a rewrite), but none is built now. A principle constrains any future addition: **AI
  proposes; the user disposes — it never reorganizes silently.** The point of the tool is to build the
  user's *own* mental structure; an AI that restructures unasked would undermine exactly that.
- **No backend, accounts, or multi-device sync** in this scope. It is worth designing the data layer so
  these *could* be added later without a painful migration, but building them now is out of scope.
- **Not a replacement for mature spaced-repetition software.** The review system should be simplified —
  enough to make retention a real signal, not a clone of a full SRS tool.
- **No collaboration, no native mobile app, no importers, no in-app code execution.** Basic responsive
  behavior is expected; a native experience is not.

---

## 9. Fragility to design around

Because all data is local, it is fragile: clearing browser storage destroys it. This is an accepted
trade-off of the local-first choice, to be mitigated — not eliminated — by full data export/import from
the very first version, plus a periodic backup reminder. **Treat export as a first-class, always-available
feature, not an afterthought — it is the only safety net.**

---

## 10. What to produce from this brief

Using this document, propose:

1. **An architecture** — how the app is structured, where domain logic lives, how the UI stays decoupled
   from storage, and how data reactivity is handled. Justify the trade-offs.
2. **A data model** — the entities, their relationships, and how one generic structure specializes across
   all eight use cases in §6. Call out anywhere a use case strains the model.
3. **A phased implementation plan** — where each phase leaves the app usable end-to-end (no
   infrastructure-only phases), and where the friction principle (§3) and the three-moment model (§4) are
   preserved at every step.

Then surface the decisions this brief leaves open — anywhere it states a *what* without a *how* — and
flag any point where two requirements here are in tension, before writing code.

Two litmus tests to apply throughout:
- Does anything add a required input to the **Study** moment? If so, it is wrong (§3).
- Does the model handle all eight use cases without a special case per area? If not, it has a gap (§5).
