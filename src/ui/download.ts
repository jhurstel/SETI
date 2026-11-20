/**
 * Téléchargement d'un fichier JSON (sauvegarde de la partie, rapport de problème) : boîte « Enregistrer sous »
 * si le navigateur la propose (API File System Access : Chrome, Edge), sinon téléchargement par un lien.
 */

/** API File System Access : absente des types DOM standards */
type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }> }>;
};

/** Enregistre `content` ; rend false si le joueur a annulé la boîte « Enregistrer sous » */
export async function downloadJson(content: string, fileName: string, description: string): Promise<boolean> {
  const { showSaveFilePicker } = window as WindowWithSavePicker;
  if (showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description, accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false; // Annulation du joueur
      // Sinon : téléchargement par un lien
    }
  }

  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  return true;
}
