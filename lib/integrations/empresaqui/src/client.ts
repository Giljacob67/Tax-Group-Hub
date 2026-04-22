/**
 * EmpresAqui API Client
 * Documentação: https://www.empresaqui.com.br/DocsAPI/
 *
 * Autenticação: token vai NO PATH da URL (não em headers).
 * Endpoint: GET https://www.empresaqui.com.br/api/{token}/{cnpj}
 */

export interface EmpresAquiSocio {
  socios_nome: string;
  socios_cpf_cnpj?: string;
  socios_entrada?: string;
  socios_qualificacao?: string;
  socios_faixa_etaria?: string;
}

export interface EmpresAquiDivida {
  dividas_numero?: string;
  dividas_tipo_devedor?: string;
  dividas_tipo_situacao?: string;
  dividas_inscricao?: string;
  dividas_receita?: string;
  dividas_data?: string;
  dividas_indicador?: string;
  dividas_valor?: string;
}

export interface EmpresAquiResponse {
  // Dados básicos
  cnpj: string;
  razao: string;             // Razão social
  fantasia?: string;         // Nome fantasia
  email?: string;
  ddd_1?: string;
  tel_1?: string;
  ddd_2?: string;
  tel_2?: string;
  site?: string;             // Sem https://

  // Endereço
  log_tipo?: string;
  log_nome?: string;
  log_num?: string;
  log_comp?: string;
  log_bairro?: string;
  log_municipio?: string;
  log_uf?: string;
  log_cep?: string;

  // Tributário / Cadastral
  cnae_principal?: string;
  cnae_secundario?: string;  // CSV separado por vírgula
  matriz?: string;           // "1" = matriz
  situacao_cadastral?: string; // "2" = ativa
  data_sit_cad?: string;
  natureza_juridica?: string;
  data_abertura?: string;
  opcao_mei?: string;
  data_mei?: string;
  data_exc_mei?: string;
  opcao_simples?: string;
  data_simples?: string;
  data_exc_simples?: string;
  porte?: string;            // "1"=ME, "2"=EPP, "3"=Demais, "5"=Grande
  capital_social?: string;
  regime_tributario?: string; // código: "1"=Simples, "3"=Lucro Real etc.
  faturamento?: string;
  quadro_funcionarios?: string;

  // Programas especiais
  programas_especiais?: string[];

  // Sócios: chaves numéricas no objeto raiz (ex: "0", "1", ...)
  [key: string]: any;
}

// Decodificadores de código
export const PORTE_MAP: Record<string, string> = {
  "1": "ME",
  "2": "EPP",
  "3": "Médio/Grande",
  "5": "Grande",
};

export const REGIME_MAP: Record<string, string> = {
  "1": "simples",
  "3": "lucro_real",
  "6": "lucro_presumido",
  "4": "lucro_arbitrado",
};

export class EmpresAquiClient {
  private readonly baseUrl = "https://www.empresaqui.com.br/api";

  constructor(private readonly token: string) {
    if (!token?.trim()) {
      throw new Error("EmpresAqui API token is required");
    }
  }

  async getCompanyByCNPJ(cnpj: string): Promise<EmpresAquiResponse> {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      throw new Error(`CNPJ inválido: deve ter 14 dígitos (recebido: ${cleanCnpj.length})`);
    }

    // Token vai no PATH — sem headers de autenticação
    const url = `${this.baseUrl}/${this.token}/${cleanCnpj}`;

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      const body = await response.json().catch(() => ({} as any)) as any;

      // API retorna 200 com { "Erro": "..." } em caso de erros lógicos
      if (body?.Erro) {
        if (body.Erro.includes("não encontrado")) {
          throw new Error(`CNPJ ${cleanCnpj} não encontrado na base EmpresAqui.`);
        }
        if (body.Erro.includes("Token Inválido") || body.Erro.includes("sem permissão")) {
          throw new Error(`Token EmpresAqui inválido ou sem permissão: ${body.Erro}`);
        }
        throw new Error(`EmpresAqui: ${body.Erro}`);
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit EmpresAqui: aguarde 1 segundo e tente novamente.");
        }
        throw new Error(`EmpresAqui HTTP ${response.status}: ${response.statusText}`);
      }

      return body as EmpresAquiResponse;
    } catch (err: any) {
      if (err.message.startsWith("EmpresAqui") || err.message.startsWith("CNPJ") || err.message.startsWith("Token") || err.message.startsWith("Rate")) {
        throw err;
      }
      throw new Error(`Falha na conexão com EmpresAqui: ${err.message}`);
    }
  }
}
