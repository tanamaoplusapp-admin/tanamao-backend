// utils/validators.js

// mantém apenas dígitos
const ONLY_DIGITS = (s) => String(s || '').replace(/\D+/g, '');
const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const validarEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').toLowerCase());

// ---------------- CPF ----------------
function validarCPF(cpf) {
  cpf = ONLY_DIGITS(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;

  return r === parseInt(cpf[10], 10);
}

// ---------------- CNPJ ----------------
function validarCNPJ(cnpj) {
  cnpj = ONLY_DIGITS(cnpj);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calc = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) {
      soma += parseInt(base[i], 10) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = cnpj.slice(0, 12);
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj.endsWith(String(d1) + String(d2));
}

// ---------------- CNH (básico com dígitos verificadores) ----------------
function validarCNH(cnh) {
  const d = ONLY_DIGITS(cnh);
  if (d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;

  // DV1
  let soma = 0;
  for (let i = 0, peso = 9; i < 9; i++, peso--) soma += parseInt(d[i], 10) * peso;
  let dv1 = soma % 11;
  dv1 = dv1 > 9 ? 0 : dv1;

  // DV2
  soma = 0;
  for (let i = 0, peso = 1; i < 9; i++, peso++) soma += parseInt(d[i], 10) * peso;
  let dv2 = soma % 11;
  dv2 = dv2 > 9 ? 0 : dv2;

  return parseInt(d[9], 10) === dv1 && parseInt(d[10], 10) === dv2;
}

// ---------------- Outros ----------------
const validarCEP = (cep) => ONLY_DIGITS(cep).length === 8;
const validarTelefoneBR = (tel) => {
  const d = ONLY_DIGITS(tel);
  return d.length === 10 || d.length === 11; // com/sem nono dígito
};
const validarUF = (uf) => /^[A-Za-z]{2}$/.test(String(uf || ''));
const validarPlaca = (placa) => {
  const p = String(placa || '').toUpperCase().trim();
  // antigo: ABC-1234 | novo Mercosul: ABC1D23
  return /^[A-Z]{3}-?\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p);
};

module.exports = {
  ONLY_DIGITS,
  validarEmail,
  validarCPF,
  validarCNPJ,
  validarCNH,
  validarCEP,
  validarTelefoneBR,
  validarUF,
  validarPlaca,
  isObjectId,
  isNonEmptyString,
};
