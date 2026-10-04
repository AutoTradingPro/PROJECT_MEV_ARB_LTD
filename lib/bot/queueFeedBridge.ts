import type { Opportunity } from "@/lib/bot/types";

type QueuedFeedPublisher = (items: Opportunity[]) => void;

let publisher: QueuedFeedPublisher | null = null;

/** Dipasang proses yang memegang stream ws://4101. Klien browser tidak mendaftar. */
export function registerQueuedFeedPublisher(fn: QueuedFeedPublisher): void {
  publisher = fn;
}

export function publishQueuedScanRoutes(items: Opportunity[]): void {
  publisher?.(items);
}
