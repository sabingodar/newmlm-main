import {fail} from './validation.mjs';

export const registrationDefaults = {earth: true, sky: true};

export function validateRegistrationSettings(input) {
 if (!input || typeof input.earth !== 'boolean' || typeof input.sky !== 'boolean') fail('Choose whether Earth and Sky registration are enabled');
 return {earth: input.earth, sky: input.sky};
}

export async function readRegistrationSettings(client, lock = false) {
 const {rows:[row]} = await client.query("SELECT data->'registrationSettings' AS settings FROM settings WHERE id=1" + (lock ? ' FOR SHARE' : ''));
 return {...registrationDefaults,...row?.settings};
}
