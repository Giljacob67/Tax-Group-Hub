import { db, appConfigTable, crmContactsTable, crmDealsTable, crmActivitiesTable, crmTasksTable, hubspotSyncStateTable, hubspotListMappingTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { HubSpotClient, HubSpotCompany, HubSpotDeal, HubSpotNote, HubSpotTask, HubSpotList } from "@workspace/hubspot";
import {
  mapContactToHubSpotCompany,
  mapContactToHubSpotContactPerson,
  mapDealToHubSpotDeal,
  mapActivityToHubSpotNote,
  mapTaskToHubSpotTask,
  mapHubSpotCompanyToContact,
  mapHubSpotDealToDeal,
  mapHubSpotNoteToActivity,
  mapHubSpotTaskToTask,
} from "@workspace/hubspot";
import { decrypt } from "./crypto.js";
import { writeIntegrationLog, safePayloadPreview } from "./integration-logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HubSpotConfig {
  accessToken: string;
  portalId?: string;
  enabled: boolean;
  syncDirection: "bidirectional" | "to_hubspot" | "from_hubspot";
}

export interface PullResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

async function getHubSpotConfig(userId: string): Promise<HubSpotConfig | null> {
  const rows = await db.select().from(appConfigTable)
    .where(eq(appConfigTable.key, "integration:hubspot:access_token"))
    .limit(1);

  if (!rows[0]?.value) return null;

  const [portalRow, enabledRow, directionRow] = await Promise.all([
    db.select().from(appConfigTable).where(eq(appConfigTable.key, "integration:hubspot:portal_id")).limit(1),
    db.select().from(appConfigTable).where(eq(appConfigTable.key, "integration:hubspot:enabled")).limit(1),
    db.select().from(appConfigTable).where(eq(appConfigTable.key, "integration:hubspot:sync_direction")).limit(1),
  ]);

  const rawToken = rows[0].value;
  const token = decrypt(rawToken);

  return {
    accessToken: token,
    portalId: portalRow[0]?.value ?? undefined,
    enabled: enabledRow[0]?.value === "true",
    syncDirection: (directionRow[0]?.value as HubSpotConfig["syncDirection"]) ?? "bidirectional",
  };
}

async function updateSyncState(userId: string, objectType: string, lastUpdatedId?: string): Promise<void> {
  await db.insert(hubspotSyncStateTable)
    .values({
      userId,
      objectType,
      lastPolledAt: new Date(),
      lastUpdatedId: lastUpdatedId ?? null,
    })
    .onConflictDoUpdate({
      target: [hubspotSyncStateTable.userId, hubspotSyncStateTable.objectType],
      set: { lastPolledAt: new Date(), lastUpdatedId: lastUpdatedId ?? null },
    });
}

// ─── Tax Group → HubSpot (Outbound) ───────────────────────────────────────────

export async function pushContactToHubSpot(
  client: HubSpotClient,
  contact: typeof crmContactsTable.$inferSelect,
  userId: string,
): Promise<string | null> {
  const props = mapContactToHubSpotCompany(contact);

  try {
    if (contact.hubspotId) {
      // Update existing
      await client.updateCompany(contact.hubspotId, props.properties);
      return contact.hubspotId;
    }

    // Search by CNPJ first to avoid duplicates
    if (contact.cnpj) {
      const search = await client.searchCompanies(contact.cnpj);
      if (search.results.length > 0) {
        const id = search.results[0].id;
        await client.updateCompany(id, props.properties);
        await db.update(crmContactsTable)
          .set({ hubspotId: id })
          .where(eq(crmContactsTable.id, contact.id));
        return id;
      }
    }

    // Create new company
    const result = await client.createCompany(props.properties);
    await db.update(crmContactsTable)
      .set({ hubspotId: result.id })
      .where(eq(crmContactsTable.id, contact.id));

    // Also create contact person if nomeDecissor or email exists
    const person = mapContactToHubSpotContactPerson(contact);
    if (person) {
      try {
        const contactResult = await client.createContact(person.properties);
        await client.createAssociation("companies", result.id, "contacts", contactResult.id);
      } catch (err) {
        // Non-critical: contact person creation failure shouldn't block the sync
        await writeIntegrationLog({
          userId,
          integrationKey: "hubspot",
          integrationName: "HubSpot CRM",
          eventType: "contact.person_create_failed",
          direction: "outbound",
          status: "error",
          payloadPreview: safePayloadPreview({ companyId: result.id, email: contact.email }),
          errorMessage: err instanceof Error ? err.message : String(err),
          correlationId: `hs-${result.id}`,
        });
      }
    }

    return result.id;
  } catch (err) {
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "contact.push_failed",
      direction: "outbound",
      status: "error",
      payloadPreview: safePayloadPreview({ contactId: contact.id, cnpj: contact.cnpj }),
      errorMessage: err instanceof Error ? err.message : String(err),
      correlationId: `hs-contact-${contact.id}`,
    });
    return null;
  }
}

