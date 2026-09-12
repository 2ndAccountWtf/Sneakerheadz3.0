
import type { AmbientNpcProfile, Scenario } from '../../types/interactions';
import { generateManifesto, generateProtest, generateGrievance, HISTORICAL_MISUSE, CATCHPHRASE } from '../../systems/adc/adcGenerator';

/**
 * ADC — "The Activist Department of Complaints"
 * ============================================
 * A travelling protester, unofficial tax collector and professional nuisance.
 * She is high-frequency, low-threat and completely unbearable: she costs you
 * minutes, energy and occasionally cash, and she gives back almost nothing.
 *
 * Design rules, in order of importance:
 *   1. ADC is the butt of every joke. The comedy is her total confidence
 *      combined with her total ignorance — never the subject she has seized on.
 *   2. Her sympathies are grotesquely misplaced. Given any historical event she
 *      will find the least relevant party involved and mourn them, briefly, and
 *      then move on before anyone can ask a follow-up.
 *   3. She only ever produces bad outcomes — except by accident (`adc-boycott`),
 *      or if you beat her at her own game (`adc-minigame`).
 *
 * She sits alongside Bibi Neta, Donald Drip and Yasser Abbasfat, all of whom
 * this game caricatures with equal contempt.
 */

// Placards are rolled once, at import, so a given run of the game has its own
// set of signs. Scenario nodes are static data, so this is the only moment we
// get to be procedural — hence three pre-seeded protest variants below.
const PROTEST_A = generateProtest();
const PROTEST_B = generateProtest();
const PROTEST_C = generateProtest();

const ADC_DIALOGUE = {
    greeting: [
        CATCHPHRASE,
        "Hi. Do you have two minutes? It's going to be more than two minutes.",
        "Before you go in there — are you aware of what that store is?",
        "I'm not blocking the door. I'm occupying the threshold. It's different.",
        "I'm going to need your attention and, at some point, your wallet.",
        "I'm from the Activist Department of Complaints. It's not a real department. That's the problem.",
        "You look like someone who has never interrogated their footwear.",
        "Don't apologise to me. Apologise structurally."
    ],
    grievances: [
        "Sneaker boxes are designed to make you feel small. I've done no research on this.",
        "Every price tag is a confession. Read them that way.",
        "The escalator only goes up for some people. Metaphorically. Also literally, it's broken.",
        "Shoelaces are the last acceptable form of bondage and nobody will say it.",
        "That mannequin has better shelf position than three other mannequins. Explain that.",
        "The weather is not neutral. Weather has never been neutral.",
        "Vending machines choose. That's the whole issue. They choose.",
        "You're standing on a privatised sidewalk and you're worried about MY tone.",
        "I don't dislike capitalism. I find it procedurally under-documented."
    ],
    taxation: [
        "This isn't a tax. It's a contribution. The difference is that you can't refuse a contribution.",
        "I'm authorised. By whom is a very privileged question.",
        "Everything can be solved by a committee. Committees need funding. Funding needs taxes. So.",
        "You have money, which means somebody else doesn't. I'm just closing the loop.",
        "If you can afford the shoes, you can afford the framework that regulates the shoes.",
        "I take cash, sympathy, or a signed pledge. Mostly cash.",
        "The money goes into a fund. The fund is me. The fund is doing important work.",
        "Consider this less a fee and more an apology with a number on it."
    ],
    history: [
        ...HISTORICAL_MISUSE.slice(0, 6),
        "I don't need to have read about something to have a position on it. That's gatekeeping."
    ],
    onBibi: [
        "Oh. HIM.",
        "That man is an oppressive sneaker-industrial complex wearing a suit.",
        "He says he 'sells shoes'. That's exactly what they're trained to say.",
        "I've never spoken to him and I already have a forty-page position paper.",
        "He wants order. Order is just chaos with a budget it won't disclose.",
        "I refuse to debate him. I will, however, talk about him constantly."
    ],
    onYasser: [
        "Now THAT man understands.",
        "He doesn't explain anything either. We're basically colleagues.",
        "I don't know what he's shouting. I know that he's right to shout it.",
        "We share a framework. Neither of us has written it down.",
        "He's the only one on this street engaging with the actual structure.",
        "YES. EXACTLY. Whatever he said."
    ],
    exit: [
        "I'll be back. I'm always back. That's the model.",
        "Think about what I said. Not the words. The systemic implications.",
        "This conversation will be included in my report.",
        "You've been noted. Not in a good way. Not in a specific way either.",
        "I have to go. There's a different store that also exists."
    ]
};

