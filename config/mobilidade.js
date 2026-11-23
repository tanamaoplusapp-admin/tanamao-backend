'use strict';

// Novo modulo opt-in: nao altera o cadastro tradicional ou o papel User.role.
const SERVICES = Object.freeze([
  'corrida_carro', 'corrida_moto', 'entrega_moto', 'entrega_carro',
  'frete_local', 'frete_intermunicipal', 'frete_interestadual', 'frete_internacional',
]);
const VEHICLES = Object.freeze(['moto', 'carro', 'utilitario', 'van', 'caminhao']);
const MODALITIES = Object.freeze(['corrida', 'entrega', 'frete']);
const enabled = () => process.env.MOBILITY_MODULE_ENABLED === 'true';
const approximateEnabled = () => process.env.MOBILITY_ALLOW_APPROXIMATE_ROUTES === 'true' &&
  (process.env.NODE_ENV !== 'production' || Boolean(String(process.env.MOBILITY_BETA_USER_IDS || '').trim()));
const betaAllowed = (userId, role) => {
  if(role === 'admin') return true;
  const ids = String(process.env.MOBILITY_BETA_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !ids.length || ids.includes(String(userId || ''));
};
const motoPassengerAllowed = (city, uf) => {
  if (process.env.MOBILITY_MOTO_PASSENGER_ENABLED !== 'true') return false;
  const location = `${String(city || '').trim().toLowerCase()},${String(uf || '').trim().toUpperCase()}`;
  return (process.env.MOBILITY_MOTO_APPROVED_CITIES || '')
    .split(';').map(x => x.trim().toLowerCase()).includes(location.toLowerCase());
};
const serviceVehicleCompatible = (service, type) => ({
  corrida_carro: ['carro'], corrida_moto: ['moto'],
  entrega_moto: ['moto'], entrega_carro: ['carro', 'utilitario', 'van'],
  frete_local: ['carro', 'utilitario', 'van', 'caminhao'],
  frete_intermunicipal: ['carro', 'utilitario', 'van', 'caminhao'],
  frete_interestadual: ['carro', 'utilitario', 'van', 'caminhao'],
  frete_internacional: ['carro', 'utilitario', 'van', 'caminhao'],
})[service]?.includes(type) || false;

module.exports = { SERVICES, VEHICLES, MODALITIES, enabled, approximateEnabled, betaAllowed, motoPassengerAllowed, serviceVehicleCompatible };