export async function pushDealToHubSpot(
  client: HubSpotClient,
  deal: typeof crmDealsTable.$inferSelect,
  contact: typeof crmContactsTable.$inferSelect | undefined,
  userId: string,
): Promise<string | null> {
  if (!contact?.hubspotId) {
    // Push contact first
    if (contact) {
      const companyId = await pushContactToHubSpot(client, contact, userId);
      if (!companyId) return null;
      contact = { ...contact, hubspotId: companyId };
    } else {
      return null;
    }
  }

  const props = mapDealToHubSpotDeal(deal);

  try {
    if (deal.hubspotId) {
      await client.updateDeal(deal.hubspotId, props.properties);
      return deal.hubspotId;
    }

    const result = await client.createDeal(props.properties);
    await client.createAssociation("deals", result.id, "companies", contact.hubspotId!);
    await db.update(crmDealsTable)
      .set({ hubspotId: result.id })
      .where(eq(crmDealsTable.id, deal.id));
    return result.id;
  } catch (err) {
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "deal.push_failed",
      direction: "outbound",
      status: "error",
      payloadPreview: safePayloadPreview({ dealId: deal.id, title: deal.title }),
      errorMessage: err instanceof Error ? err.message : String(err),
      correlationId: `hs-deal-${deal.id}`,
    });
    return null;
  }
}

export async function pushActivityToHubSpot(
  client: HubSpotClient,
  activity: typeof crmActivitiesTable.$inferSelect,
  contactHubspotId: string,
  dealHubspotId?: string | null,
  userId?: string,
): Promise<string | null> {
  const props = mapActivityToHubSpotNote(activity);

  try {
    const result = await client.createNote(props.properties);
    await client.createAssociation("notes", result.id, "companies", contactHubspotId);
    if (dealHubspotId) {
      await client.createAssociation("notes", result.id, "deals", dealHubspotId);
    }
    await db.update(crmActivitiesTable)
      .set({ hubspotId: result.id })
      .where(eq(crmActivitiesTable.id, activity.id));
    return result.id;
  } catch (err) {
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "activity.push_failed",
      direction: "outbound",
      status: "error",
      payloadPreview: safePayloadPreview({ activityId: activity.id, type: activity.type }),
      errorMessage: err instanceof Error ? err.message : String(err),
      correlationId: `hs-activity-${activity.id}`,
    });
    return null;
  }
}

export async function pushTaskToHubSpot(
  client: HubSpotClient,
  task: typeof crmTasksTable.$inferSelect,
  contactHubspotId: string,
  dealHubspotId?: string | null,
  userId?: string,
): Promise<string | null> {
  const props = mapTaskToHubSpotTask(task);

  try {
    if (task.hubspotId) {
      await client.updateTask(task.hubspotId, props.properties);
      return task.hubspotId;
    }

    const result = await client.createTask(props.properties);
    await client.createAssociation("tasks", result.id, "companies", contactHubspotId);
    if (dealHubspotId) {
      await client.createAssociation("tasks", result.id, "deals", dealHubspotId);
    }
    await db.update(crmTasksTable)
      .set({ hubspotId: result.id })
      .where(eq(crmTasksTable.id, task.id));
    return result.id;
  } catch (err) {
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "task.push_failed",
      direction: "outbound",
      status: "error",
      payloadPreview: safePayloadPreview({ taskId: task.id, title: task.title }),
      errorMessage: err instanceof Error ? err.message : String(err),
      correlationId: `hs-task-${task.id}`,
    });
    return null;
  }
}

// ─── HubSpot → Tax Group (Inbound Polling) ───────────────────────────────────

