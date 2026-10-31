import { TOPIC_BLOCKS } from "@/config/app";

export type TopicStatus = "completed" | "current" | "locked";

type TopicRef = { id: string; order_number: number };
type TaskRef = { id: string; topic_id: string };

// Splits topics, sorted by order, into consecutive blocks of the given sizes.
// Topics beyond the configured sizes form one more block, so none is lost.
export function splitIntoBlocks<T extends { order_number: number }>(
  topics: T[],
  blocks: readonly number[] = TOPIC_BLOCKS,
): T[][] {
  const sorted = [...topics].sort((a, b) => a.order_number - b.order_number);
  const result: T[][] = [];
  let start = 0;
  for (const size of blocks) {
    if (start >= sorted.length) break;
    result.push(sorted.slice(start, start + size));
    start += size;
  }
  if (start < sorted.length) result.push(sorted.slice(start));
  return result;
}

// Topics open block by block. A topic is completed when it has tasks and all
// of them are solved. A block is open when every block before it is
// completed; its unfinished topics are current, every topic of a later block
// is locked. Order comes from sorting, so gaps in numbers are fine.
export function computeTopicStatuses(
  topics: TopicRef[],
  tasks: TaskRef[],
  solvedTaskIds: ReadonlySet<string>,
  blocks: readonly number[] = TOPIC_BLOCKS,
): Map<string, TopicStatus> {
  const statuses = new Map<string, TopicStatus>();
  let open = true;

  for (const block of splitIntoBlocks(topics, blocks)) {
    let blockCompleted = true;
    for (const topic of block) {
      const topicTasks = tasks.filter((task) => task.topic_id === topic.id);
      const completed =
        topicTasks.length > 0 && topicTasks.every((task) => solvedTaskIds.has(task.id));
      if (!completed) blockCompleted = false;
      // Everything in a locked block stays locked, even tasks solved early.
      statuses.set(topic.id, !open ? "locked" : completed ? "completed" : "current");
    }
    if (!blockCompleted) open = false;
  }
  return statuses;
}

// Where /learn sends the student: the first open unfinished topic, or the
// last one when the whole course is completed.
export function pickLandingTopic<T extends TopicRef>(
  topics: T[],
  statuses: Map<string, TopicStatus>,
): T | null {
  const sorted = [...topics].sort((a, b) => a.order_number - b.order_number);
  return sorted.find((topic) => statuses.get(topic.id) === "current") ?? sorted.at(-1) ?? null;
}
