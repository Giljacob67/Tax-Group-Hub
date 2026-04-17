import 'dotenv/config';
import { EmpresAquiClient } from "./lib/integrations/empresaqui/src/client.js";

async function testar() {
  const token = process.env.EMPRESAQUI_API_KEY || process.argv[2];
  if (!token) {
    console.error("Forneça o token via arg");
    return;
  }
  const client = new EmpresAquiClient(token);
  try {
    const data = await client.getCompanyByCNPJ("84978485000182");
    console.log("Raw Response:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Erro:", err.message);
  }
}

testar();
