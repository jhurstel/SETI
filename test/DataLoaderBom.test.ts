import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../src/core/DataLoader';
import { CardType } from '../src/core/types';
import { mockFetchFromPublic } from './helpers/gameFixture';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const FILES = ['cards/main.csv', 'cards/mascamites.csv', 'cards/anomalies.csv', 'cards/oumuamua.csv', 'cards/centauriens.csv', 'cards/exertiens.csv'];

describe('DataLoader : lecture des CSV sur disque (serveur du jeu en ligne)', () => {
  test('régression : le BOM des CSV ne fait plus lire l\'en-tête comme une carte « Nom »', async () => {
    // Le BOM est bien là : c'est lui qui trompait la détection de l'en-tête
    expect(fs.readFileSync(path.join(PUBLIC_DIR, FILES[0]), 'utf-8').charCodeAt(0)).toBe(0xfeff);

    const fetchSpy = mockFetchFromPublic();
    const fromFetch = await Promise.all(FILES.map(file => DataLoader.loadCards(file)));
    fetchSpy.mockRestore();

    // Lecture comme sur le serveur : fs.readFile en UTF-8 garde le BOM
    DataLoader.setReader(file => fs.promises.readFile(path.join(PUBLIC_DIR, file), 'utf-8'));
    const fromDisk = await Promise.all(FILES.map(file => DataLoader.loadCards(file)));

    fromDisk.forEach((cards, i) => {
      expect(cards.some(card => card.name === 'Nom')).toBe(false);
      expect(cards.map(card => card.id)).toEqual(fromFetch[i].map(card => card.id));
    });
  });
});

describe('DataLoader : valeurs inconnues', () => {
  afterAll(() => DataLoader.setReader(file => fs.promises.readFile(path.join(PUBLIC_DIR, file), 'utf-8')));

  test('un type de carte inconnu est lu comme indéfini, sans faire échouer le chargement', async () => {
    DataLoader.setReader(async () => 'Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte\n999;Essai;Inconnu;;;;;1;;\n');
    const [card] = await DataLoader.loadCards('cards/essai.csv');
    expect(card.id).toBe('999');
    expect(card.type).toBe(CardType.UNDEFINED);
  });
});
