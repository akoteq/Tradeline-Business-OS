import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { companyHref, useCompanies } from "@/lib/companies";
import { confirmAction } from "@/components/Confirm";
import { formToBody, leadToForm, type Lead } from "./lib";

// One place for the things you can do to a lead. Each returns the updated lead (or null / false
// if the person backed out of a confirmation) and throws on a server error, so the caller decides
// how to show it.
export type LeadActions = ReturnType<typeof useLeadActions>;

export function useLeadActions(canAssign: boolean, onDone: () => void) {
  const router = useRouter();
  const { byKey } = useCompanies();
  return {
    async stage(lead: Lead, status: string): Promise<Lead> {
      // The edit endpoint takes the whole lead, so send it back with the new stage.
      const { data } = await api.put(`/leads/${lead.id}`, formToBody({ ...leadToForm(lead), status }, canAssign));
      onDone();
      return { ...lead, ...(data?.id ? data : {}), status };
    },

    async followUp(lead: Lead, followUpDate: string): Promise<Lead> {
      const { data } = await api.put(`/leads/${lead.id}`, formToBody({ ...leadToForm(lead), followUpDate }, canAssign));
      onDone();
      return { ...lead, ...(data?.id ? data : {}), followUpDate: followUpDate || null };
    },

    async visibility(lead: Lead): Promise<Lead> {
      const { data } = await api.put(`/leads/${lead.id}/visibility`, { visibility: lead.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" });
      onDone();
      return data;
    },

    async convert(lead: Lead): Promise<Lead | null> {
      if (!(await confirmAction({ title: `Convert ${lead.businessName} to a client?`, body: "It moves to your clients and this lead is archived.", confirmLabel: "Convert", danger: false }))) return null;
      const { data } = await api.post(`/leads/${lead.id}/convert`);
      onDone();
      // A lead that is won becomes a client. If work was agreed, the deal comes next.
      const co = data.company ? byKey[data.company] : null;
      if (co && data.customerId) {
        const value = data.estimatedValueGhs != null ? `${Number(data.estimatedValueGhs).toLocaleString()} GHS is filled in from the lead. ` : "";
        const add = await confirmAction({
          title: `${lead.businessName} is now a client`,
          body: `Did you agree work with this client? ${value}You can also add a deal later.`,
          confirmLabel: "Add a deal", cancelLabel: "Not now",
        });
        if (add) {
          const q = new URLSearchParams({ newDeal: "1", smeId: data.customerId, ...(data.estimatedValueGhs != null ? { value: String(data.estimatedValueGhs) } : {}) });
          router.push(`${companyHref(co)}?${q}`);
        }
      }
      return data.lead;
    },

    async remove(lead: Lead): Promise<boolean> {
      if (!(await confirmAction({ title: `Delete ${lead.businessName}?`, body: "This can't be undone.", confirmLabel: "Delete lead" }))) return false;
      await api.delete(`/leads/${lead.id}`);
      onDone();
      return true;
    },
  };
}
