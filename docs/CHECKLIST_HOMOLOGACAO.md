# Checklist de homologação antes de publicar Mobilidade

- [ ] Branch ou serviço Render separado, com backup, usando **Node 20.x**.
- [ ] Backend de staging aponta para **MongoDB de staging**, nunca para a base dos clientes reais nos testes.
- [ ] Nenhum arquivo `.env` ou chave foi enviado ao Git.
- [ ] `MOBILITY_MODULE_ENABLED=false` no serviço público atual.
- [ ] Testar primeiro `MOBILITY_MODULE_ENABLED=true` com `MOBILITY_BETA_USER_IDS` preenchido.
- [ ] Manter `MOBILITY_MOTO_PASSENGER_ENABLED=false` até aprovação regulatória da localidade.
- [ ] `MOBILITY_DATA_KEY` gerada com 32 bytes aleatórios e guardada com backup seguro.
- [ ] Validar índice geoespacial e índice de solicitações no MongoDB de staging.
- [ ] Validar autenticação JWT de cliente, prestador e admin com `verifyToken` legado.
- [ ] Validar criação de perfil **Motorista** sem alterar roles existentes.
- [ ] Confirmar CNH, CRLV e RNTRC com revisão manual e documentos privados.
- [ ] Validar aprovação, rejeição, vencimento e revogação de motorista/veículo.
- [ ] Confirmar acesso por plano, incluindo expiração, bloqueio e dias por indicação.
- [ ] Confirmar pagamentos Pix, cartão e dinheiro usando preferências já existentes.
- [ ] Confirmar que o app nunca cobra, bloqueia ou movimenta dinheiro por viagem.
- [ ] Confirmar preferência bilateral de gênero e comportamento sem motorista elegível.
- [ ] Validar corrida, entrega, frete local, intermunicipal e interestadual com veículos elegíveis.
- [ ] Validar tarifa por distância, tempo e, para carga, peso/volume.
- [ ] Testar Routes API e **Google Geocoding API** em ambiente homologado, antes de liberar tarifas reais.
- [ ] Testar corrida na ausência de sinal GPS, offline, recusa, oferta expirada e cancelamento.
- [ ] Testar aceite simultâneo, código de embarque e código de entrega.
- [ ] Testar notificações FCM e atualizações Socket.IO com o cliente Expo Dev Client.
- [ ] Testar financeiro `hoje`, `semana`, `mes`, `total`, mantendo recebimento declaratório.
- [ ] Testar avaliação e impacto na reputação atual do profissional.
- [ ] Revisar proteção de dados sensíveis, período de retenção, logs e privacidade.
- [ ] Revisar obrigações municipais do transporte de passageiros e da ANTT para cargas.
- [ ] Planejar rastreamento em segundo plano no iOS/Android e preparar development build própria **sem migrar o SDK 54**.
- [ ] Integrar a Home de Mobilidade, o painel ADM e a **ServicosHomeScreen** ativa do cliente.

## Limitações nesta entrega

Testes unitários/isolados e verificação de sintaxe executados. **Não há certificação de funcionamento end-to-end contra MongoDB/Render**, porque o ambiente não tem as credenciais de staging e a instalação completa via npm ficou indisponível por falha de acesso ao registro de pacotes. O deploy e testes reais precisam ocorrer no ambiente do usuário.
