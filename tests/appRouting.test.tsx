import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../src/app/App";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../src/app/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../src/pages/LandingPage", () => ({ LandingPage: () => null }));
vi.mock("../src/pages/OnboardingPage", () => ({ OnboardingPage: () => null }));
vi.mock("../src/pages/DashboardPage", () => ({ DashboardPage: () => <div>Dashboard route</div> }));
vi.mock("../src/pages/ExplorerPage", () => ({ ExplorerPage: () => <div>Public issue explorer</div> }));
vi.mock("../src/pages/IssueDetailPage", () => ({ IssueDetailPage: () => null }));
vi.mock("../src/pages/MentorPage", () => ({ MentorPage: () => null }));
vi.mock("../src/pages/SavedPage", () => ({ SavedPage: () => null }));
vi.mock("../src/pages/ProfilePage", () => ({ ProfilePage: () => null }));
vi.mock("../src/pages/SimplifierPage", () => ({ SimplifierPage: () => null }));

describe("app entry routing", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.useAuth.mockReturnValue({
      user: null,
      loading: false,
      configured: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it("shows sign-in first for signed-out visitors at the deployment root", async () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Pick up where you left off." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends an existing session to the dashboard from the root", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      configured: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    expect(await screen.findByText("Dashboard route")).toBeInTheDocument();
  });

  it("keeps the public issue explorer available without signing in", async () => {
    render(<MemoryRouter initialEntries={["/explore"]}><App /></MemoryRouter>);

    expect(await screen.findByText("Public issue explorer")).toBeInTheDocument();
  });
});
