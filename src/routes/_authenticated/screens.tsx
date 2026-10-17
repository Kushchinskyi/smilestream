import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/screens")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { section: "screens" } });
  },
});
