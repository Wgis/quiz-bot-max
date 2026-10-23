import fs from 'fs';
import path from 'path';
import { QuizData, QuizQuestion, QuizResult } from '../types';

const QUIZ_PATH = path.join(process.cwd(), 'data', 'quiz.json');

const imageExistsCache = new Map<string, boolean>();

let cache: QuizData | null = null;

export function loadQuiz(): QuizData {
  const raw = fs.readFileSync(QUIZ_PATH, 'utf-8');
  const data = JSON.parse(raw) as QuizData;

  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('quiz.json: поле questions отсутствует или пустое');
  }
  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new Error('quiz.json: поле results отсутствует или пустое');
  }
  for (const q of data.questions) {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`quiz.json: вопрос id=${q.id} должен иметь минимум 2 варианта ответа`);
    }
    if (q.correct < 0 || q.correct >= q.options.length) {
      throw new Error(`quiz.json: вопрос id=${q.id} имеет неверный индекс correct`);
    }
  }

  cache = data;
  return data;
}

export function getQuiz(): QuizData {
  return cache ?? loadQuiz();
}

export function getQuestion(index: number): QuizQuestion | undefined {
  return getQuiz().questions[index];
}

export function getTotalQuestions(): number {
  return getQuiz().questions.length;
}

export function checkAnswer(questionIndex: number, choiceIndex: number): boolean {
  const q = getQuestion(questionIndex);
  return q != null && q.correct === choiceIndex;
}

export function getResultEntry(score: number): QuizResult | undefined {
  return getQuiz().results.find((r) => score >= r.min && score <= r.max);
}

/** Проверяет существование файла изображения с кешированием результата. */
export function imageExists(relativePath: string): boolean {
  const cached = imageExistsCache.get(relativePath);
  if (cached !== undefined) return cached;
  const abs = path.resolve(process.cwd(), relativePath);
  const exists = fs.existsSync(abs);
  imageExistsCache.set(relativePath, exists);
  return exists;
}

/** Читает изображение в буфер: стриминг файла через прокси под Bun зависает. */
export function readImage(relativePath: string): Buffer {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath));
}
