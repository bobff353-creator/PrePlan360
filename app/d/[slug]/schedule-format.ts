const LEGACY_PUNCTUATION: ReadonlyArray<readonly [string, string]> = [
  ["\u00e2\u20ac\u201c", "–"],
  ["\u00e2\u20ac\u201d", "—"],
  ["\u00e2\u20ac\u2122", "’"],
  ["\u00c2\u00b7", "·"],
  ["\u00c2\u00a0", " "],
];

export function normalizeImportedScheduleText(value: string) {
  let normalized = String(value || "");
  for (const [legacy, punctuation] of LEGACY_PUNCTUATION) {
    normalized = normalized.replaceAll(legacy, punctuation);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

export function scheduleDisplayName(name: string, start: string, end: string) {
  const normalized = normalizeImportedScheduleText(name);
  let label = normalized;
  if (start && end) {
    for (const separator of ["–", "—", "-"]) {
      const range = `${start}${separator}${end}`;
      if (label.toLocaleLowerCase().endsWith(range.toLocaleLowerCase())) {
        label = label.slice(0, -range.length).trim();
        break;
      }
    }
  }
  label = label.replace(/[\s:|/–—-]+$/g, "").trim();
  if (/^imported(?:\s+shift)?$/i.test(label)) return "Imported shift";
  return label || normalized || "Unnamed shift";
}
