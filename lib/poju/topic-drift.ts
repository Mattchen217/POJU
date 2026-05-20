export type TopicDriftSignal = "none" | "edge" | "off_topic";

export type TopicDriftFields = {
  topic_drift_signal: TopicDriftSignal;
  drift_reason: string | null;
  should_show_new_session_button: boolean;
};

export function parseTopicDriftFromParsed(parsed: Record<string, unknown>): TopicDriftFields {
  const raw = typeof parsed.topic_drift_signal === "string" ? parsed.topic_drift_signal.trim() : "none";
  const topic_drift_signal: TopicDriftSignal =
    raw === "edge" || raw === "off_topic" ? raw : "none";

  const drift_reason =
    typeof parsed.drift_reason === "string" && parsed.drift_reason.trim()
      ? parsed.drift_reason.trim()
      : null;

  return {
    topic_drift_signal,
    drift_reason,
    should_show_new_session_button: topic_drift_signal === "off_topic",
  };
}

export function topicDriftDetected(signal: TopicDriftSignal): boolean {
  return signal === "off_topic";
}
