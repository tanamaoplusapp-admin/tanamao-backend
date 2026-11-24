'use strict';
// Valores ilustrativos para HOMOLOGACAO. Aplicar somente por acao administrativa
// consciente; nunca sobrescreve tarifa ja existente.
const VALORES = Object.freeze([
  ['corrida_carro',350,160,15,890],
  ['corrida_moto',290,125,12,790],
  ['entrega_carro',590,185,16,1290],
  ['entrega_moto',340,120,10,790],
  ['frete_local',1190,250,18,1990],
  ['frete_intermunicipal',1800,290,0,2990],
  ['frete_interestadual',3200,400,0,5900],
  ['frete_internacional',2200,310,0,3200],
]);
function planos(region={cidade:'ponta pora',uf:'MS'}){
 return VALORES.map(([servico,bandeiradaCentavos,porKmCentavos,porMinutoCentavos,minimoCentavos])=>({
  servico,cidade:region.cidade,uf:region.uf,bandeiradaCentavos,porKmCentavos,porMinutoCentavos,
  minimoCentavos,porKgCentavos:0,porM3Centavos:0,ativo:true,dinamicaAtiva:servico!=='corrida_carro'&&(servico.startsWith('corrida_')||servico.startsWith('entrega_')),
 }));
}
module.exports={planos};
