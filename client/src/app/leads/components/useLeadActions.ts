import { api } from "@/lib/api";
import { confirmAction } from "@/components/Confirm";
import { formToBody, leadToForm, type Lead } from "./lib";

// One place for the things you can do to a lead. Each returns the updated lead (or null / false
// if the person backed out of a confirmation) and throws on a server error, so the caller decides
// how to show it.
export type LeadActions = ReturnType<typeof useLeadActions>;

export function useLeadActions(canAssign: boolean, onDone: () => void) {
  return {
    async stage(lead: Lead, status: string): Promise<Lead> {
      // The edit endpoint takes the whole lead, so send it back with the new stage.
      const { data } = await api.put(`/leads/${lead.id}`, formToBody({ ...leadToForm(lead), status }, canAssign));
      onDone();
      return { ...lead, ...(data?.id ? data : {}), status };
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
