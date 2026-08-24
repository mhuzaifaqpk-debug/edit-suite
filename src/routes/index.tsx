import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "@/editor/components/Editor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReelForge — Professional Browser Video Editor" },
      {
        name: "description",
        content:
          "Edit video in your browser: multi-track timeline, live preview, trimming and transform controls with full undo history.",
      },
      { property: "og:title", content: "ReelForge — Professional Browser Video Editor" },
      {
        property: "og:description",
        content:
          "Multi-track timeline, live preview, trimming and transform controls with full undo history.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Editor />;
}