/**
 * Protest variants share one shape: sign, chant, three ways to respond, and
 * then nothing happens. The nothing is the payload — she is a tax on your time
 * rather than your bag, and the game should feel that.
 */
function makeProtestScenario(id: string, protest: { sign: string; chant: string; demand: string }): Scenario {
    const manifesto = generateManifesto();
    const nothingHappens = [
        { type: 'notification' as const, message: 'Nothing happens. Nothing was ever going to happen.', description: 'The protest continues without you, at you.' },
        { type: 'stat_change' as const, payload: { stat: 'energy', value: -3 }, description: 'You will not get those 45 seconds back.' },
    ];

    return {
        id,
        startNode: 'intro',
        nodes: {
            intro: {
                npcLine: `A woman stands outside the store holding a cardboard sign that reads:\n\n"${protest.sign}"\n\nShe is chanting, alone, slightly off the beat:\n"${protest.chant}"\n\nShe spots you. "Are you going in there?"`,
                choices: [
                    { playerLine: "Yeah. I'm buying shoes.", next: 'yeah' },
                    { playerLine: 'No.', next: 'no' },
                    { playerLine: 'Why are you protesting shoelaces?', next: 'why' },
                    { playerLine: '"What exactly are you asking for?"', next: 'manifesto' },
                ],
            },
            manifesto: {
                npcLine: `She brightens. This is the question she prepared for.\n\nShe reads from her phone, slowly, to the street:\n\n"${manifesto.demand}"\n\n"${manifesto.remedy}"\n\nShe looks up expectantly. A bus goes past. Nobody has stopped.`,
                outcomes: [
                    { type: 'notification', message: 'She asks if you would like to hear the second half. There is a second half.', description: '' },
                    { type: 'stat_change', payload: { stat: 'energy', value: -6 }, description: 'That was longer than 45 seconds.' },
                ],
            },
            yeah: {
                npcLine: `"Right. So you're aware, then." She writes something down. "I'll need ${protest.demand}, eventually. Not from you. Just in general."\n\nShe steps aside. She was never actually in the way.`,
                outcomes: nothingHappens,
            },
            no: {
                npcLine: `"Good." Pause. "Although not buying is also a choice made inside the system, so."\n\nShe resumes chanting. You were not the point.`,
                outcomes: nothingHappens,
            },
            why: {
                npcLine: '"Because you asking that question proves the problem."\n\nShe says this with the finality of someone who has just won a debate, and turns back to her sign.',
                outcomes: nothingHappens,
            },
        },
    };
}

