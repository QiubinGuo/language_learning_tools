# Chinese Pronunciation Helper PRD

## Product Philosophy

Follow a Jobs-style minimalist interface and a first-principles product scope:

- Remove every feature that does not help a foreign learner speak Mandarin faster.
- Keep the first version focused on one input, one answer, and two playback modes.
- Do not add history, labels, collections, grammar, pinyin, or multiple translation choices in V1.

## Goal

Validate whether foreign learners can quickly start speaking Mandarin by typing an English sentence and receiving:

- The original English
- A natural Simplified Chinese translation
- A Mandarin pronunciation playback button
- A slow Mandarin playback button
- An English-based pronunciation hint with tone symbols and hyphen separators

## Target User

Foreign learners who do not primarily want Chinese grammar lessons. They want to open their mouth and say a useful Mandarin sentence immediately.

## User Flow

1. User opens the existing language helper app.
2. User selects `Chinese` from the top navigation.
3. User types a short English sentence, such as `I love you`.
4. User clicks `Submit`.
5. The app returns:
   - `Original English`: `I love you`
   - `Chinese`: `我爱你`
   - `Pronunciation Hint`: `woaˇ-eyeˋ-kneeˇ`
6. User clicks `Play` to hear normal Mandarin.
7. User clicks `Slow` to hear slow Mandarin.

## Scope

### In Scope

- Add `Chinese` as a third top navigation option beside `Thai` and `English`.
- Chinese module uses English UI copy.
- Chinese module uses China flag logo plus `ZH`.
- Translate English to natural Simplified Chinese.
- Generate one English-based pronunciation hint.
- Add Mandarin normal playback.
- Add Mandarin slow playback.
- Limit input to 120 characters.
- Reuse the existing OpenAI API route.
- Reuse the existing 3D visual language with a light Chinese skin.

### Out of Scope

- History
- User collection
- Notebook
- Tags
- Categories
- Grammar explanation
- Pinyin display
- Multiple translations
- Auto playback after submit
- New login or sync logic

## Tone Mark Rules

Use the following symbols:

- First tone: `¯`
- Second tone: `´`
- Third tone: `ˇ`
- Fourth tone: `ˋ`
- Neutral tone: `°`

Use `-` between every Chinese character's mnemonic unit.

Examples:

- `你好` -> `kneeˇ-howˇ`
- `谢谢` -> `shyeahˋ-shyeah°`
- `对不起` -> `dwayˋ-booˋ-cheeˇ`
- `没关系` -> `may´-gwan¯-shee°`
- `我很好` -> `woaˇ-henˇ-howˇ`
- `我不知道` -> `woaˇ-booˋ-jrr¯-dowˋ`

## UI Copy

Navigation:

```text
Thai | English | Chinese
```

Chinese module:

```text
Speak Chinese
Type English. Hear and speak natural Mandarin.
```

Input placeholder:

```text
Type what you want to say in English
```

Buttons:

```text
Submit
Clear
Play
Slow
```

Short input note:

```text
Keep it short so it is easier to speak.
```

## API Contract

Request:

```json
{
  "input": "I love you",
  "languageCode": "zh",
  "direction": "english_to_chinese"
}
```

Response:

```json
{
  "phrase": {
    "sourceEnglish": "I love you",
    "chinese": "我爱你",
    "targetText": "我爱你",
    "pronunciationHint": "woaˇ-eyeˋ-kneeˇ"
  }
}
```

## Acceptance Criteria

- The top language navigation shows `Thai`, `English`, and `Chinese`.
- Clicking `Chinese` opens a focused Chinese pronunciation module.
- The Chinese page does not show collections, random practice, scene tags, or correction forms.
- Submitting `I love you` returns original English, Chinese, and a pronunciation hint.
- The pronunciation hint uses tone symbols and hyphen separators.
- `Play` speaks Mandarin at normal speed.
- `Slow` speaks Mandarin slower than normal.
- Input over 120 characters is prevented in the UI.

