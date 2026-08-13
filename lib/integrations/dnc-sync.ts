import { applySalesforceDncToGhl, findGhlContactByEmailOrPhone } from "./ghl";
import { getSalesforceDncLeads } from "./salesforce";

export async function syncSalesforceDnc(options: { fullBackfill?: boolean } = {}) {
  const source = await getSalesforceDncLeads(options);
  const result = {
    examined: source.records.length,
    totalMatchingSalesforce: source.totalSize,
    updatedGhl: 0,
    alreadyDnd: 0,
    unmatched: 0,
    errors: [] as string[],
  };

  for (const lead of source.records) {
    try {
      const contact = await findGhlContactByEmailOrPhone(lead.Email, lead.MobilePhone || lead.Phone);
      if (!contact?.id) {
        result.unmatched += 1;
        continue;
      }
      if (contact.dnd && contact.tags?.some((tag) => tag.toLowerCase() === "salesforce-dnc")) {
        result.alreadyDnd += 1;
        continue;
      }
      await applySalesforceDncToGhl(contact.id);
      result.updatedGhl += 1;
    } catch (error) {
      result.errors.push(`${lead.Id}: ${error instanceof Error ? error.message : "Unknown DNC sync error"}`);
    }
  }

  return result;
}