async function pullPaginated<T>(
  fetchFn: (after: string) => Promise<{ results: T[]; paging?: { next?: { after: string } } }>,
): Promise<T[]> {
  const all: T[] = [];
  let after = "";
  let page = 0;

  while (page < 50) { // safety cap at 5000 records per poll
    const response = await fetchFn(after);
    all.push(...response.results);
    if (!response.paging?.next?.after) break;
    after = response.paging.next.after;
    page++;
  }

  return all;
}

export async function pullCompaniesFromHubSpot(
  client: HubSpotClient,
  userId: string,
  lastPolledAt: Date,
): Promise<PullResult> {
  const result: PullResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const companies = await pullPaginated<HubSpotCompany>(
      (after) => client.searchCompaniesModifiedAfter(lastPolledAt.toISOString(), after),
    );

    for (const company of companies) {
      try {
        const mapped = mapHubSpotCompanyToContact(company);
        if (!mapped.cnpj) continue; // skip companies without CNPJ

        const [existing] = await db.select().from(crmContactsTable)
          .where(and(eq(crmContactsTable.hubspotId, company.id), eq(crmContactsTable.userId, userId)))
          .limit(1);

        if (existing) {
          // Compare timestamps — only update if HubSpot is more recent
          const hsModified = new Date(company.updatedAt);
          const localModified = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
          if (hsModified.getTime() - localModified.getTime() < 5000) {
            result.skipped++;
            continue;
          }
          await db.update(crmContactsTable)
            .set(mapped)
            .where(eq(crmContactsTable.id, existing.id));
          result.updated++;
        } else {
          // Check by CNPJ for dedup
          const [byCnpj] = await db.select().from(crmContactsTable)
            .where(and(eq(crmContactsTable.cnpj, mapped.cnpj!), eq(crmContactsTable.userId, userId)))
            .limit(1);
          if (byCnpj) {
            await db.update(crmContactsTable)
              .set({ hubspotId: company.id, ...mapped })
              .where(eq(crmContactsTable.id, byCnpj.id));
            result.updated++;
            continue;
          }

          await db.insert(crmContactsTable).values({
            userId,
            cnpj: mapped.cnpj!,
            ...mapped,
            source: mapped.source ?? "hubspot",
            status: mapped.status ?? "prospect",
          } as typeof crmContactsTable.$inferInsert);
          result.created++;
        }
      } catch (err) {
        result.errors++;
        console.error(`[HubSpot] pullCompanies error for ${company.id}:`, err);
      }
    }

    await updateSyncState(userId, "companies", companies[companies.length - 1]?.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "pull.companies",
      direction: "inbound",
      status: "error",
      errorMessage: msg,
      correlationId: `hs-pull-companies-${userId}`,
    });
  }

  return result;
}

export async function pullDealsFromHubSpot(
  client: HubSpotClient,
  userId: string,
  lastPolledAt: Date,
): Promise<PullResult> {
  const result: PullResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const deals = await pullPaginated<HubSpotDeal>(
      (after) => client.searchDealsModifiedAfter(lastPolledAt.toISOString(), after),
    );

    for (const deal of deals) {
      try {
        const mapped = mapHubSpotDealToDeal(deal);
        if (!mapped.title) continue;

        const [existing] = await db.select().from(crmDealsTable)
          .where(and(eq(crmDealsTable.hubspotId, deal.id), eq(crmDealsTable.userId, userId)))
          .limit(1);

        if (existing) {
          const hsModified = new Date(deal.updatedAt);
          const localModified = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
          if (hsModified.getTime() - localModified.getTime() < 5000) {
            result.skipped++;
            continue;
          }
          await db.update(crmDealsTable)
            .set(mapped)
            .where(eq(crmDealsTable.id, existing.id));
          result.updated++;
        } else {
          // Find associated contact by hubspot_id from associations
          // For now, create deal without contactId (will need enrichment)
          await db.insert(crmDealsTable).values({
            userId,
            contactId: 1, // placeholder — caller should resolve
            ...mapped,
            stage: mapped.stage ?? "prospecting",
            probability: mapped.probability ?? 0,
            value: mapped.value ?? "0",
          } as typeof crmDealsTable.$inferInsert);
          result.created++;
        }
      } catch (err) {
        result.errors++;
        console.error(`[HubSpot] pullDeals error for ${deal.id}:`, err);
      }
    }

    await updateSyncState(userId, "deals", deals[deals.length - 1]?.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "pull.deals",
      direction: "inbound",
      status: "error",
      errorMessage: msg,
      correlationId: `hs-pull-deals-${userId}`,
    });
  }

  return result;
}

