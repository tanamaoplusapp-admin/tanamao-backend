// app/services/api.js
import { Platform } from 'react-native';

// 🔧 Base URL (auto para emulador/simulador; pode sobrescrever via EXPO_PUBLIC_API_BASE_URL ou globalThis.API_BASE_URL)
const LOCAL_ANDROID = 'http://10.0.2.2:5000';   // Android emulator
const LOCAL_IOS     = 'http://localhost:5000';  // iOS simulator
const PROD          = 'https://backend-tanamao.onrender.com';

export const API_BASE_URL =
  globalThis.API_BASE_URL ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
  (__DEV__ ? (Platform.OS === 'android' ? LOCAL_ANDROID : LOCAL_IOS) : PROD);

/**
 * api(path, { method, headers, body, token, timeout, query })
 * - body pode ser objeto, string ou FormData
 * - query é um objeto mapeado para querystring
 */
export async function api(
  path,
  { method = 'GET', headers = {}, body, token, timeout = 20000, query } = {}
) {
  // monta URL com querystring
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.append(k, String(v));
      }
    });
  }

  // abort por timeout
  const ctrl = new AbortController();
  const toId = setTimeout(() => ctrl.abort(new Error('timeout')), timeout);

  const reqHeaders = { Accept: 'application/json', ...headers };
  let payload;

  if (body instanceof FormData) {
    payload = body; // ⚠️ não setar Content-Type manualmente
  } else if (body !== undefined) {
    reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (token) reqHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers: reqHeaders,
    body: payload,
    signal: ctrl.signal,
  }).catch((e) => {
    clearTimeout(toId);
    throw e;
  });

  clearTimeout(toId);

  // tenta parsear JSON; se falhar, retorna texto
  let text = '';
  try { text = await res.text(); } catch (_) {}
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `Erro ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ===========================
 * Auth
 * =========================== */
export const auth = {
  register: (name, email, password) =>
    api('/api/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) =>
    api('/api/auth/login', { method: 'POST', body: { email, password } }),
  verifyEmail: (token) =>
    api(`/api/auth/verify-email/${token}`, { method: 'GET' }),
  forgot: (email) =>
    api('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  reset: (token, password) =>
    api(`/api/auth/reset-password/${token}`, { method: 'POST', body: { password } }),
};

/* ===========================
 * Empresas
 * =========================== */
export const companies = {
  register: (payload) =>
    api('/api/companies/register', { method: 'POST', body: payload }),
  me: (token) => api('/api/companies/me', { token }),
  updateMe: (payload, token) =>
    api('/api/companies/me', { method: 'PUT', body: payload, token }),
  nearby: ({ lat, lng, radiusKm }, token) =>
    api('/api/companies/nearby', { token, query: { lat, lng, radiusKm } }),
  overview: (token) =>
    api('/api/companies/me/overview', { token }),
  assessPorte: (payload /* { cidade, uf, faturamentoAnual, capitalSocial, porteDeclarado? } */) =>
    api('/api/companies/porte/assess', { method: 'POST', body: payload }),
};

/* ===========================
 * Produtos
 * =========================== */
export const products = {
  create: (payload, token) =>
    api('/api/products', { method: 'POST', body: payload, token }),
  my: (token) => api('/api/products/meus', { token }),
  byId: (id) => api(`/api/products/${id}`),
  update: (id, payload, token) =>
    api(`/api/products/${id}`, { method: 'PUT', body: payload, token }),
  remove: (id, token) =>
    api(`/api/products/${id}`, { method: 'DELETE', token }),
};

/* ===========================
 * Pedidos
 * =========================== */
export const orders = {
  create: (payload, token) => // { products, total, empresaId, formaPagamento, ... }
    api('/api/orders', { method: 'POST', body: payload, token }),
  my: (token) => api('/api/orders/myorders', { token }),
  status: (pedidoId, token) =>
    api(`/api/orders/${pedidoId}/status`, { token }),
  updateStatus: (pedidoId, status, token) =>
    api(`/api/orders/${pedidoId}/status`, { method: 'PUT', body: { status }, token }),
};

/* ===========================
 * Comparação de orçamentos
 * =========================== */
export const comparacao = {
  // items: [{ productId, quantity }], lat/lng opcionais p/ frete
  comparar: ({ items, lat, lng }, token) =>
    api('/api/comparacao', {
      method: 'POST',
      body: { items },
      token,
      query: { lat, lng },
    }),
};

/* ===========================
 * Pagamentos (Mercado Pago)
 * =========================== */
export const pagos = {
  // PIX com split (empresaId obrigatório)
  // Exemplo de payload:
  // {
  //   value: 129.90,
  //   payer: { email, first_name, last_name, identification?: { type: 'CPF', number } },
  //   products: [{ productId, nome, quantidade, preco }],
  //   empresaId: '...',
  //   motoristaId?: '...',
  //   description?: 'Pedido ...'
  // }
  criarPix: (payload, token) =>
    api('/api/payment/pix', { method: 'POST', body: payload, token }),

  statusPagamento: (paymentId, token) =>
    api(`/api/payment/${paymentId}/status`, { token }),

  // Checkout Pro (cartão) — retorna init_point
  cardCheckout: (payload, token) =>
    api('/api/payment/card', { method: 'POST', body: payload, token }),
};

/* ===========================
 * Motorista
 * =========================== */
export const motorista = {
  validarCNH: (payload, token) =>
    api('/api/motorista/validar-cnh', { method: 'POST', body: payload, token }),
  documentos: (payload, token) =>
    api('/api/motorista/documentos', { method: 'PUT', body: payload, token }),
  perfil: (token) => api('/api/motorista/perfil', { token }),
  atualizarPerfil: (payload, token) =>
    api('/api/motorista/perfil', { method: 'PUT', body: payload, token }),
  resumo: (token) => api('/api/motorista/resumo', { token }),
  pedidos: (tipo, token) =>
    api('/api/motorista/pedidos', { token, query: { tipo } }),
};

/* ===========================
 * Chat
 * =========================== */
export const chat = {
  novo: (destinatarioId, token) =>
    api('/api/chat/novo', { method: 'POST', token, body: { destinatarioId } }),
  meus: (token) => api('/api/chat/meus', { token }),
  enviar: (chatId, { texto, imagemUrl }, token) =>
    api(`/api/chat/${chatId}/mensagem`, { method: 'POST', token, body: { texto, imagemUrl } }),
  mensagens: (chatId, token) =>
    api(`/api/chat/${chatId}/mensagens`, { token }),
};

/* ===========================
 * Reviews (profissionais/motoristas)
 * =========================== */
export const reviews = {
  create: (payload, token) => // { clientId, professionalId, rating, comment }
    api('/api/reviews', { method: 'POST', body: payload, token }),
  byProfessional: (professionalId) =>
    api(`/api/reviews/${professionalId}`),
};

/* ===========================
 * Mensalidade
 * =========================== */
export const mensalidade = {
  cobrar: (metodo, token) =>
    api('/api/mensalidade/cobrar', { method: 'POST', token, body: { metodo } }),
};

/* ===========================
 * Healthcheck
 * =========================== */
export const health = () => api('/health');
