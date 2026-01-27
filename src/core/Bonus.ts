import { Bonus } from './types';

// Helper pour formater les bonus
export function formatBonus(bonus: Bonus) {
    if (!bonus) return null;
    const items = [];
    if (bonus.pv) items.push(`${bonus.pv} PV`);
    if (bonus.media) items.push(`${bonus.media} Média`);
    if (bonus.credits) items.push(`${bonus.credits} Crédit`);
    if (bonus.energy) items.push(`${bonus.energy} Énergie`);
    if (bonus.card) items.push(`${bonus.card} Pioche`);
    if (bonus.data) items.push(`${bonus.data} Donnée`);
    if (bonus.planetscan) items.push(`${bonus.planetscan} Scan (Planète)`);
    if (bonus.redscan) items.push(`${bonus.redscan} Scan Rouge`);
    if (bonus.yellowscan) items.push(`${bonus.yellowscan} Scan Jaune`);
    if (bonus.bluescan) items.push(`${bonus.bluescan} Scan Bleu`);
    if (bonus.blackscan) items.push(`${bonus.blackscan} Scan Noir`);
    if (bonus.probescan) items.push(`${bonus.probescan} Scan Sonde`);
    if (bonus.earthscan) items.push(`${bonus.earthscan} Scan Terre`);
    if (bonus.rowscan) items.push(`${bonus.rowscan} Scan Rangée`);
    if (bonus.deckscan) items.push(`${bonus.deckscan} Scan Pioche`);
    if (bonus.anyscan) items.push(`${bonus.anyscan} Scan Quelconque`);
    if (bonus.revenue) items.push(`${bonus.revenue} Réservation`);
    if (bonus.anycard) items.push(`${bonus.anycard} Carte`);
    if (bonus.redlifetrace) items.push(`Trace Rouge`);
    if (bonus.yellowlifetrace) items.push(`Trace Jaune`);
    if (bonus.bluelifetrace) items.push(`Trace Bleu`);
    if (bonus.anytechnology) items.push(`${bonus.anytechnology} Tech`);
    if (bonus.probe) items.push(`${bonus.probe} Sonde`);
    if (bonus.landing) items.push(`${bonus.landing} Atterrisseur`);
    return items;
};
