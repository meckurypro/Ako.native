import { EmptyState } from "./EmptyState";
export function ErrorState({ message = "Something went wrong. Please try again.", onRetry }: { message?: string; onRetry?: () => void }) { return <EmptyState icon="alert-circle-outline" title="Couldn’t load this" message={message} actionLabel={onRetry ? "Try again" : undefined} onAction={onRetry} />; }
