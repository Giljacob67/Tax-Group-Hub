import type { EmpresAquiResponse } from "./client.js";

// Definição tipada baseada no backend (vamos forçar compatibilidade frouxa para avoid imports circulares, ou usar partial)
// Este partial corresponde fisicamente ao InsertCrmContact
export function mapEmpresAquiToContact(data: EmpresAquiResponse): any {
  // Parsing regime tributário a partir dos booleanos (apenas palpite grosseiro dado pela API pública)
  let regime: string | null = null;
  if (data.mei?.optante) regime = "mei";
  else if (data.simples?.optante) regime = "simples";
  // Opcional: Se capital for muito grande poderíamos adivinhar lucro real, mas evite over-engineering sem dados confirmados.

  // Address assembly
  const e = data.endereco;
  const addressString = e ? `${e.logradouro}, ${e.numero}${e.complemento ? " " + e.complemento : ""} - ${e.bairro}` : null;

  // Sócios
  const mappedSocios = data.quadro_societario?.map(s => ({
    nome: s.nome,
    participacao: s.qualificacao
  })) || [];

  return {
    cnpj: data.cnpj.replace(/\D/g, ""), // ensure clean
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia || null,
    regimeTributario: regime,
    cnae: data.cnae_principal?.codigo || null,
    faturamentoEstimado: null, // Empres Aqui default doesn't provide reliable revenue usually on basic endpoint unless enriched
    porte: data.porte || null,
    uf: e?.uf || null,
    cidade: e?.municipio || null,
    endereco: addressString,
    cep: e?.cep?.replace(/\\D/g, "") || null,
    telefone: data.contatos?.telefone1 || data.contatos?.telefone2 || null,
    email: data.contatos?.email || null,
    website: null, // Basic endpoint usually misses URL
    socios: mappedSocios.length > 0 ? mappedSocios : null,
    aiScore: null,
    status: "prospect",
    source: "empresaqui",
    lastEnrichedAt: new Date(),
  };
}
