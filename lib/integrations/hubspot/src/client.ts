const BASE_URL = "https://api.hubapi.com";

export interface HubSpotRateLimit {
  max: number;
  remaining: number;
  windowMs: number;
}

export interface HubSpotList {
  listId: string;
  name: string;
  objectTypeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface HubSpotCompany {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotNote {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotTask {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface HubSpotPipeline {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string; displayOrder: number }>;
}

export interface HubSpotCreateResult {
  id: string;
  properties: Record<string, string | null>;
}

export interface BatchUpsertResult {
  results: HubSpotCreateResult[];
  errors?: Array<{ index: number; message: string }>;
}

export class HubSpotClient {
  private token: string;
  private portalId: string | undefined;

  constructor(accessToken: string, portalId?: string) {
    if (!accessToken || accessToken.trim().length === 0) {
      throw new Error("HubSpot: access token is required");
    }
    this.token = accessToken;
    this.portalId = portalId;
  }

  // ── Low-level request ──────────────────────────────────────────────────────

  private async _request<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt: number = 0,
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort") || msg.includes("timeout")) {
        throw new Error(`HubSpot: request timed out: ${method} ${path}`);
      }
      if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        throw new Error(`HubSpot: connection failed: ${msg}`);
      }
      throw new Error(`HubSpot: network error: ${msg}`);
    }

    if (res.status === 401) {
      throw new Error("HubSpot: invalid or expired access token (401)");
    }

