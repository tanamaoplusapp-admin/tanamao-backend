'use strict';
// Foto do motorista: URL HTTPS recebida do upload do perfil.
// A aprovacao registra a versao apresentada ao administrador.
function fotoValida(url) {
  if (typeof url !== 'string' || !url.trim() || url.length > 2048) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && Boolean(u.hostname) && !u.username && !u.password;
  } catch (_) { return false; }
}
function fotoAprovada(perfil, user) {
  return fotoValida(user?.avatar) &&
    fotoValida(perfil?.fotoAprovadaUrl) &&
    user.avatar === perfil.fotoAprovadaUrl;
}
module.exports = { fotoValida, fotoAprovada };
