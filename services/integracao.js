// app/services/integracao.js
import api from '../utils/api';

// Salva/atualiza credenciais e config do conector (ERP)
export const salvarCredenciaisERP = async (payload) => {
  // payload: { empresaId, provider, mode, baseUrl?, apiKey?, secret, mapping?, schedule? }
  const { data } = await api.post('/api/integracoes/erp/token', payload);
  return data;
};

// Status do conector (último sync, contagens, erros)
export const getStatusIntegracao = async (empresaId) => {
  const { data } = await api.get('/api/integracoes/status', { params: { empresaId } });
  return data;
};

// Upload de CSV para import em lote (modo Arquivo)
export const uploadCSVIntegracao = async (empresaId, file /* RNFS/DocumentPicker */) => {
  const form = new FormData();
  form.append('empresaId', empresaId);
  form.append('file', {
    uri: file.uri,
    name: file.name || 'produtos.csv',
    type: file.type || 'text/csv',
  });
  const { data } = await api.post('/api/integracoes/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// (Opcional) Testar a conexão (ping) — se o backend expuser
export const testarIntegracao = async (empresaId) => {
  const { data } = await api.post('/api/integracoes/test', { empresaId });
  return data;
};
