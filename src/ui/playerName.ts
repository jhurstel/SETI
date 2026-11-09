const NAME_KEY = 'seti_player_name';

/** Dernier nom de joueur saisi (nouvelle partie ou partie en ligne), gardé dans le navigateur */
export function readPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function writePlayerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Stockage indisponible : le nom sera à ressaisir
  }
}
