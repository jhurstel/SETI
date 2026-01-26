import { Game, ActionType, ValidationResult } from '../core/types';

export interface IAction {
    readonly type: ActionType;
    readonly playerId: string;
    validate(game: Game): ValidationResult;
    execute(game: Game): Game;
}

export abstract class BaseAction implements IAction {
    constructor(public readonly playerId: string, public readonly type: ActionType) {}

    abstract validate(game: Game): ValidationResult;
    abstract execute(game: Game): Game;
}
