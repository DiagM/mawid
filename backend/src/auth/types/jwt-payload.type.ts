/**
 * Payload qu'on stocke dans le JWT.
 * RAPPEL : le JWT n'est PAS chiffré, juste signé. Donc ce contenu est
 * lisible par n'importe qui qui a le token. Jamais de mot de passe, jamais
 * d'info sensible ici.
 */
export interface JwtPayload {
  sub: string; // "subject" : convention JWT pour l'ID de l'utilisateur
  phone: string;
  role: 'MANAGER' | 'ADMIN';
}