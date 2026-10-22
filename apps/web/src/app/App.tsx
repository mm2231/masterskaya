/** Маршруты приложения. */

import { Route, Routes } from 'react-router-dom';

import { Layout } from './Layout';
import { DashboardPage } from '../pages/DashboardPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { FinancePage } from '../pages/FinancePage';
import { OrderCardPage } from '../pages/OrderCardPage';
import { OrdersPage } from '../pages/OrdersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TasksPage } from '../pages/TasksPage';
import { PrintDocument } from '../print/PrintDocument';

export function App() {
  return (
    <Routes>
      {/* Печатный документ — без оболочки приложения. */}
      <Route path="/orders/:id/print/:kind" element={<PrintDocument />} />
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderCardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
