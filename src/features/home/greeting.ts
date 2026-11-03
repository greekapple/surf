/** T-099: the Home greeting by the Pacific local hour: morning 5–12, afternoon 12–17, evening 17–22, and "Still up?" overnight (22–5).
 *  (Not "Hello": an earlier Home acceptance removed the old "Hello." hero.) */
export const greetingWord = (h: number) => (h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Still up?');
/** The full greeting line with the first name: "Good morning, Sam." / "Still up, Sam?" */
export const greetingLine = (h: number, firstName: string | null) => {
  const w = greetingWord(h), q = w.endsWith('?'), base = q ? w.slice(0, -1) : w;
  return `${base}${firstName ? `, ${firstName}` : ''}${q ? '?' : '.'}`;
};