export async function pullNotesFromHubSpot(
  client: HubSpotClient,
  userId: string,
  lastPolledAt: Date,
): Promise<PullResult> {
  const result: PullResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const notes = await pullPaginated<HubSpotNote>(
      (after) => client.searchNotesModifiedAfter(lastPolledAt.toISOString(), after),
    );

    for (const note of notes) {
      try {
        const mapped = mapHubSpotNoteToActivity(note);
        const [existing] = await db.select().from(crmActivitiesTable)
          .where(and(eq(crmActivitiesTable.hubspotId, note.id), eq(crmActivitiesTable.userId, userId)))
          .limit(1);

        if (!existing) {
          await db.insert(crmActivitiesTable).values({
            userId,
            contactId: 1, // placeholder — would need association lookup
            ...mapped,
            type: mapped.type ?? "note",
            direction: "inbound",
          } as typeof crmActivitiesTable.$inferInsert);
          result.created++;
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors++;
        console.error(`[HubSpot] pullNotes error for ${note.id}:`, err);
      }
    }

    await updateSyncState(userId, "notes", notes[notes.length - 1]?.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "pull.notes",
      direction: "inbound",
      status: "error",
      errorMessage: msg,
      correlationId: `hs-pull-notes-${userId}`,
    });
  }

  return result;
}

export async function pullTasksFromHubSpot(
  client: HubSpotClient,
  userId: string,
  lastPolledAt: Date,
): Promise<PullResult> {
  const result: PullResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const tasks = await pullPaginated<HubSpotTask>(
      (after) => client.searchTasksModifiedAfter(lastPolledAt.toISOString(), after),
    );

    for (const task of tasks) {
      try {
        const mapped = mapHubSpotTaskToTask(task);
        const [existing] = await db.select().from(crmTasksTable)
          .where(and(eq(crmTasksTable.hubspotId, task.id), eq(crmTasksTable.userId, userId)))
          .limit(1);

        if (existing) {
          const hsModified = new Date(task.updatedAt);
          const localModified = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
          if (hsModified.getTime() - localModified.getTime() < 5000) {
            result.skipped++;
            continue;
          }
          await db.update(crmTasksTable)
            .set(mapped)
            .where(eq(crmTasksTable.id, existing.id));
          result.updated++;
        } else {
          await db.insert(crmTasksTable).values({
            userId,
            ...mapped,
            type: mapped.type ?? "note",
            priority: mapped.priority ?? "medium",
            status: mapped.status ?? "pending",
          } as typeof crmTasksTable.$inferInsert);
          result.created++;
        }
      } catch (err) {
        result.errors++;
        console.error(`[HubSpot] pullTasks error for ${task.id}:`, err);
      }
    }

    await updateSyncState(userId, "tasks", tasks[tasks.length - 1]?.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "pull.tasks",
      direction: "inbound",
      status: "error",
      errorMessage: msg,
      correlationId: `hs-pull-tasks-${userId}`,
    });
  }

  return result;
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export async function pullListsFromHubSpot(
  client: HubSpotClient,
  userId: string,
): Promise<{ listsFound: number; contactsTagged: number; errors: number; source: string }> {
  let listsFound = 0;
  let contactsTagged = 0;
  let errors = 0;
  let source = "none";

  try {
    // Try v3 ILS Lists API first, fall back to v1 Contact Lists API
    let listsData: { listId: string; name: string }[] = [];

    try {
      const { lists } = await client.getLists();
      if (lists.length > 0) {
        source = "v3_ils";
        listsData = lists.map(l => ({ listId: l.listId, name: l.name }));
      }
    } catch {
      // v3 failed, try v1
    }

    if (listsData.length === 0) {
      try {
        const v1Result = await client.getContactLists();
        if (v1Result.lists?.length > 0) {
          source = "v1_contacts";
          listsData = v1Result.lists.map(l => ({ listId: String(l.listId), name: l.name }));
        }
      } catch {
        // v1 also failed
      }
    }

    for (const list of listsData) {
      listsFound++;
      const tagName = `hs:${list.name}`;

      try {
        // Get memberships — v3 uses after cursor, v1 uses vidOffset
        const isV1 = source === "v1_contacts";
        let allRecordIds: string[] = [];

        if (isV1) {
          let offset: number | undefined;
          let hasMore = true;
          while (hasMore) {
            const result = await client.getContactListMemberships(Number(list.listId), offset);
            allRecordIds.push(...result.contacts.map(c => String(c.vid)));
            hasMore = result["has-more"];
            offset = result["vid-offset"];
            if (allRecordIds.length > 5000) break; // safety cap
          }
        } else {
          const memberships = await pullPaginated<{ recordId: string }>(
            (after) => client.getListMemberships(list.listId, after),
          );
          allRecordIds = memberships.map(m => m.recordId);
        }

        for (const recordId of allRecordIds) {
          try {
            // For v1, vid is contact vid — find associated company via hubspotId
            const [contact] = await db.select({ id: crmContactsTable.id, tags: crmContactsTable.tags })
              .from(crmContactsTable)
              .where(and(
                eq(crmContactsTable.hubspotId, recordId),
                eq(crmContactsTable.userId, userId),
              ))
              .limit(1);

            if (!contact) continue;

            const existingTags = contact.tags ?? [];
            if (!existingTags.includes(tagName)) {
              const newTags = [...existingTags, tagName];
              await db.update(crmContactsTable)
                .set({ tags: newTags })
                .where(eq(crmContactsTable.id, contact.id));
              contactsTagged++;
            }
          } catch {
            errors++;
          }
        }

        // Store list mapping
        await db.insert(hubspotListMappingTable)
          .values({
            userId,
            tagName,
            hubspotListId: list.listId,
            direction: "from_hubspot",
          })
          .onConflictDoUpdate({
            target: [hubspotListMappingTable.userId, hubspotListMappingTable.tagName],
            set: { hubspotListId: list.listId },
          });
      } catch (err) {
        errors++;
        console.error(`[HubSpot] pullLists error for list ${list.listId}:`, err);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "pull.lists",
      direction: "inbound",
      status: "error",
      errorMessage: msg,
      correlationId: `hs-pull-lists-${userId}`,
    });
  }

  return { listsFound, contactsTagged, errors, source };
}