    if (res.status === 429 && attempt < 3) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 1000)));
      return this._request(method, path, body, attempt + 1);
    }

    if (res.status >= 500 && attempt < 2) {
      const delay = (attempt + 1) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return this._request(method, path, body, attempt + 1);
    }

    if (!res.ok) {
      let errorBody = "";
      try { errorBody = await res.text(); } catch { /* ignore */ }
      throw new Error(`HubSpot: HTTP ${res.status} on ${method} ${path}: ${errorBody.substring(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Companies ──────────────────────────────────────────────────────────────

  async getCompanies(limit = 100, after?: string): Promise<{ results: HubSpotCompany[]; paging?: { next?: { after: string } } }> {
    const props = [
      "name", "domain", "phone", "address", "city", "state", "zip", "website",
      "annualrevenue", "hs_lead_status", "createdate",
      "nome_fantasia", "cnpj", "regime_tributario", "cnae", "porte",
      "ai_score", "ai_recommended_product", "source",
    ].join(",");

    let path = `/crm/v3/objects/companies?limit=${limit}&properties=${props}&sort=hs_lastmodifieddate`;
    if (after) path += `&after=${after}`;
    return this._request("GET", path);
  }

  async getCompany(id: string): Promise<HubSpotCompany> {
    const props = [
      "name", "domain", "phone", "address", "city", "state", "zip", "website",
      "annualrevenue", "hs_lead_status", "createdate",
      "nome_fantasia", "cnpj", "regime_tributario", "cnae", "porte",
      "ai_score", "ai_recommended_product", "source",
    ].join(",");

    return this._request("GET", `/crm/v3/objects/companies/${id}?properties=${props}`);
  }

  async createCompany(properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("POST", "/crm/v3/objects/companies", { properties });
  }

  async updateCompany(id: string, properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("PATCH", `/crm/v3/objects/companies/${id}`, { properties });
  }

  async searchCompanies(cnpj: string): Promise<{ results: HubSpotCompany[] }> {
    return this._request("POST", "/crm/v3/objects/companies/search", {
      filterGroups: [{
        filters: [{ propertyName: "cnpj", operator: "EQ", value: cnpj }],
      }],
      properties: ["name", "cnpj"],
      limit: 1,
    });
  }

  // ── Contacts (person) ──────────────────────────────────────────────────────

  async createContact(properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("POST", "/crm/v3/objects/contacts", { properties });
  }

  async updateContact(id: string, properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("PATCH", `/crm/v3/objects/contacts/${id}`, { properties });
  }

  async getRecentlyModifiedContacts(after: string, limit = 100): Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }> {
    const props = ["firstname", "lastname", "email", "phone", "jobtitle"].join(",");
    let path = `/crm/v3/objects/contacts?limit=${limit}&properties=${props}&sort=hs_lastmodifieddate`;
    if (after) path += `&after=${after}`;
    return this._request("GET", path);
  }

  async searchContacts(email: string): Promise<{ results: HubSpotContact[] }> {
    return this._request("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [{
        filters: [{ propertyName: "email", operator: "EQ", value: email }],
      }],
      properties: ["firstname", "lastname", "email"],
      limit: 1,
    });
  }

  // ── Deals ──────────────────────────────────────────────────────────────────

  async createDeal(properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("POST", "/crm/v3/objects/deals", { properties });
  }

  async updateDeal(id: string, properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("PATCH", `/crm/v3/objects/deals/${id}`, { properties });
  }

  async getRecentlyModifiedDeals(after: string, limit = 100): Promise<{ results: HubSpotDeal[]; paging?: { next?: { after: string } } }> {
    const props = ["dealname", "dealstage", "amount", "closedate", "deal_probability", "produto"].join(",");
    let path = `/crm/v3/objects/deals?limit=${limit}&properties=${props}&sort=hs_lastmodifieddate`;
    if (after) path += `&after=${after}`;
    return this._request("GET", path);
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  async createNote(properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("POST", "/crm/v3/objects/notes", { properties });
  }

  async getRecentlyModifiedNotes(after: string, limit = 100): Promise<{ results: HubSpotNote[]; paging?: { next?: { after: string } } }> {
    const props = ["hs_note_body", "hs_body_preview", "hs_timestamp"].join(",");
    let path = `/crm/v3/objects/notes?limit=${limit}&properties=${props}&sort=hs_lastmodifieddate`;
    if (after) path += `&after=${after}`;
    return this._request("GET", path);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async createTask(properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("POST", "/crm/v3/objects/tasks", { properties });
  }

  async updateTask(id: string, properties: Record<string, string | number | null>): Promise<HubSpotCreateResult> {
    return this._request("PATCH", `/crm/v3/objects/tasks/${id}`, { properties });
  }

  async getRecentlyModifiedTasks(after: string, limit = 100): Promise<{ results: HubSpotTask[]; paging?: { next?: { after: string } } }> {
    const props = ["hs_task_subject", "hs_task_body", "hs_task_status", "hs_task_priority", "hs_task_type", "hs_timestamp"].join(",");
    let path = `/crm/v3/objects/tasks?limit=${limit}&properties=${props}&sort=hs_lastmodifieddate`;
    if (after) path += `&after=${after}`;
    return this._request("GET", path);
  }

  // ── Associations ───────────────────────────────────────────────────────────

  async createAssociation(fromType: "companies" | "contacts" | "deals" | "notes" | "tasks", fromId: string, toType: "companies" | "contacts" | "deals" | "notes" | "tasks", toId: string): Promise<void> {
    await this._request("PUT", `/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, null);
  }

  // ── Pipelines ──────────────────────────────────────────────────────────────

  async getDealPipelines(): Promise<{ results: HubSpotPipeline[] }> {
    return this._request("GET", "/crm/v3/pipelines/deals");
  }

  // ── Owners ─────────────────────────────────────────────────────────────────

  async getOwners(): Promise<{ results: HubSpotOwner[] }> {
    return this._request("GET", "/crm/v3/owners?limit=100");
  }

  // ── Lists ──────────────────────────────────────────────────────────────────

  async createList(name: string, objectTypeId: "0-1" | "0-2" | "0-3"): Promise<HubSpotList> {
    return this._request("POST", "/crm/v3/lists/", {
      name,
      objectTypeId,
      processingType: "MANUAL",
    });
  }

  async addToList(listId: string, recordIds: string[]): Promise<void> {
    await this._request("PUT", `/crm/v3/lists/${listId}/memberships/add`, recordIds);
  }

  async removeFromList(listId: string, recordIds: string[]): Promise<void> {
    await this._request("PUT", `/crm/v3/lists/${listId}/memberships/remove`, recordIds);
  }

  async getLists(): Promise<{ lists: HubSpotList[] }> {
    return this._request("GET", "/crm/v3/lists/?limit=100");
  }

  // ── Custom Properties ──────────────────────────────────────────────────────

  async getCustomProperties(objectType: string): Promise<{ results: HubSpotProperty[] }> {
    return this._request("GET", `/crm/v3/properties/${objectType}`);
  }

  async createPropertyGroup(objectType: string, name: string, label: string): Promise<void> {
    await this._request("POST", `/crm/v3/properties/${objectType}/groups`, { name, label, displayOrder: -1 });
  }

  async createCustomProperty(objectType: string, definition: Record<string, unknown>): Promise<HubSpotProperty> {
    return this._request("POST", `/crm/v3/properties/${objectType}`, definition);
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async getCompanyCount(): Promise<number> {
    const result = await this._request<{ total: number }>("GET", "/crm/v3/objects/companies?limit=1");
    return result.total;
  }
}
