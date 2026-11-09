import { Bonus, DiskName, Probe, SectorNumber } from '../../core/types';
import { ResourceSystem } from '../../systems/ResourceSystem';

/** Récompense d'un spécimen Mascamite en texte, vide si le joueur n'a pas le droit de la voir */
export const specimenRewardText = (bonus: Bonus, visible: boolean) => visible ? ResourceSystem.formatBonus(bonus).join(', ') : '';

/** Sondes et capsules posées sur une case (position relative à son anneau) */
export const piecesAt = (probes: Probe[], disk: DiskName, sector: SectorNumber, level: number) => probes.filter(p =>
  p.solarPosition && p.solarPosition.disk === disk && p.solarPosition.sector === sector && (p.solarPosition.level || 0) === level);
