"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onSubmit: (question: string) => Promise<void> | void;
  initialQuestion?: string;
}

export function QuestionDialog({ onClose, onSubmit, initialQuestion = "" }: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [submitting, setSubmitting] = useState(false);
  const minLength = 20;
  const maxLength = 300;
  const isValid = question.trim().length >= minLength && question.trim().length <= maxLength;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(question.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 px-4 py-10" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#120c26] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">What is your core question?</h2>
        <p className="mt-2 text-sm text-white/70">
          Share one real question you want POJU to work on with you before payment.
        </p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Example: I feel stuck in my career and can’t decide whether to leave."
          maxLength={maxLength}
          rows={5}
          className="mt-4 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-sm outline-none ring-violet-400/40 placeholder:text-white/35 focus:ring"
        />
        <div className="mt-2 text-xs text-white/60">
          {question.trim().length} / {maxLength}
          {question.trim().length < minLength ? <span className="ml-2 text-amber-300">Minimum {minLength} characters</span> : null}
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? "Redirecting..." : "Continue to payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
