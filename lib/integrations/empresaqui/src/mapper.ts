import type { EmpresAquiResponse } from "./client.js";
import { PORTE_MAP, REGIME_MAP } from "./client.js";

/**
 * Extrai sócios das chaves numéricas do objeto raiz da resposta EmpresAqui.
 * A API não usa um array socios[] — os sócios são chaves "0", "1", "2"...
 */
function extractSocios(data: EmpresAquiResponse) {
  const socios: Array<{ nome: string; cpf?: string; participacao?: string }> = [];
  let i = 0;
  while (data[String(i)] && typeof data[String(i)] === "object") {
    const s = data[String(i)];
    if (s.socios_nome) {
      socios.push({
        nome: s.socios_nome,
        cpf: s.socios_cpf_cnpj || undefined,
        participacao: s.socios_qualificacao || undefined,
      });
    }
    i++;
  }
  return socios.length > 0 ? socios : null;
}

/**
 * Formata telefone a partir de DDD + número.
 */
function buildPhone(ddd?: string, tel?: string): string | null {
  if (!tel) return null;
  return ddd ? `(${ddd}) ${tel}` : tel;
}

/**
 * Converte endereço para string legível.
 */
function buildAddress(data: EmpresAquiResponse): string | null {
  const parts = [
    data.log_tipo && data.log_nome ? `${data.log_tipo} ${data.log_nome}` : data.log_nome,
    data.log_num,
    data.log_comp,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Determina regime tributário a partir dos campos opcao_simples, opcao_mei e regime_tributario.
 */
function resolveRegime(data: EmpresAquiResponse): string | null {
  if (data.opcao_mei === "S") return "mei";
  if (data.opcao_simples === "S") return "simples";
  if (data.regime_tributario) {
    return REGIME_MAP[data.regime_tributario] || null;
  }
  return null;
}

/**
 * Mapeia a resposta bruta da API EmpresAqui para os campos da tabela crm_contacts.
 */
export function mapEmpresAquiToContact(data: EmpresAquiResponse): Record<string, any> {
  // Tornar altamente defensivo: converter para string o que pode vir como número
  const str = (val: any) => val != null ? String(val).trim() : null;
  
  const rawPorte = str(data.porte);
  const resolvedPorte = rawPorte ? (PORTE_MAP[rawPorte] || rawPorte) : null;

  const phone = buildPhone(str(data.ddd_1) || undefined, str(data.tel_1) || undefined) || buildPhone(str(data.ddd_2) || undefined, str(data.tel_2) || undefined);
  const address = buildAddress(data);
  const socios = extractSocios(data);

  return {
    cnpj: str(data.cnpj)?.replace(/\D/g, "") ?? undefined,
    razaoSocial: str(data.razao || data.razao_social || data.razaoSocial || data.nome) || null,
    nomeFantasia: str(data.fantasia || data.nome_fantasia || data.fantasia_nome) || null,
    regimeTributario: resolveRegime(data),
    cnae: str(data.cnae_principal || data.cnae) || null,
    faturamentoEstimado: str(data.faturamento) || null,
    porte: resolvedPorte,
    uf: str(data.log_uf || data.uf) || null,
    cidade: str(data.log_municipio || data.municipio || data.cidade) || null,
    endereco: address,
    cep: str(data.log_cep || data.cep)?.replace(/\D/g, "") || null,
    telefone: phone,
    email: str(data.email || data.email_principal) || null,
    website: str(data.site) ? (str(data.site)!.startsWith("http") ? str(data.site) : `https://${data.site}`) : null,
    socios,
    lastEnrichedAt: new Date(),
    source: "empresaqui",
  };
}
