# Chatbox Lite community preparation

Chatbox Lite builds on https://github.com/chatboxai/chatbox at d17455c5ca8fd3ff44385c6d4d2118599e4c970f. Keep LICENSE and upstream attribution. This branch is an independent derivative, not an official Chatbox release.

## Positioning

Custom OpenAI-compatible endpoints, microphone dictation, Kokoro-compatible audio read-aloud/voice selection, existing Tavily web-search support, fewer account prompts, no built-in analytics reporting, and a cohesive configurable interface. Strata is one supported endpoint; its reasoning extension remains opt-in. Engine-speed reporting uses compatible timing metadata when provided and otherwise retains the existing elapsed-time calculation. Voice functions use a separate Kokoro-compatible TTS service and locally downloaded whisper.cpp assets.

## Community checks

The upstream repository currently directs contributions through GitHub issues and pull requests. A repository-wide CONTRIBUTING.md was not found in the checked-out source. Its PR template contains a Contributor Agreement covering both the GPLv3 community edition and the proprietary official edition. Review that agreement before submitting upstream; this baseline does not check or accept the agreement for you.

Reference: https://github.com/chatboxai/chatbox/blob/main/.github/PULL_REQUEST_TEMPLATE.md
License: https://github.com/chatboxai/chatbox/blob/main/LICENSE

An issue search did not establish that these exact local integrations have already been accepted upstream. Do not present the absence of search results as proof that no related issue exists.

## Proposed upstream submissions

1. Custom-compatible endpoint reasoning controls and engine timing support, with endpoint opt-in and provider regression tests.
2. Optional Kokoro-compatible read-aloud and local microphone transcription, with separate model installation, cancellation and cleanup tests.
3. Transcript follow recovery and native resize fallback, with consecutive-message/streaming tests and real desktop reproduction details.
4. Independent sidebar typography and consistent theme surfaces.

Keep the Lite account/welcome hiding, telemetry removal and application branding in this fork unless maintainers request them. These are product preferences and may not match upstream policy.

For public releases, review cross-platform behavior, privacy of logs, translations, accessibility, error handling, resource licenses and installer separation. Current validation covers changed source suites and production builds, not a new installer or all microphone hardware. The user confirmed the local desktop speech/scroll/theme behavior during development, but that is not a broad hardware compatibility claim.

No public fork, GitHub PR or community post was created as part of this local baseline preparation.
