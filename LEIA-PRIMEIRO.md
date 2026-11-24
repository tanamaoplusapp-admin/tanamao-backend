# Tanamão+ — Tarifas Normal + Comfort e cadastro nacional

Atualização de 24/11/2026. Extraia este pacote na RAIZ do **backend**.

## Nova proposta

- Corrida **Normal**: R$ 3,50 de bandeirada, R$ 1,60/km, R$ 0,15/min, **mínimo R$ 8,90** em Ponta Porã–MS.
- Para os outros municípios, a bandeirada, o minuto e o mínimo permanecem iguais; o quilômetro muda discretamente pela referência estadual/local de gasolina (faixa 94%–108% do preço-base). Os preços são PROPOSTAS e devem ser conferidos.
- Corrida **Comfort**: **Normal + 25%**, calculada na cotação existente do backend. Não é um nono `servico` e não requer tabela duplicada. Requer carro autorizado EXPRESSAMENTE para Comfort no painel (mais recente, elegível e com capacidade; consulte `mobilidadeComfort.js`).
- O mecanismo Comfort só é habilitado quando `MOBILITY_COMFORT_ENABLED=true`. O percentual padrão deste pacote passa a ser 25%; se `MOBILITY_COMFORT_MARKUP_PERCENT` estiver configurado, prevalece o valor existente. Defina-o como `25` no Render para garantir igualdade com a prévia.
- Não há preço dinâmico automático nos novos cadastros. Tarifas antigas continuam com sua configuração original.
- Entregas, motos e fretes NÃO tiveram suas bases alteradas nesta revisão.

### Exemplo sem preço dinâmico / sem pedágio (5 km e 10 min)

| Cidade | Normal | Comfort (25%) |
|---|---:|---:|
| Ponta Porã–MS | R$ 13,00 | R$ 16,25 |
| Campo Grande–MS | R$ 12,50 | R$ 15,63 |
| Dourados–MS | R$ 13,00 | R$ 16,25 |
| São Paulo–SP | R$ 12,65 | R$ 15,81 |
| Rio de Janeiro–RJ | R$ 12,90 | R$ 16,13 |

## Cobertura nacional sem digitar município por município

O script prepara **216 tarifas estaduais** (`cidade:'*'` para as 27 UFs x 8 modalidades) e **40 tarifas específicas** para cinco municípios de MS. Total: 256 registros. Uma cidade sem tarifa própria utiliza a tarifa de sua UF; não é preciso inserir cada município. O CSV completo por município é opcional e depende do IBGE.

ATENÇÃO: preços de combustível são referências de custo, NÃO preços oficiais de Uber, 99 ou Urban66.

## Primeiro: validar sem alterar o banco

```bash
node --test tests/tarifasBrasil.test.cjs tests/mobilidadeComfortPreco.test.cjs
node scripts/cadastrarTarifasBrasil.cjs --preview
```

### Publicar o script e os defaults

```bash
git add scripts/cadastrarTarifasBrasil.cjs tests/tarifasBrasil.test.cjs tests/mobilidadeComfortPreco.test.cjs services/mobilidadeComfort.js services/mobilidadeTarifasIniciais.js
git commit -m "Refina tarifas Normal e Comfort"
git push origin main
```

## Quando o Render estiver Live

Confira **primeiro** o nome real do banco MongoDB. O parâmetro abaixo usa o nome visto na implantação anterior, `TaNaMaoPlus`, e o script CANCELA se o banco conectado tiver outro nome.

Para **cadastrar sem ativar** (recomendado para revisão):

```bash
node scripts/cadastrarTarifasBrasil.cjs --aplicar --banco=TaNaMaoPlus --confirmar=CADASTRAR_TARIFAS_ESTIMADAS
```

Para cadastrar e **ativar apenas tarifas básicas novas** no momento da primeira importação (somente após validar os valores):

```bash
node scripts/cadastrarTarifasBrasil.cjs --aplicar --ativar-base --banco=TaNaMaoPlus --confirmar=CADASTRAR_TARIFAS_ESTIMADAS
```

**Se já rodou o script antigo de novembro** ou o módulo original de tarifas de Ponta Porã e deseja substituir apenas as sementes de carro Normal que ainda estão com os valores *exatamente iguais aos defaults antigos e sem edição administrativa*:

```bash
node scripts/cadastrarTarifasBrasil.cjs --aplicar --atualizar-sementes-antigas --banco=TaNaMaoPlus --confirmar=CADASTRAR_TARIFAS_ESTIMADAS
```

A atualização seletiva NÃO altera a propriedade `ativo` nem preço dinâmico e **não sobrescreve tarifas que foram editadas pelo administrador (`alteradoPor`) ou que tenham valores diferentes dos defaults conhecidos**. Por isso, se alguma tarifa específica ainda mostrar um valor antigo, revise-a conscientemente no painel; o script não deve sobrescrever preços próprios silenciosamente. Não confunda *cadastrar* com *aprovar*.

## Comfort no Render

Em **Environment**, defina:

```dotenv
MOBILITY_COMFORT_ENABLED=true
MOBILITY_COMFORT_MARKUP_PERCENT=25
```

O segundo item define o percentual de cobrança. Não define aprovação de carro. Para o app exibir a categoria, o backend também exige **motorista aprovado, online, veículo aprovado com `confortoAprovado=true` pela administração, condições de ano e lugares, e disponibilidade nas proximidades**.

## Aprovações

Este pacote NÃO modifica permissões de mototáxi, regiões, aprovação de motoristas ou documentos. Municípios continuam precisando de autorização MANUAL pelo painel e fundamentação legal. Nunca autoriza uma cidade só porque existe preço cadastrado.

## Reversão e cuidado

- Faça backup do backend antes de extrair o ZIP.
- O script **não conecta ao MongoDB** quando executado somente com `--preview`.
- Faça uma conferência de uma corrida de 1 km / 2 min (deve respeitar mínimo), outra 5 km / 10 min e uma Comfort com veículo realmente aprovado.
- Aplique o ZIP do app correspondente antes do próximo IPA e valide o fluxo de ponta a ponta.