export async function pushTagListToHubSpot(
  client: HubSpotClient,
  userId: string,
  tagName: string,
): Promise<string | null> {
  try {
    // Get all contacts with this tag
    const contacts = await db.select({ id: crmContactsTable.id, hubspotId: crmContactsTable.hubspotId })
      .from(crmContactsTable)
      .where(
        and(
          eq(crmContactsTable.userId, userId),
          eq(crmContactsTable.tags, [tagName] as any),
        ),
      );

    const hsIds = contacts.filter(c => c.hubspotId).map(c => c.hubspotId!);
    if (hsIds.length === 0) return null;

    // Find or create the list
    const existingLists = await client.getLists();
    let listId = existingLists.lists.find((l: HubSpotList) => l.name === `[Tax Group] ${tagName}`)?.listId;

    if (!listId) {
      const newList = await client.createList(`[Tax Group] ${tagName}`, "0-2"); // 0-2 = companies
      listId = newList.listId;

      await db.insert(hubspotListMappingTable).values({
        userId,
        tagName,
        hubspotListId: listId,
        direction: "bidirectional",
      });
    }

    await client.addToList(listId, hsIds);
    return listId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeIntegrationLog({
      userId,
      integrationKey: "hubspot",
      integrationName: "HubSpot CRM",
      eventType: "list.push_failed",
      direction: "outbound",
      status: "error",
      errorMessage: msg,
      payloadPreview: safePayloadPreview({ tagName }),
      correlationId: `hs-list-${tagName}`,
    });
    return null;
  }
}

export async function syncAllListsToHubSpot(client: HubSpotClient, userId: string): Promise<{ synced: number; errors: number }> {
  const tags = await db.selectDistinct({ tag: crmContactsTable.tags })
    .from(crmContactsTable)
    .where(eq(crmContactsTable.userId, userId));

  let synced = 0;
  let errors = 0;

  for (const row of tags) {
    if (!row.tag) continue;
    for (const tag of row.tag) {
      const result = await pushTagListToHubSpot(client, userId, tag);
      if (result) synced++;
      else errors++;
    }
  }

  return { synced, errors };
}

// ─── Auto-Segment ────────────────────────────────────────────────────────────

