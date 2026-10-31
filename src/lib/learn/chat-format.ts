// Answer feedback is stored in chat_history as an AI message with this
// prefix, so the chat can show it apart from mentor replies.
export const FEEDBACK_PREFIX = "Отзыв на ответ: ";

export function splitFeedback(message: string): { isFeedback: boolean; text: string } {
  return message.startsWith(FEEDBACK_PREFIX)
    ? { isFeedback: true, text: message.slice(FEEDBACK_PREFIX.length) }
    : { isFeedback: false, text: message };
}
