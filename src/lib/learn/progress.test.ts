import { describe, expect, it } from "vitest";
import { computeTopicStatuses, pickLandingTopic, splitIntoBlocks } from "./progress";

const topics = [
  { id: "t1", order_number: 1 },
  { id: "t2", order_number: 2 },
  { id: "t3", order_number: 3 },
];
const tasks = [
  { id: "t1c", topic_id: "t1" },
  { id: "t1a", topic_id: "t1" },
  { id: "t2c", topic_id: "t2" },
  { id: "t2a", topic_id: "t2" },
  { id: "t3c", topic_id: "t3" },
  { id: "t3a", topic_id: "t3" },
];

// Blocks of one topic: each topic opens after the previous one.
function statuses(solved: string[], ts = topics, tks = tasks) {
  return Object.fromEntries(computeTopicStatuses(ts, tks, new Set(solved), [1, 1, 1]));
}

describe("computeTopicStatuses with one-topic blocks", () => {
  it("opens only the first topic when nothing is solved", () => {
    expect(statuses([])).toEqual({ t1: "current", t2: "locked", t3: "locked" });
  });

  it("keeps the topic current until both tasks are solved", () => {
    expect(statuses(["t1c"])).toEqual({ t1: "current", t2: "locked", t3: "locked" });
  });

  it("opens the next topic when both tasks are solved", () => {
    expect(statuses(["t1c", "t1a"])).toEqual({ t1: "completed", t2: "current", t3: "locked" });
  });

  it("does not open topics after an unfinished one, even if they have solved tasks", () => {
    expect(statuses(["t1c", "t1a", "t3c", "t3a"])).toEqual({
      t1: "completed",
      t2: "current",
      t3: "locked",
    });
  });

  it("marks everything completed when the course is done", () => {
    expect(statuses(tasks.map((t) => t.id))).toEqual({
      t1: "completed",
      t2: "completed",
      t3: "completed",
    });
  });

  it("uses sort order, not array order or number gaps", () => {
    const shuffled = [
      { id: "t5", order_number: 5 },
      { id: "t1", order_number: 1 },
      { id: "t2", order_number: 2 },
    ];
    const tks = [
      { id: "a", topic_id: "t1" },
      { id: "b", topic_id: "t2" },
      { id: "c", topic_id: "t5" },
    ];
    expect(statuses(["a"], shuffled, tks)).toEqual({ t1: "completed", t2: "current", t5: "locked" });
    expect(statuses(["a", "b"], shuffled, tks)).toEqual({
      t1: "completed",
      t2: "completed",
      t5: "current",
    });
  });

  it("treats a topic without tasks as not completed and blocks the rest", () => {
    const tks = tasks.filter((t) => t.topic_id !== "t2");
    expect(statuses(["t1c", "t1a", "t3c", "t3a"], topics, tks)).toEqual({
      t1: "completed",
      t2: "current",
      t3: "locked",
    });
  });

  it("handles an empty course", () => {
    expect(statuses([], [], [])).toEqual({});
  });
});

// The real course: 34 topics in blocks of 8, 8, 10 and 8 (school quarters).
const course = Array.from({ length: 34 }, (_, i) => ({ id: `T${i + 1}`, order_number: i + 1 }));
const courseTasks = course.flatMap((t) => [
  { id: `${t.id}c`, topic_id: t.id },
  { id: `${t.id}e`, topic_id: t.id },
]);
const solvedUpTo = (last: number) => courseTasks.filter((t) => Number(t.topic_id.slice(1)) <= last).map((t) => t.id);

function courseStatuses(solved: string[]) {
  const map = computeTopicStatuses(course, courseTasks, new Set(solved));
  const by = (status: string) => course.filter((t) => map.get(t.id) === status).map((t) => t.order_number);
  return { completed: by("completed"), current: by("current"), locked: by("locked") };
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("computeTopicStatuses with quarter blocks", () => {
  it("opens the whole first block at the start", () => {
    expect(courseStatuses([])).toEqual({ completed: [], current: range(1, 8), locked: range(9, 34) });
  });

  it("keeps the next block locked until every topic of the block is completed", () => {
    // Everything in 1-8 except one task of topic 5; topic 9 solved early does not count.
    const solved = [...solvedUpTo(8).filter((id) => id !== "T5e"), "T9c", "T9e"];
    expect(courseStatuses(solved)).toEqual({
      completed: range(1, 8).filter((n) => n !== 5),
      current: [5],
      locked: range(9, 34),
    });
  });

  it("opens 9-16 after 1-8, then 17-26, then 27-34", () => {
    expect(courseStatuses(solvedUpTo(8))).toEqual({ completed: range(1, 8), current: range(9, 16), locked: range(17, 34) });
    expect(courseStatuses(solvedUpTo(16))).toEqual({ completed: range(1, 16), current: range(17, 26), locked: range(27, 34) });
    expect(courseStatuses(solvedUpTo(26))).toEqual({ completed: range(1, 26), current: range(27, 34), locked: [] });
  });

  it("marks the whole course completed", () => {
    expect(courseStatuses(solvedUpTo(34))).toEqual({ completed: range(1, 34), current: [], locked: [] });
  });

  it("splits topics into blocks of 8, 8, 10, 8 and keeps extra topics in one more block", () => {
    expect(splitIntoBlocks(course).map((b) => b.length)).toEqual([8, 8, 10, 8]);
    expect(splitIntoBlocks(course, [30]).map((b) => b.length)).toEqual([30, 4]);
    expect(splitIntoBlocks([], [8])).toEqual([]);
  });
});

describe("pickLandingTopic", () => {
  it("returns the first open topic", () => {
    const s = computeTopicStatuses(course, courseTasks, new Set([...solvedUpTo(8), "T9c", "T9e"]));
    expect(pickLandingTopic(course, s)?.id).toBe("T10");
  });

  it("returns the current topic", () => {
    const s = computeTopicStatuses(topics, tasks, new Set(["t1c", "t1a"]), [1, 1, 1]);
    expect(pickLandingTopic(topics, s)?.id).toBe("t2");
  });

  it("returns the last topic when the course is completed", () => {
    const s = computeTopicStatuses(topics, tasks, new Set(tasks.map((t) => t.id)), [1, 1, 1]);
    expect(pickLandingTopic(topics, s)?.id).toBe("t3");
  });

  it("returns null without topics", () => {
    expect(pickLandingTopic([], new Map())).toBeNull();
  });
});
