// app/services/promocoes.js
// Integração com /api/promocoes
import api from './api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Lista promoções com filtros e paginação.
 * @param {Object} params
 * @param {string} [params.companyId]
 * @param {boolean} [params.ativo]
 * @param {boolean} [params.validas] // se true, somente validade >= hoje
 * @param {string} [params.q]        // busca por produto
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 */
export async function listPromocoes(params = {}) {
  const res = await api.get('/promocoes', { params });
  // O backend retorna { items, page, pageSize, total, totalPages }
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    page: Number(res?.page ?? params.page ?? 1),
    pageSize: Number(res?.pageSize ?? params.pageSize ?? 20),
    total: Number(res?.total ?? 0),
    totalPages: Number(res?.totalPages ?? 0),
  };
}

/** Busca uma promoção por ID. */
export async function getPromocao(id) {
  if (!id) throw new Error('ID obrigatório');
  return await api.get(`/promocoes/${encodeURIComponent(id)}`);
}

/**
 * Cria uma promoção.
 * Campos esperados: { produto, precoOriginal, precoPromocional, validade, companyId, ativo? }
 */
export async function createPromocao(payload) {
  if (!payload?.produto) throw new Error('produto é obrigatório');
  if (payload?.precoOriginal == null) throw new Error('precoOriginal é obrigatório');
  if (payload?.precoPromocional == null) throw new Error('precoPromocional é obrigatório');
  if (!payload?.validade) throw new Error('validade é obrigatória');
  if (!payload?.companyId) throw new Error('companyId é obrigatório');
  return await api.post('/promocoes', payload);
}

/** Atualiza uma promoção por ID. */
export async function updatePromocao(id, payload) {
  if (!id) throw new Error('ID obrigatório');
  return await api.patch(`/promocoes/${encodeURIComponent(id)}`, payload);
}

/** Exclui uma promoção por ID. */
export async function deletePromocao(id) {
  if (!id) throw new Error('ID obrigatório');
  return await api.delete(`/promocoes/${encodeURIComponent(id)}`);
}

/* =========================
 * React Query – Hooks
 * ========================= */

/** Hook: lista promoções (com cache por chave de consulta). */
export function usePromocoes(params = {}) {
  const key = ['promocoes', params];
  return useQuery({
    queryKey: key,
    queryFn: () => listPromocoes(params),
    staleTime: 30_000, // 30s
    keepPreviousData: true,
  });
}

/** Hook: detalhe de uma promoção. */
export function usePromocao(id, enabled = true) {
  const key = ['promocoes', 'one', id];
  return useQuery({
    queryKey: key,
    queryFn: () => getPromocao(id),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}

/** Hook: criar promoção (invalida lista da empresa). */
export function useCreatePromocao(invalidateParams = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPromocao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promocoes', invalidateParams] });
    },
  });
}

/** Hook: atualizar promoção. */
export function useUpdatePromocao(invalidateParams = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updatePromocao(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['promocoes', invalidateParams] });
      qc.invalidateQueries({ queryKey: ['promocoes', 'one', vars?.id] });
    },
  });
}

/** Hook: excluir promoção. */
export function useDeletePromocao(invalidateParams = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePromocao,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['promocoes', invalidateParams] });
      qc.removeQueries({ queryKey: ['promocoes', 'one', id] });
    },
  });
}
