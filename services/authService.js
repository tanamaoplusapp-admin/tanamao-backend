// app/services/authService.js
import { api } from './api';

/**
 * Login genérico (empresa, cliente, profissional, motorista).
 * Resposta esperada: { token, user }
 */
async function login(email, password) {
  return api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * Cadastro de usuário (cliente/profissional/motorista via rota padrão)
 * Resposta: mensagem de verificação enviada
 */
async function registerUser(name, email, password) {
  return api('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

/** Verificação de e-mail (link do e-mail recebido) */
async function verifyEmail(token) {
  return api(`/api/auth/verify-email/${token}`, { method: 'GET' });
}

/** Esqueci minha senha */
async function forgotPassword(email) {
  return api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

/** Redefinir senha */
async function resetPassword(token, password) {
  return api(`/api/auth/reset-password/${token}`, {
    method: 'POST',
    body: { password },
  });
}

/**
 * Cadastro de Empresa
 * Envie os campos reais que temos no backend:
 * {
 *   nome, email, senha,
 *   cnpj (ou cpf), telefone,
 *   cidade, uf,
 *   faturamentoAnual, capitalSocial,
 *   porteEmpresa? ('mei' | 'pequena' | 'media' | 'grande') // opcional; backend normaliza
 * }
 */
async function registerEmpresa(payload) {
  return api('/api/companies/register', {
    method: 'POST',
    body: payload,
  });
}

export const authService = {
  login,
  registerUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  registerEmpresa,
};
