// Client-safe: shared by the set-password and change-password forms and the server code that enforces it.
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/** Each requirement, in the order the forms list them. */
export const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  { label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { label: 'An uppercase and a lowercase letter', test: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol (such as ! @ # $ %)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, with upper- and lowercase letters, a number and a symbol. Avoid common words and your name.`;

// Words that top every leaked-password list, plus the obvious ones for this organisation.
const COMMON_WORDS = new Set([
  'password', 'passwort', 'welcome', 'qwerty', 'qwertyuiop', 'admin', 'administrator', 'letmein', 'iloveyou',
  'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'master', 'hello', 'freedom', 'whatever',
  'trustno', 'changeme', 'secret', 'login', 'test', 'user', 'default', 'abc', 'abcd', 'abcdef', 'pass',
  'nib', 'nibbank', 'nibinternational', 'nibinternationalbank', 'bank', 'ethiopia', 'addis', 'addisababa',
  'strategic', 'strategicplan', 'summer', 'winter', 'spring', 'autumn', 'january', 'december',
]);

const SEQUENCES = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** "P@ssw0rd123!" -> "password": the word underneath the usual decorations. */
function coreWord(password: string): string {
  return password
    .toLowerCase()
    .replace(/^[^a-z@$]+|[^a-z]+$/g, '')
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/[^a-z]/g, '');
}

function hasEasySequence(password: string): boolean {
  const lower = password.toLowerCase();
  if (/(.)\1{3,}/.test(lower)) return true; // aaaa, 1111
  return SEQUENCES.some((seq) => {
    for (let i = 0; i + 5 <= seq.length; i++) if (lower.includes(seq.slice(i, i + 5))) return true;
    return false;
  });
}

/**
 * Returns a message describing what's wrong with the password, or null if it is
 * acceptable. Pass the account's email and name so the password can't simply be built from them.
 */
export function checkPasswordStrength(password: string, account?: { email?: string | null; name?: string | null }): string | null {
  if (typeof password !== 'string') return 'Enter a password.';
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  const unmet = PASSWORD_RULES.find((rule) => !rule.test(password));
  if (unmet) return `Your password needs: ${unmet.label.charAt(0).toLowerCase()}${unmet.label.slice(1)}.`;

  if (COMMON_WORDS.has(coreWord(password))) return 'This password is too common. Choose something harder to guess.';
  if (hasEasySequence(password)) return 'Avoid easy sequences and repeats like "12345", "qwert" or "aaaa".';

  const lower = password.toLowerCase();
  const personal = [
    account?.email?.split('@')[0],
    ...(account?.name?.split(/\s+/) ?? []),
  ].map((part) => part?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '').filter((part) => part.length >= 3);
  if (personal.some((part) => lower.includes(part))) return "Don't use your name or email address in your password.";

  return null;
}
