import { createBrowserRouter } from "react-router-dom";

import MainLayout from "../layout/MainLayout";
import Agenda from "../pages/Agenda";
import Dashboard from "../pages/Dashboard";
import PacientesPage from "../pages/PacientesPage";
import ProfesionalesPage from "../pages/ProfesionalesPage";
import ReportesPage from "../pages/ReportesPage";
import Settings from "../pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "agenda", element: <Agenda /> },
      { path: "pacientes", element: <PacientesPage /> },
      { path: "profesionales", element: <ProfesionalesPage /> },
      { path: "reportes", element: <ReportesPage /> },
      { path: "config", element: <Settings /> },
    ],
  },
]);
