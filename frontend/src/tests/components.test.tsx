import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

describe("Brand & UI Components", () => {
  it("renders BrandLogo full variant with wordmark and company label", () => {
    render(<BrandLogo variant="full" theme="light" />);
    expect(screen.getByText("ServeMy")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText(/By Fusion Engine/i)).toBeInTheDocument();
  });

  it("renders BrandLogo icon variant without wordmark text", () => {
    const { container } = render(<BrandLogo variant="icon" theme="light" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText("ServeMy")).not.toBeInTheDocument();
  });

  it("renders primary button with orange background and navy text class", () => {
    render(<Button variant="primary">Sign In</Button>);
    const btn = screen.getByRole("button", { name: /Sign In/i });
    expect(btn).toHaveClass("bg-[#FF6A00]");
    expect(btn).toHaveClass("text-[#0B1F3B]");
  });

  it("renders table status badges with exact theme styles", () => {
    const { rerender } = render(<Badge variant="available">AVAILABLE</Badge>);
    expect(screen.getByText("AVAILABLE")).toHaveClass("bg-[#DCFCE7]");

    rerender(<Badge variant="occupied">OCCUPIED</Badge>);
    expect(screen.getByText("OCCUPIED")).toHaveClass("bg-[#DBEAFE]");

    rerender(<Badge variant="reserved">RESERVED</Badge>);
    expect(screen.getByText("RESERVED")).toHaveClass("bg-[#F3E8FF]");

    rerender(<Badge variant="cleaning">CLEANING</Badge>);
    expect(screen.getByText("CLEANING")).toHaveClass("bg-[#FEF3C7]");

    rerender(<Badge variant="blocked">BLOCKED</Badge>);
    expect(screen.getByText("BLOCKED")).toHaveClass("bg-[#F3F4F6]");
  });
});
