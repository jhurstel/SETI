import React from 'react';
import { Game, Planet, Satellite } from '../core/types';

interface PlanetsBoardProps {
  game: Game;
}

export const PlanetsBoard: React.FC<PlanetsBoardProps> = ({ game }) => {
  const planets = game.board.planets;

  return (
    <div className="seti-panel">
      <div className="seti-panel-title">Planètes</div>
      <div className="seti-planets-list">
        {planets.map((planet: Planet) => (
          <div key={planet.id} className="seti-planet-card">
            <div className="seti-planet-name">{planet.name}</div>
            <div className="seti-planet-details">
              <div className="seti-planet-pv">
                <span>Orbite: {planet.orbitFirstPV || 0} / {planet.orbitNextPV || 0} PV</span>
                <span>Atterrissage: {planet.landFirstPV || 0} / {planet.landNextPV || 0} PV</span>
              </div>
              {planet.satellites && planet.satellites.length > 0 && (
                <div className="seti-planet-satellites">
                  <div className="seti-satellites-title">Satellites:</div>
                  {planet.satellites.map((sat: Satellite) => (
                    <div key={sat.id} className="seti-satellite">
                      {sat.name} (+{sat.bonus.pv || 0} PV)
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


