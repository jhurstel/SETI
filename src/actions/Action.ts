import { Game, ActionType, ValidationResult, HistoryEntry, InteractionState } from '../core/types';

export interface IAction {
    readonly type: ActionType;
    readonly playerId: string;
    historyEntries: HistoryEntry[];
    newPendingInteractions: InteractionState[];
    validate(game: Game): ValidationResult;
    execute(game: Game): Game;
}

export abstract class BaseAction implements IAction {
    public historyEntries: HistoryEntry[] = [];
    public newPendingInteractions: InteractionState[] = [];

    constructor(public readonly playerId: string, public readonly type: ActionType) { }

    abstract validate(game: Game): ValidationResult;
    abstract execute(game: Game): Game;
}
