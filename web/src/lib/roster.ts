import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PersonaRecord, RunSnapshot, SeatRecord } from '../api/model';
import fixtureSnapshot from '../../fixtures/run.snapshot.json';

const fixture = fixtureSnapshot as unknown as RunSnapshot;

/** The roster and seat order from the server, falling back to the bundled fixture when offline. */
export function useRosterAndSeats(): { roster: PersonaRecord[]; seats: SeatRecord[]; fromServer: boolean } {
  const [state, setState] = useState<{ roster: PersonaRecord[]; seats: SeatRecord[]; fromServer: boolean }>({
    roster: fixture.roster,
    seats: fixture.seats,
    fromServer: false,
  });
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.roster(), api.seats()])
      .then(([roster, seats]) => {
        if (!cancelled && roster.length && seats.length) setState({ roster, seats, fromServer: true });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
