import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./components/StageCanvas", () => () => <div>Stage canvas mock</div>);
jest.mock("./components/MatrixEditor", () => () => <div>Matrix editor mock</div>);
jest.mock("./components/MiniMatrixStrip", () => () => <div>Mini matrix mock</div>);
jest.mock("./components/OrbitQuickPad", () => () => <div>Orbit quickpad mock</div>);

test("renders prismatic core launch state", () => {
  render(<App />);
  expect(screen.getByText(/prismatic core dispatcher/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /launch core/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /performance/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /prompt library/i })).toBeInTheDocument();
});
