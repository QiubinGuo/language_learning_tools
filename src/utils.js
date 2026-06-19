export function stripAccents(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAnswer(value) {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/[.?!。？！]+$/g, "")
    .replace(/\s+/g, " ");
}

export function isCorrectAnswer(userAnswer, acceptedAnswers) {
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  return acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizedUserAnswer);
}

export function buildAutocomplete(question) {
  const terms = new Set(question.autocomplete || []);

  for (const answer of question.acceptedAnswers || []) {
    const cleaned = answer.replace(/[.?!,;:。？！]/g, " ");
    for (const word of cleaned.split(/\s+/)) {
      const term = word.trim();
      if (term.length > 1) terms.add(term);
    }
  }

  return Array.from(terms).filter(Boolean);
}

export function getCurrentPrefix(value, cursorPosition = value.length) {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/([A-Za-zÀ-ÿ'’-]+)$/);
  return match ? match[1] : "";
}

export function insertSuggestion(value, suggestion, cursorPosition = value.length) {
  const beforeCursor = value.slice(0, cursorPosition);
  const afterCursor = value.slice(cursorPosition);
  const prefix = getCurrentPrefix(value, cursorPosition);
  const start = beforeCursor.length - prefix.length;
  const needsSpace = afterCursor && !afterCursor.startsWith(" ") ? " " : "";
  const nextValue = `${value.slice(0, start)}${suggestion}${needsSpace}${afterCursor}`;
  const nextCursor = start + suggestion.length + needsSpace.length;
  return { value: nextValue, cursor: nextCursor };
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function trimRecords(records) {
  return records.slice(0, 30);
}