export const ADC: AmbientNpcProfile = {
    id: 'adc',
    name: 'ADC',
    portraitUrl: 'https://picsum.photos/seed/adc/200',
    dialogue: ADC_DIALOGUE,
    scenarios: [
        // --- THE PROTESTS (three seeded variants; outcome is deliberately nil) ---
        makeProtestScenario('adc-protest', PROTEST_A),
        makeProtestScenario('adc-protest-2', PROTEST_B),
        makeProtestScenario('adc-protest-3', PROTEST_C),

        // --- THE CLIPBOARD ---
        // Static content can't read the player's cash, so the "5%" is a flat
        // $140 — roughly a twentieth of a mid-game wallet, and an outrage early.
        {
            id: 'adc-taxation',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'She approaches with a clipboard, and the clipboard is doing a lot of work.\n\n"Congratulations."',
                    choices: [
                        { playerLine: 'On what?', next: 'identified' },
                        { playerLine: '…Thanks?', next: 'identified' },
                        { playerLine: 'Keep walking.', next: 'follows' },
                    ],
                },
                identified: {
                    npcLine: '"You have been identified as economically advantaged."',
                    choices: [
                        { playerLine: 'I have $417.', next: 'exactly' },
                        { playerLine: 'Identified by who?', next: 'exactly' },
                    ],
                },
                exactly: {
                    npcLine: '"Exactly."\n\nShe turns the clipboard around. It says LUXURY SNEAKER EQUITY CONTRIBUTION in marker, over what was clearly a different form.\n\n"One hundred and forty. Today."',
                    choices: [
                        { playerLine: 'Fine. Take it.', next: 'pay' },
                        { playerLine: 'No.', next: 'refuse' },
                        { playerLine: "Let me explain how prices actually work —", next: 'explain' },
                        { playerLine: 'Where does the money go?', next: 'privileged' },
                    ],
                },
                privileged: {
                    npcLine: '"That\'s actually a very privileged question."\n\nShe lets that sit, as though it were an answer, and holds the clipboard a little closer.',
                    choices: [
                        { playerLine: 'Okay. Here.', next: 'pay' },
                        { playerLine: 'Still no.', next: 'refuse' },
                    ],
                },
                explain: {
                    // She cannot be argued with, but the attempt has to cost
                    // something or players will try it every single time.
                    npcLine: `You explain supply. You explain demand. You explain that you bought these at retail and that the store sets its own prices.\n\nShe nods throughout, warmly, and says: "${CATCHPHRASE}"\n\nYou try again. Eleven minutes pass. At one point she agrees with you, and then continues as though she hadn't.`,
                    outcomes: [
                        { type: 'stat_change', payload: { stat: 'energy', value: -14 }, description: 'Eleven minutes of the purest futility available on this street.' },
                    ],
                    choices: [
                        { playerLine: 'I give up. Take the money.', next: 'pay' },
                        { playerLine: 'I am leaving.', next: 'refuse' },
                    ],
                },
                pay: {
                    npcLine: '"Thank you. This will be redistributed." She puts it in her pocket. "I am the redistribution."',
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 140 }], description: 'Luxury Sneaker Equity Contribution, collected.' },
                        { type: 'notification', message: 'You receive a receipt. It is a torn corner of the clipboard form.', description: 'Not tax-deductible. Not tax-anything.' },
                    ],
                },
                refuse: {
                    npcLine: '"Interesting. So you\'re choosing violence."\n\nShe follows you for four blocks, narrating. People look. Some of them agree with her.',
                    outcomes: [
                        { type: 'heat', change: 6, description: 'A loud woman is describing your crimes in public, at length.' },
                        { type: 'streetCred', change: -2, description: 'Nobody wants to be seen being followed like that.' },
                        { type: 'stat_change', payload: { stat: 'energy', value: -5 }, description: 'Four blocks of narration.' },
                    ],
                },
                follows: {
                    npcLine: '"That\'s fine. I walk at the same speed as you." She does.\n\n"Congratulations," she says again, in step.',
                    choices: [
                        { playerLine: 'Fine. On what?', next: 'identified' },
                        { playerLine: 'Run.', next: 'run' },
                    ],
                },
                run: {
                    npcLine: 'You run. She does not. She simply continues at her original pace, saying things, and you can hear her for longer than makes sense.',
                    outcomes: [
                        { type: 'stat_change', payload: { stat: 'energy', value: -8 }, description: 'You sprinted from a woman with a clipboard.' },
                        { type: 'notification', message: 'She knows which store you went into. She will be outside it.', description: 'Nothing else happens. Somehow that is worse.' },
                    ],
                },
            },
        },

        // --- THE BOYCOTT ---
        // Her one genuinely useful outcome, and it must remain an accident: she
        // is trying to stop commerce and instead triggers a panic sale.
        {
            id: 'adc-boycott',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'She has organised a boycott of the store. The boycott consists of her, a folding table, and a laminated sign nobody has read.\n\n"This location is under boycott. Effective immediately. Effective since eleven."',
                    choices: [
                        { playerLine: "So I can't buy anything?", next: 'correct' },
                        { playerLine: 'Who organised this?', next: 'organised' },
                        { playerLine: 'Walk straight past her.', next: 'past' },
                    ],
                },
                organised: {
                    npcLine: '"A coalition." Pause. "Of me. But a coalition can be one person if the person is representative."',
                    choices: [
                        { playerLine: "So I can't buy anything?", next: 'correct' },
                    ],
                },
                correct: {
                    npcLine: '"Correct."\n\nShe sits down behind the folding table with the satisfaction of a woman who has just fixed the economy.',
                    choices: [
                        { playerLine: 'Wait it out.', next: 'payoff' },
                        { playerLine: 'Go in anyway.', next: 'payoff' },
                    ],
                },
                payoff: {
                    npcLine: 'Three minutes later, the manager comes out, sees one woman and a folding table, panics completely, and announces 70% OFF EVERYTHING — ALL DAY into the doorway.\n\nADC stands up. "You\'re welcome."\n\n"You\'re the worst person I\'ve ever met."\n\n"That\'s a deeply problematic thing to say."',
                    outcomes: [
                        { type: 'priceMarkup', multiplier: 0.3, duration: '24h', description: 'The store panic-sells everything at 70% off for a day.' },
                        { type: 'notification', message: 'ADC files this as a victory. It is, for once, a victory. For you.', description: 'She will never understand what she did.' },
                    ],
                },
                past: {
                    npcLine: 'You walk past her. She does not stop you — stopping people would be coercive, and she has a position on coercion.\n\nShe does, however, describe you to the street as you go.',
                    outcomes: [
                        { type: 'notification', message: 'The boycott holds. It holds because nobody was ever going to that store.', description: 'Nothing happens.' },
                        { type: 'stat_change', payload: { stat: 'energy', value: -3 }, description: 'Being described in public is tiring.' },
                    ],
                },
            },
        },

        // --- THE YASSER ALLIANCE ---
        // Two people agreeing loudly about nothing, each certain the other has
        // explained it. Neither of them ever will.
        {
            id: 'adc-yasser-alliance',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'ADC has found Yasser Abbasfat. Yasser is mid-rant, at volume, about something involving pigeons and the Gold Standard.\n\nShe is nodding so hard her clipboard is moving.\n\n"YES. EXACTLY."',
                    choices: [
                        { playerLine: 'Do you actually know what he\'s talking about?', next: 'ask' },
                        { playerLine: 'Watch this unfold.', next: 'escalate' },
                    ],
                },
                ask: {
                    npcLine: '"I don\'t need to know the specifics to know the direction."\n\nYasser: "THE WHOLE THING IS A SYSTEM!"\n\nADC, both hands up: "THANK YOU."',
                    choices: [
                        { playerLine: 'Neither of you has said anything.', next: 'escalate' },
                        { playerLine: 'Slowly back away.', next: 'escalate' },
                    ],
                },
                escalate: {
                    npcLine: '"THEY DO NOT WANT US TO UNDERSTAND IT!"\n\n"NO THEY DO NOT!"\n\n"AND THAT IS WHY!"\n\n"THAT IS EXACTLY WHY!"\n\nA small crowd has formed. Neither of them has explained anything. The crowd is also nodding.',
                    outcomes: [
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.07, target: { kind: 'model', value: 'global' }, description: 'The street cannot tell whether this is news. Prices twitch.' },
                        { type: 'streetCred', change: 4, description: 'You were visibly present at whatever that was.' },
                        { type: 'notification', message: 'The store behind them has closed early "due to the demonstration outside".', description: 'One woman, one megaphone, one shuttered retailer.' },
                        { type: 'heat', change: 5, description: 'Police arrive to find a crowd, two shouting people and you.' },
                    ],
                },
            },
        },

        // --- ADC vs BIBI ---
        // The ideological collision. He is confused; she is certain; the player
        // has to pick a side and the game only tracks one of those opinions.
        {
            id: 'adc-vs-bibi',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'ADC sees Bibi Neta across the street and stops mid-sentence.\n\n"Oh great. HIM."\n\nBibi, without turning: "Who invited this woman?"',
                    choices: [
                        { playerLine: 'Let them talk.', next: 'collision' },
                        { playerLine: 'Try to defuse this.', next: 'collision' },
                    ],
                },
                collision: {
                    npcLine: '"Your entire political philosophy is an oppressive sneaker-industrial complex."\n\n"I sell sneakers?"\n\n"That\'s exactly what capitalism wants you to think."\n\n"I literally don\'t understand this conversation."\n\nBoth of them turn to you.',
                    choices: [
                        { playerLine: '"She has a point."', next: 'sideAdc' },
                        { playerLine: '"He literally just sells shoes."', next: 'sideBibi' },
                        { playerLine: 'Say nothing and look at the floor.', next: 'sideNobody' },
                    ],
                },
                sideAdc: {
                    npcLine: 'ADC: "THANK you." She does not know what point she made.\n\nBibi looks at you for a long moment, files it away, and walks off.',
                    outcomes: [
                        { type: 'bibiApproval', change: -14, description: 'He remembers who sided with the clipboard.' },
                        { type: 'streetCred', change: -3, description: 'The street watched you agree with ADC out loud.' },
                        { type: 'notification', message: 'ADC now considers you an ally. This is not a good thing.', description: 'She will find you more often.' },
                    ],
                },
                sideBibi: {
                    npcLine: 'Bibi nods once. "Finally. Clarity."\n\nADC writes your description on the clipboard, underlines it twice, and asks whether you have considered the systemic implications of that.',
                    outcomes: [
                        { type: 'bibiApproval', change: 12, description: 'Clarity, in his view, is a form of loyalty.' },
                        { type: 'streetCred', change: 5, description: 'Publicly telling ADC to be quiet plays well.' },
                        { type: 'heat', change: 3, description: 'She is now describing you to a police officer, inaccurately.' },
                    ],
                },
                sideNobody: {
                    npcLine: 'You say nothing. Both of them assume you agree with them, which is somehow worse than either alternative.',
                    outcomes: [
                        { type: 'bibiApproval', change: -4, description: 'He does not respect the fence, as established.' },
                        { type: 'stat_change', payload: { stat: 'energy', value: -5 }, description: 'You stood in the middle of that for nine minutes.' },
                    ],
                },
            },
        },

        // --- THE DEBATE (mini-game) ---
        // The only route to anything good from her, by design: she generates
        // exclusively bad outcomes unless you beat her at something.
        {
            id: 'adc-minigame',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: `She plants the clipboard against her chest like a shield.\n\n"Fine. Debate me. Publicly. Live. Right here."\n\n"${generateGrievance()}"\n\n"That's my opening. Go."`,
                    choices: [
                        { playerLine: 'Take the debate.', next: 'debate' },
                        { playerLine: 'Refuse.', next: 'forfeit' },
                    ],
                },
                debate: {
                    npcLine: 'Someone produces a microphone from a tote bag. Someone else starts a livestream. There is, immediately, an audience.\n\nShe has never lost a debate, because she has never noticed losing one.',
                    outcomes: [
                        {
                            type: 'miniGame',
                            game: 'hypecast-roulette',
                            title: 'ADC vs You: The Debate',
                            config: { opponent: 'ADC', topic: 'the systemic implications of literally anything' },
                            description: 'The microphone comes on and the crowd goes quiet.',
                        },
                        { type: 'inventoryChange', condition: 'win', add: [{ kind: 'currency', value: 'cash', qty: 900 }], description: 'The crowd passes a hat around. For you. In front of her.' },
                        { type: 'streetCred', condition: 'win', change: 18, description: 'Someone clipped it. The clip is doing numbers.' },
                        { type: 'statusEffect', condition: 'win', effect: 'lucky', duration: '48h', label: 'Undefeated (vs ADC)', description: 'You beat her in public and the street knows it.' },
                        { type: 'notification', condition: 'win', message: 'ADC concedes nothing, but leaves the district for two days.', description: 'The closest she comes to an apology.' },
                        { type: 'inventoryChange', condition: 'lose', remove: [{ kind: 'currency', value: 'cash', qty: 250 }], description: 'You agreed to a settlement mid-sentence and cannot explain why.' },
                        { type: 'streetCred', condition: 'lose', change: -12, description: 'The clip is doing numbers. It is not your clip.' },
                        { type: 'stat_change', condition: 'lose', payload: { stat: 'energy', value: -15 }, description: 'She talked for forty minutes and you retained none of it.' },
                    ],
                },
                forfeit: {
                    npcLine: '"Declining to debate is itself a position."\n\nShe announces your forfeit to the street. The street, having nothing better to do, accepts her account of it.',
                    outcomes: [
                        { type: 'streetCred', change: -6, description: 'You lost a debate you did not have.' },
                        { type: 'notification', message: 'ADC records the result as a win. There was no contest.', description: 'Her record remains perfect.' },
                    ],
                },
            },
        },
    ],
};
