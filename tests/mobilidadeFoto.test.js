'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fotoValida,fotoAprovada}=require('../services/mobilidadeFoto');
const foto='https://res.cloudinary.com/example/image/upload/motorista_1.jpg';
const outra='https://res.cloudinary.com/example/image/upload/motorista_2.jpg';
test('foto de motorista precisa ser URL HTTPS',()=>{
 assert.equal(fotoValida(foto),true);
 for(const invalida of ['',null,undefined,'http://example.com/foto.jpg','file://img.jpg','javascript:alert(1)','https://user:pass@example.com/a.jpg'])
  assert.equal(fotoValida(invalida),false);
});
test('sem foto o motorista nao fica elegivel',()=>{
 assert.equal(fotoAprovada({fotoAprovadaUrl:null},{avatar:null}),false);
 assert.equal(fotoAprovada({fotoAprovadaUrl:foto},{avatar:null}),false);
 assert.equal(fotoAprovada({fotoAprovadaUrl:null},{avatar:foto}),false);
});
test('foto so vale se corresponder a versao aprovada pelo administrador',()=>{
 assert.equal(fotoAprovada({fotoAprovadaUrl:foto},{avatar:foto}),true);
 assert.equal(fotoAprovada({fotoAprovadaUrl:foto},{avatar:outra}),false);
});
