export interface EmpresAquiResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  natureza_juridica?: string;
  capital_social?: string | number;
  porte?: string;
  simples?: {
    optante: boolean;
    data_opcao?: string;
  };
  mei?: {
    optante: boolean;
  };
  cnae_principal?: {
    codigo: string;
    descricao: string;
  };
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  contatos?: {
    telefone1?: string;
    telefone2?: string;
    email?: string;
  };
  quadro_societario?: Array<{
    nome: string;
    qualificacao: string;
  }>;
  status: string; // "ATIVA" etc
}

export class EmpresAquiClient {
  private readonly baseUrl = "https://www.empresaqui.com.br/api/v1/empresa";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("EmpresAqui API Key is required");
    }
  }

  async getCompanyByCNPJ(cnpj: string): Promise<EmpresAquiResponse> {
    const cleanCnpj = cnpj.replace(/\\D/g, "");
    
    if (cleanCnpj.length !== 14) {
      throw new Error("Invalid CNPJ format. Must contain 14 digits.");
    }

    try {
      const response = await fetch(`${this.baseUrl}/${cleanCnpj}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`CNPJ ${cleanCnpj} was not found on EmpresAqui database.`);
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("Unauthorized: Invalid EmpresAqui token.");
        }
        if (response.status === 429) {
          throw new Error("Rate limit exceeded for EmpresAqui API.");
        }
        throw new Error(`EmpresAqui request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data as EmpresAquiResponse;
    } catch (err: any) {
      throw new Error(`EmpresAqui API Error: ${err.message}`);
    }
  }
}
