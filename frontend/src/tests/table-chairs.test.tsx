// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableChairsVisual } from "../components/venue/TableChairsVisual";

describe("TableChairsVisual Component", () => {
  it("renders a 4-seater square table with exactly 4 perimeter chairs", () => {
    render(<TableChairsVisual label="T-04" shape="SQUARE" capacity={4} status="AVAILABLE" />);

    expect(screen.getByText("T-04")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(1);

    // Check all 4 chairs are present
    expect(screen.getByRole("button", { name: /Seat 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seat 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seat 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seat 4/i })).toBeInTheDocument();
  });

  it("renders a 6-seater rectangular table with exactly 6 chairs", () => {
    render(<TableChairsVisual label="T-06" shape="RECTANGLE" capacity={6} status="AVAILABLE" />);

    expect(screen.getByText("T-06")).toBeInTheDocument();
    for (let i = 1; i <= 6; i++) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Seat ${i}`, "i") })
      ).toBeInTheDocument();
    }
  });

  it("renders a 2-seater table with 2 chairs", () => {
    render(<TableChairsVisual label="T-02" shape="SQUARE" capacity={2} status="AVAILABLE" />);

    expect(screen.getByRole("button", { name: /Seat 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seat 2/i })).toBeInTheDocument();
  });

  it("renders custom format with 7 chairs", () => {
    render(
      <TableChairsVisual
        label="VIP-7"
        shape="ROUND"
        capacity={7}
        status="OCCUPIED"
        occupiedSeats={[1, 3, 5]}
      />
    );

    for (let i = 1; i <= 7; i++) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Seat ${i}`, "i") })
      ).toBeInTheDocument();
    }
  });

  it("dispatches onChairClick with seat number when a chair is clicked", () => {
    const handleChairClick = vi.fn();
    const handleTableClick = vi.fn();

    render(
      <TableChairsVisual
        label="T-10"
        shape="RECTANGLE"
        capacity={4}
        onChairClick={handleChairClick}
        onTableClick={handleTableClick}
      />
    );

    const seat3 = screen.getByRole("button", { name: /Seat 3/i });
    fireEvent.click(seat3);

    expect(handleChairClick).toHaveBeenCalledWith(3);
    expect(handleTableClick).not.toHaveBeenCalled();
  });

  it("dispatches onTableClick when central table surface is clicked", () => {
    const handleTableClick = vi.fn();

    render(
      <TableChairsVisual label="T-11" shape="SQUARE" capacity={4} onTableClick={handleTableClick} />
    );

    const tableBtn = screen.getByRole("button", { name: /Table T-11/i });
    fireEvent.click(tableBtn);

    expect(handleTableClick).toHaveBeenCalledTimes(1);
  });
});
