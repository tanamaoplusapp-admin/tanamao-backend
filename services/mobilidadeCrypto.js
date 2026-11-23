'use strict';
const crypto=require('node:crypto');
function key(){const hex=process.env.MOBILITY_DATA_KEY||'';if(!/^[a-f0-9]{64}$/i.test(hex)) {const e=new Error('Configure MOBILITY_DATA_KEY com 64 caracteres hexadecimais no Render.');e.status=503;throw e;}return Buffer.from(hex,'hex');}
function encrypt(text){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(String(text),'utf8'),cipher.final()]);return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),data.toString('hex')].join('.');}
function decrypt(text){const [a,b,c]=String(text||'').split('.');if(!a||!b||!c)throw new Error('Formato criptografado invalido');const d=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(a,'hex'));d.setAuthTag(Buffer.from(b,'hex'));return Buffer.concat([d.update(Buffer.from(c,'hex')),d.final()]).toString('utf8');}
function pin(){return String(crypto.randomInt(0,1000000)).padStart(6,'0');}
function comparePin(encrypted,candidate){if(!/^\d{6}$/.test(String(candidate||'')))return false;const expected=Buffer.from(decrypt(encrypted),'utf8');const actual=Buffer.from(String(candidate),'utf8');return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}
module.exports={encrypt,decrypt,pin,comparePin};
