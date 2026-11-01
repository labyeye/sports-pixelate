// Replaces the browser's confirm(): `await confirmDialog("Delete this?")`
// shows the in-app dialog mounted once as <ConfirmHost />.
type Opener = (message: string) => Promise<boolean>;
let opener: Opener | null = null;

export const registerConfirmOpener = (fn: Opener | null) => {
  opener = fn;
};

export async function confirmDialog(message: string): Promise<boolean> {
  // Falls back to the native dialog if the host is not mounted yet.
  return opener ? opener(message) : window.confirm(message);
}
