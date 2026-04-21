import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusCounters } from "@/components/dashboard/StatusCounters";

describe("StatusCounters", () => {
  const counts = {
    nouveau: 3,
    a_qualifier: 1,
    devis_a_faire: 2,
    devis_envoye: 0,
    devis_signe: 0,
    clos_signe: 5,
    en_attente_rdv: 0,
    rdv_pris: 0,
    rdv_termine: 0,
    clos_perdu: 1,
    invoice_pending: 0,
    invoice_paid: 0,
  } as const;

  it("renders all status counts (a_qualifier merged into nouveau)", () => {
    render(<StatusCounters counts={counts} activeFilter={null} onFilterChange={() => {}} />);
    // 3 (nouveau) + 1 (a_qualifier) = 4
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Nouveau")).toBeInTheDocument();
    expect(screen.getByText("Devis signé")).toBeInTheDocument();
  });

  it("calls onFilterChange when clicked", () => {
    const onChange = vi.fn();
    render(<StatusCounters counts={counts} activeFilter={null} onFilterChange={onChange} />);
    fireEvent.click(screen.getByText("Nouveau"));
    expect(onChange).toHaveBeenCalledWith("nouveau");
  });

  it("toggles off when clicking active filter", () => {
    const onChange = vi.fn();
    render(<StatusCounters counts={counts} activeFilter="nouveau" onFilterChange={onChange} />);
    fireEvent.click(screen.getByText("Nouveau"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
