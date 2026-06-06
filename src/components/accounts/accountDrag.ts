// Shared drag-and-drop helpers for moving accounts between groups.
export const ACCOUNT_DRAG_TYPE = "application/x-account-id";

export function startAccountDrag(
  e: React.DragEvent,
  accountId: string,
): void {
  e.dataTransfer.setData(ACCOUNT_DRAG_TYPE, accountId);
  // Fallback for environments that only expose text/plain
  e.dataTransfer.setData("text/plain", accountId);
  e.dataTransfer.effectAllowed = "move";
}

export function readAccountDrag(e: React.DragEvent): string {
  return (
    e.dataTransfer.getData(ACCOUNT_DRAG_TYPE) ||
    e.dataTransfer.getData("text/plain")
  );
}
