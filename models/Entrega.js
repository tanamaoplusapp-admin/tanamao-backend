// models/Entrega.js
const mongoose = require('mongoose');

const Any = mongoose.Schema.Types.Mixed;

const EntregaSchema = new mongoose.Schema(
  {
    // associação
    motoristaId: { type: String, index: true }, // usamos String p/ aceitar uid externo ou ObjectId serializado
    empresaId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
    clienteId:   { type: String },

    // nomes "denormalizados" p/ facilitar cards/listas
    empresaNome:  { type: String },
    clienteNome:  { type: String },

    // status
    status:      { type: String, default: 'Pendente' }, // Pendente | Aceito | Aguardando Coleta | Em Rota | Saiu para Entrega | Entregue
    statusIndex: { type: Number, default: 0 },          // 0..5 conforme mapeamento do controller

    // valores / feedback
    precoEntrega:        { type: Number, default: 0 },
    avaliacaoMotorista:  { type: Number, min: 0, max: 5 },

    // endereços
    endereco:        { type: Any }, // compat legado
    enderecoEntrega: { type: Any },
    destino:         { type: Any }, // ex.: { endereco: {...} }

    // imagens/arquivos
    arquivos: { type: [Any], default: [] },

    // datas
    criadoEm: { type: Date, default: Date.now },
    concluidoEm: { type: Date },
  },
  { timestamps: true }
);

// Índices úteis
EntregaSchema.index({ motoristaId: 1, status: 1 });
EntregaSchema.index({ empresaId: 1, createdAt: -1 });

// Normalização simples antes de salvar
EntregaSchema.pre('save', function (next) {
  if (typeof this.status === 'string') {
    const s = this.status.toLowerCase();
    if (s.includes('entregue')) this.statusIndex = 5;
    else if (s.includes('saiu')) this.statusIndex = 4;
    else if (s.includes('rota')) this.statusIndex = 3;
    else if (s.includes('aguardando')) this.statusIndex = 2;
    else if (s.includes('aceito')) this.statusIndex = 1;
    else this.statusIndex = 0;
  }
  next();
});

module.exports = mongoose.models.Entrega || mongoose.model('Entrega', EntregaSchema);
