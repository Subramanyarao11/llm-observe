import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ChatView } from "./pages/ChatView";
import { ConversationList } from "./pages/ConversationList";
import { Dashboard } from "./pages/Dashboard";
import { NewConversation } from "./pages/NewConversation";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/conversations" replace /> },
      { path: "conversations", element: <ConversationList /> },
      { path: "conversations/new", element: <NewConversation /> },
      { path: "conversations/:id", element: <ChatView /> },
      { path: "dashboard", element: <Dashboard /> },
    ],
  },
]);
