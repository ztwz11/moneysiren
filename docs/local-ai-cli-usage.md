# Local AI CLI Usage

Codex CLI and Claude CLI are not API billing providers in MoneySiren.

MoneySiren treats them as local usage providers. The app estimates usage from local installation state, local logs, and statusline metadata. It must not present Codex CLI or Claude CLI usage as OpenAI API or Anthropic API billing.

## Display Priority

When available, MoneySiren should prioritize:

1. 5-hour quota percent
2. weekly quota percent
3. rolling token usage
4. context usage percent
5. latest request token usage
6. session/log counts

Session counts are diagnostic metadata. They should not be the primary usage signal.

## Allowed Metadata

MoneySiren may display:

- token counts
- quota percentages
- reset times
- model names
- timestamps
- freshness labels
- confidence labels

## Forbidden Data

MoneySiren must not display or persist:

- prompt text
- assistant response text
- tool input
- shell command body
- raw JSONL lines
- local file content
- provider credentials

## Confidence

Quota values should include source and confidence. If a CLI does not expose quota percentage, MoneySiren may calculate an estimate from configured non-secret token limits, but the UI should treat that value as an estimate.
