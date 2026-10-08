import { env } from 'cloudflare:workers';
export function missionDb(){if(!env.DB)throw new Error('Archivio temporaneamente non disponibile');return env.DB;}
