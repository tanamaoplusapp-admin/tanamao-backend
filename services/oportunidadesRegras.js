'use strict';
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const id = v => String(v?._id || v || '');
const UFS = {acre:'AC',alagoas:'AL',amapa:'AP',amazonas:'AM',bahia:'BA',ceara:'CE','distrito federal':'DF','espirito santo':'ES',goias:'GO',maranhao:'MA','mato grosso':'MT','mato grosso do sul':'MS','minas gerais':'MG',para:'PA',paraiba:'PB',parana:'PR',pernambuco:'PE',piaui:'PI','rio de janeiro':'RJ','rio grande do norte':'RN','rio grande do sul':'RS',rondonia:'RO',roraima:'RR','santa catarina':'SC','sao paulo':'SP',sergipe:'SE',tocantins:'TO'};
const uf = v => { const s=norm(v); return UFS[s] || (Object.values(UFS).includes(s.toUpperCase()) ? s.toUpperCase() : ''); };
const city = v => norm(v).replace(/ /g,'-');
const isMobility = (p,c) => /^(motorista|motorista de aplicativo|mototaxista|motoboy|entregador|taxista|freteiro)(\b|$)/.test(norm(p?.nome)) || norm(c?.slug)==='transporte mobilidade';
const enabled = u => !!u && !['blocked','suspended','suspenso','bloqueado','inactive','deleted'].includes(norm(u.status)) && u.statusCadastro!=='reprovado' && u.perfilAtivo!==false && u.active!==false;
function allows(pref, gender){return !pref || pref==='todos' || (pref==='somente_mulheres' && gender==='feminino') || (pref==='somente_homens' && gender==='masculino');}
function matches(r,p,u,client){
 if(!p || !enabled(u) || !enabled(client) || u.receberServicos===false || p.status==='reprovado' || p.statusCadastro==='reprovado' || id(u._id)===id(r.cliente)) return false;
 if(!u.acessoExpiraEm || !(new Date(u.acessoExpiraEm).getTime()>Date.now()))return false;
 if(!r.cidadeSlug || !r.uf || city(p.endereco?.cidade||p.endereco?.cidadeSlug||u.cidade)!==r.cidadeSlug || uf(p.endereco?.estado||u.estado)!==r.uf) return false;
 if(![p.profissaoId,...(p.profissoesDetalhadas||[]).map(x=>x.profissaoId)].some(x=>id(x)===id(r.profissaoId))) return false;
 if(!allows(u.preferenciaAtendimento,client.genero)||!allows(client.preferenciaProfissional,u.genero))return false;
 // Only reject an explicitly incompatible delivery modality if the provider has configured one.
 const t=p.tipoAtendimento||{}; if(Object.values(t).some(x=>x===true) && !t[r.local])return false;
 if(r.prazo==='agora' && (p.aceitaServicoImediato===false || p.operationalStatus==='indisponivel'))return false;
 return true;
}
function rank(r,p){ return (p.online?12:0)+(r.prazo==='agora'&&p.atendeEmergencia?15:0)+(p.operationalStatus==='disponivel'?5:0)+Math.min(10,Number(p.metrics?.mediaAvaliacoes||0)*2)+Math.min(5,Number(p.metrics?.servicosFinalizados||0)); }
function cnpjValid(v){const n=String(v||'').replace(/\D/g,''); if(!/^\d{14}$/.test(n)||/^(\d)\1+$/.test(n))return false; function digit(s,w){let a=[...s].reduce((sum,x,i)=>sum+Number(x)*w[i],0)%11;return a<2?0:11-a;}return digit(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(n[12])&&digit(n.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(n[13]);}
function business(input={}){const tipo=input.tipoPrestador||'autonomo'; if(!['autonomo','mei','empresa'].includes(tipo))throw Error('Tipo de prestador inválido.'); const nome=String(input.nomeFantasia||'').trim().slice(0,100); const cnpj=String(input.cnpj||'').replace(/\D/g,''); if(tipo!=='autonomo'&&(!cnpjValid(cnpj)||nome.length<2))throw Error('Informe um CNPJ válido e o nome comercial.'); return {tipoPrestador:tipo,nomeFantasia:nome,cnpj:tipo==='autonomo'?undefined:cnpj};}
module.exports={norm,id,city,uf,isMobility,enabled,allows,matches,rank,business,cnpjValid};
