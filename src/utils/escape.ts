function replacerUnescape(match: string): string {
  return match.includes('\\"') ? (JSON.parse(`"${match}"`) as string) : match;
}

export function unescapeLiquidSyntax(template: string): string {
  return template.replace(/\{\{.*?\}\}/g, replacerUnescape);
}