const SEGMENT_RULES: Array<{ property: keyof typeof crmContactsTable.$inferSelect; prefix: string }> = [
  { property: "regimeTributario", prefix: "regime:" },
  { property: "porte", prefix: "porte:" },
  { property: "status", prefix: "status:" },
  { property: "aiRecommendedProduct", prefix: "produto:" },
  { property: "uf", prefix: "uf:" },
];

export async function autoSegmentContacts(userId: string): Promise<{
  contactsProcessed: number;
  tagsApplied: number;
  segments: Record<string, number>;
}> {
  let contactsProcessed = 0;
  let tagsApplied = 0;
  const segments: Record<string, number> = {};

  const contacts = await db.select().from(crmContactsTable)
    .where(eq(crmContactsTable.userId, userId));

  for (const contact of contacts) {
    contactsProcessed++;
    const newTags: string[] = [];

    for (const rule of SEGMENT_RULES) {
      const value = contact[rule.property];
      if (value && String(value).trim().length > 0) {
        const tag = `${rule.prefix}${String(value).toLowerCase().replace(/\s+/g, "_")}`;
        newTags.push(tag);
        segments[tag] = (segments[tag] ?? 0) + 1;
      }
    }

    if (newTags.length === 0) continue;

    const existingTags = contact.tags ?? [];
    const merged = [...new Set([...existingTags, ...newTags])];

    // Only update if tags actually changed
    if (merged.length !== existingTags.length || !merged.every(t => existingTags.includes(t))) {
      await db.update(crmContactsTable)
        .set({ tags: merged })
        .where(eq(crmContactsTable.id, contact.id));
      tagsApplied += newTags.filter(t => !existingTags.includes(t)).length;
    }
  }

  return { contactsProcessed, tagsApplied, segments };
}

// ─── Full Inbound Sync (called by cron) ───────────────────────────────────────

export async function runFullInboundSync(userId: string): Promise<{
  companies: PullResult;
  deals: PullResult;
  notes: PullResult;
  tasks: PullResult;
  lists: { listsFound: number; contactsTagged: number; errors: number; source: string };
}> {
  const config = await getHubSpotConfig(userId);
  if (!config || !config.enabled) {
    throw new Error("HubSpot not configured or disabled");
  }
  if (config.syncDirection === "to_hubspot") {
    return { companies: { created: 0, updated: 0, skipped: 0, errors: 0 }, deals: { created: 0, updated: 0, skipped: 0, errors: 0 }, notes: { created: 0, updated: 0, skipped: 0, errors: 0 }, tasks: { created: 0, updated: 0, skipped: 0, errors: 0 }, lists: { listsFound: 0, contactsTagged: 0, errors: 0, source: "none" } };
  }

  const client = new HubSpotClient(config.accessToken, config.portalId);

  // Reassign any contacts previously synced as "system" to the real userId
  if (userId !== "system") {
    try {
      await db.update(crmContactsTable)
        .set({ userId })
        .where(and(
          eq(crmContactsTable.userId, "system"),
          sql`${crmContactsTable.hubspotId} IS NOT NULL`,
        ));
      // Also reassign sync state so incremental polling continues correctly
      await db.update(hubspotSyncStateTable)
        .set({ userId })
        .where(eq(hubspotSyncStateTable.userId, "system"));
    } catch (err) {
      console.error("[HubSpot] Failed to reassign system contacts:", err);
    }
  }

  const [stateRows] = await Promise.all([
    db.select().from(hubspotSyncStateTable).where(eq(hubspotSyncStateTable.userId, userId)),
  ]);
  const stateMap = Object.fromEntries(stateRows.map(r => [r.objectType, r.lastPolledAt]));
  const defaultDate = new Date("2020-01-01"); // pull all records on first sync

  const [companies, deals, notes, tasks] = await Promise.all([
    pullCompaniesFromHubSpot(client, userId, stateMap.companies ?? defaultDate),
    pullDealsFromHubSpot(client, userId, stateMap.deals ?? defaultDate),
    pullNotesFromHubSpot(client, userId, stateMap.notes ?? defaultDate),
    pullTasksFromHubSpot(client, userId, stateMap.tasks ?? defaultDate),
  ]);

  // Lists run after companies sync (needs hubspotId on contacts)
  const lists = await pullListsFromHubSpot(client, userId);

  return { companies, deals, notes, tasks, lists };
}

export { getHubSpotConfig };
