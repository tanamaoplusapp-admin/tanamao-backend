// models/Empresa.js
// Camada de compatibilidade: reaproveita o schema/model "Company" e
// adiciona campos/virtuais somente quando necessário, evitando conflitos.

const mongoose = require('mongoose');

let Company = require('./company');
Company = Company?.default || Company; // compat caso export default
const schema = Company.schema;

// Garante serialização de virtuais
if (!schema.get('toJSON')?.virtuals) schema.set('toJSON', { virtuals: true });
if (!schema.get('toObject')?.virtuals) schema.set('toObject', { virtuals: true });

// Adiciona campos apenas se não existirem
if (!schema.path('plano')) {
  schema.add({ plano: { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' } });
}
if (!schema.path('ativo')) {
  schema.add({ ativo: { type: Boolean, default: true } });
}

// Helper: cria virtual com segurança (não colide com path real)
function defineVirtualSafe(name, getter, setter) {
  if (schema.path(name) || schema.virtuals[name]) return false; // já existe campo real ou virtual
  const v = schema.virtual(name);
  if (getter) v.get(getter);
  if (setter) v.set(setter);
  return true;
}

// Alias de porte (somente se NÃO houver path real 'porte')
defineVirtualSafe(
  'porte',
  function () {
    return this.porteEmpresa;
  },
  function (v) {
    this.porteEmpresa = v;
  }
);

// Virtual "endereco":
// - Se NÃO existe campo real 'endereco', criamos virtual 'endereco' (obj compat).
// - Se JÁ existe campo real 'endereco', criamos 'enderecoCompat' para não conflitar.
const createdEndereco = defineVirtualSafe(
  'endereco',
  function () {
    // Se this.endereco for string, tratamos como logradouro
    const eRaw = this.endereco;
    const asObj = eRaw && typeof eRaw === 'object' ? eRaw : {};
    const rua =
      asObj.logradouro ??
      asObj.rua ??
      (typeof eRaw === 'string' ? eRaw : null);

    return {
      cep: asObj.cep ?? null,
      logradouro: rua,
      numero: asObj.numero ?? null,
      complemento: asObj.complemento ?? null,
      bairro: asObj.bairro ?? null,
      cidade: asObj.cidade ?? this.cidade ?? null,
      estado: asObj.estado ?? asObj.uf ?? this.uf ?? null,
    };
  },
  function (v) {
    if (!v || typeof v !== 'object') return;
    if (v.logradouro || v.rua) this.endereco = String(v.logradouro || v.rua).trim();
    if (v.cidade) this.cidade = String(v.cidade).trim();
    if (v.estado || v.uf) this.uf = String(v.estado || v.uf).trim().toUpperCase();
  }
);

// Se não pudermos criar 'endereco' (porque existe path real), criamos 'enderecoCompat'
if (!createdEndereco) {
  defineVirtualSafe(
    'enderecoCompat',
    function () {
      const eRaw = this.endereco;
      const asObj = eRaw && typeof eRaw === 'object' ? eRaw : {};
      const rua =
        asObj.logradouro ??
        asObj.rua ??
        (typeof eRaw === 'string' ? eRaw : null);

      return {
        cep: asObj.cep ?? null,
        logradouro: rua,
        numero: asObj.numero ?? null,
        complemento: asObj.complemento ?? null,
        bairro: asObj.bairro ?? null,
        cidade: asObj.cidade ?? this.cidade ?? null,
        estado: asObj.estado ?? asObj.uf ?? this.uf ?? null,
      };
    },
    function (v) {
      if (!v || typeof v !== 'object') return;

      // Se existir path real 'endereco' e ele for string, sincroniza logradouro
      if (schema.path('endereco')) {
        if (typeof this.endereco === 'string' && (v.logradouro || v.rua)) {
          this.endereco = String(v.logradouro || v.rua).trim();
        }
      } else {
        // Caso contrário, manteria como objeto (se um dia virar objeto real)
        this.endereco = this.endereco || {};
        if (v.logradouro || v.rua) this.endereco.logradouro = String(v.logradouro || v.rua).trim();
        if (v.numero) this.endereco.numero = String(v.numero).trim();
        if (v.complemento) this.endereco.complemento = String(v.complemento).trim();
        if (v.bairro) this.endereco.bairro = String(v.bairro).trim();
        if (v.cep) this.endereco.cep = String(v.cep).trim();
      }

      if (v.cidade) this.cidade = String(v.cidade).trim();
      if (v.estado || v.uf) this.uf = String(v.estado || v.uf).trim().toUpperCase();
    }
  );
}

module.exports = Company;
