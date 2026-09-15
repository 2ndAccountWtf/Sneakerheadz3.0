/**
 * The world that refuses to acknowledge the gunfight.
 *
 * This is the whole joke, and it is a *rule* before it is a feature: **a
 * background actor never reacts to the player.** Not to being shot near, not to
 * an explosion, not to the boss. A coffee crew that flinches is a game element.
 * A coffee crew that carries on is the joke, and the moment one of them notices
 * you, the bit is dead.
 *
 * The single exception is authored and rare: everybody ducks at a blast, and is
 * back to coffee two seconds later — see `DUCK`. That works precisely because
 * it is scripted and brief. A reaction that happened every time would just be
 * awareness with extra steps.
 *
 * Nothing here has a hitbox, takes damage, or blocks anything. They cannot be
 * shot, and shots pass through them, because a player who learns the scenery is
 * shootable will spend the level shooting scenery.
 */

/** Which plane an actor lives on. Only `mid` is ever interactive. */
export type Layer = 'back' | 'mid';

export type ActorKind =
    | 'coffee'      // three or four men, a fingjan, tiny cups, total calm
    | 'shawarma'    // slicing. Always slicing.
    | 'sweeper'     // the same square metre of floor, for the entire level
    | 'balcony'     // spectators, pointing
    | 'porter'      // an impossible stack of boxes, wobbling
    | 'argument'    // two men, one disagreement, no resolution
    | 'donkey'      // indifferent
    | 'sheep';      // a flock, occasionally one going the wrong way

export interface ActorDef {
    kind: ActorKind;
    x: number;
    y?: number;
    layer?: Layer;
    /** Left or right. Wandering kinds ignore it and pick their own. */
    facing?: -1 | 1;
}

/**
 * How often each kind performs its rare beat, in expected seconds between.
 *
 * Long on purpose. The coffee crew pointing at the player is funny the first
 * time and furniture by the fourth, so it should be something a player sees
 * once in a run and tells somebody about.
 */
export const BEAT_EVERY: Record<ActorKind, number> = {
    coffee: 26,
    shawarma: 18,
    sweeper: 34,
    balcony: 22,
    porter: 14,
    argument: 20,
    donkey: 12,
    sheep: 16,
};

/** The rare beats, by kind. Cosmetic, every one. */
export const BEATS: Record<ActorKind, string[]> = {
    coffee: [
        'one of them points at the player, without urgency',
        'the pot goes round, nobody looks up',
        'one leans back to see past the fighting, then leans in again',
    ],
    shawarma: [
        'he looks up for half a second',
        'an enemy runs behind the counter; he moves the knife out of the way',
        'something rings off the tray. He does not look',
    ],
    sweeper: ['he sweeps the same patch again', 'he examines the patch, unsatisfied'],
    balcony: ['somebody leans further out', 'a second person arrives to watch', 'they go back inside, bored'],
    porter: ['the stack wobbles and does not fall', 'he adds one more box', 'he peers around the stack'],
    argument: ['one throws his hands up', 'they change sides and continue', 'a third man joins, briefly'],
    donkey: ['it stops dead in the aisle', 'it stares at an enemy until he walks around it', 'it kicks a gate open'],
    sheep: ['one stops and looks directly at the camera', 'one goes the wrong way', 'the flock bunches, then spills'],
};

/**
 * The one sanctioned reaction.
 *
 * Everybody ducks. Two seconds later, coffee. Rare and scripted so it reads as
 * a gag rather than as the scenery being aware of you.
 */
export const DUCK = { hold: 2, chance: 0.5 } as const;

export interface ActorState {
    def: ActorDef;
    /** Seconds until the next rare beat. */
    timer: number;
    /** Index into this kind's beat list, so a run does not repeat one twice. */
    beat: number;
    /** Seconds left ducking, if a blast went off nearby. */
    ducking: number;
}

export const openActor = (def: ActorDef, rng: () => number = Math.random): ActorState => ({
    def,
    // Staggered, or a street full of actors performs in unison.
    timer: BEAT_EVERY[def.kind] * (0.3 + rng() * 0.7),
    beat: Math.floor(rng() * BEATS[def.kind].length),
    ducking: 0,
});

export interface ActorStep {
    state: ActorState;
    /** A beat to play this frame, or null. Pure presentation. */
    beat: string | null;
}

/** Advances one actor. Never takes the player as an argument — by design. */
export function stepActor(state: ActorState, dt: number, rng: () => number = Math.random): ActorStep {
    if (state.ducking > 0) {
        return { state: { ...state, ducking: Math.max(0, state.ducking - dt) }, beat: null };
    }
    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, beat: null };

    const list = BEATS[state.def.kind];
    const beat = list[state.beat % list.length];
    return {
        state: {
            ...state,
            beat: state.beat + 1,
            timer: BEAT_EVERY[state.def.kind] * (0.7 + rng() * 0.6),
        },
        beat,
    };
}

/**
 * A blast went off. Some of them duck; the shawarma guy never does, because a
 * man who does not look up when a grenade lands is funnier than one who does.
 */
export function blastNear(state: ActorState, rng: () => number = Math.random): ActorState {
    if (state.def.kind === 'shawarma') return state;
    if (rng() > DUCK.chance) return state;
    return { ...state, ducking: DUCK.hold };
}

/** Actors are scenery. Nothing can shoot them and they block nothing. */
export const isInteractive = (): false => false;
