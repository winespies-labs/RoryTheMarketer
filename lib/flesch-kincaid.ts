/**
 * Client-side Flesch-Kincaid Grade Level calculator.
 * Formula: 0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59
 */

import { stripMarkdownForFK } from "@/lib/markdown-utils";

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return w.length > 0 ? 1 : 0;

  // Count vowel groups
  let count = 0;
  let prevVowel = false;
  const vowels = "aeiouy";

  for (const ch of w) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Silent-e: subtract 1 if word ends in 'e' (but not 'le' at end of word like "ingle")
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) {
    count--;
  }

  // Words ending in 'ed' where 'ed' is not a separate syllable (e.g., "jumped")
  if (w.endsWith("ed") && !w.endsWith("ted") && !w.endsWith("ded") && count > 1) {
    count--;
  }

  return Math.max(count, 1);
}

function countSentences(text: string): number {
  // Split on sentence-ending punctuation followed by whitespace or end of string
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-zA-Z0-9]/g, "").length > 0).length;
}

export interface FKResult {
  gradeLevel: number;
  words: number;
  sentences: number;
  syllables: number;
}

export function calculateFK(text: string): FKResult {
  const plain = stripMarkdownForFK(text);
  if (!plain.trim()) {
    return { gradeLevel: 0, words: 0, sentences: 0, syllables: 0 };
  }

  const words = countWords(plain);
  if (words === 0) {
    return { gradeLevel: 0, words: 0, sentences: 0, syllables: 0 };
  }

  const sentences = countSentences(plain);
  const syllables = plain
    .trim()
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-zA-Z0-9]/g, "").length > 0)
    .reduce((sum, word) => sum + countSyllables(word), 0);

  const gradeLevel =
    0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;

  return {
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    words,
    sentences,
    syllables,
  };
}

export type FKLevel = "green" | "yellow" | "red";

export function getFKLevel(grade: number): FKLevel {
  if (grade >= 5.0 && grade <= 7.0) return "green";
  if ((grade >= 4.0 && grade < 5.0) || (grade > 7.0 && grade <= 8.0)) return "yellow";
  return "red";
}
