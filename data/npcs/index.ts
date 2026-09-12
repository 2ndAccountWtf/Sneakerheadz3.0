import type { AmbientNpcProfile } from '../../types/interactions';
import { ISRAELI_AF_CLERK } from './clerk-israeli';
import { GRANDMA_LACES } from './grandma-laces';
import { WIZ_K } from './wiz-k';
import { GUTTER_GABE } from './gutter-gabe';
import { PARIS_CLERK } from './clerk-paris';
import { BIBI } from './bibi';
import { TEL_AVIV_CLERK } from './clerk-tel-aviv';
import { NEW_YORK_CLERK } from './clerk-new-york';
import { LOS_ANGELES_CLERK } from './clerk-los-angeles';
import { CHICAGO_CLERK } from './clerk-chicago';
import { TOKYO_CLERK } from './clerk-tokyo';
import { TSA_AGENT } from './tsa-agent';
import { SCALPER_SID } from './scalper-sid';
import { SYSTEM_EVENTS } from './system-events';
import { STREET_EVENTS } from './street-events';
import { ADC } from './adc';


export const AMBIENT_NPCS: AmbientNpcProfile[] = [
    // Workers
    ISRAELI_AF_CLERK,
    TEL_AVIV_CLERK,
    NEW_YORK_CLERK,
    LOS_ANGELES_CLERK,
    PARIS_CLERK,
    CHICAGO_CLERK,
    TOKYO_CLERK,

    // Other Encounters
    GRANDMA_LACES,
    WIZ_K,
    GUTTER_GABE,
    BIBI,
    TSA_AGENT,
    SCALPER_SID,
    SYSTEM_EVENTS,
    STREET_EVENTS,
    ADC,
];