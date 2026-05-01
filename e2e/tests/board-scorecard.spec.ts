import { test, expect, type Page } from '@playwright/test';
import { loginWithPin } from './helpers';

type MockState = { nonGet: string[] };

const now = Date.UTC(2026, 4, 1, 13, 0, 0);
const daysAgo = (days: number) => new Date(now - days * 24 * 3600 * 1000).toISOString();
const daysFromNow = (days: number) => new Date(now + days * 24 * 3600 * 1000).toISOString();

async function mockSupabase(page: Page): Promise<MockState> {
  const state: MockState = { nonGet: [] };
  await page.addInitScript((fixedNow) => {
    const OriginalDate = Date;
    class FixedDate extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) super(fixedNow);
        else super(...args as []);
      }
      static now() { return fixedNow; }
    }
    // @ts-expect-error test Date shim
    window.Date = FixedDate;
  }, now);

  const fixtures: Record<string, any[]> = {
    buildings: [{ id: 'b1', name: 'Villa Valencia', status: 'active' }],
    escalation_events: [
      { id: 'e1', severity: 'high', status: 'open', title: 'Filtración crítica', source_type: 'incident_ticket', source_id: 'i1', created_at: daysAgo(1), payload: { source_context: 'Área social' } },
    ],
    incident_tickets: [
      { id: 'i1', building_id: 'b1', ticket_number: 'INC-1', title: 'Fuga recurrente', status: 'open', severity: 'high', category: 'Plomería', location_label: 'Piscina', created_at: daysAgo(1) },
      { id: 'i2', building_id: 'b1', ticket_number: 'INC-2', title: 'Fuga menor', status: 'open', severity: 'medium', category: 'Plomería', location_label: 'Piscina', created_at: daysAgo(2) },
      { id: 'i3', building_id: 'b1', ticket_number: 'INC-3', title: 'Fuga seguimiento', status: 'closed', severity: 'low', category: 'Plomería', location_label: 'Piscina', created_at: daysAgo(3), resolved_at: daysAgo(1), metadata: { incident_history: [{ label: 'Cerrado', note: 'OK' }] } },
    ],
    inspection_rounds: [
      { id: 'r1', round_number: 'R-1', title: 'Recorrido preventivo', status: 'completed', completed_at: daysAgo(1), scheduled_for: daysAgo(1), created_at: daysAgo(1) },
      { id: 'r2', round_number: 'R-2', title: 'Recorrido programado', status: 'open', scheduled_for: daysAgo(2), created_at: daysAgo(2) },
    ],
    inspection_findings: [
      { id: 'f1', inspection_round_id: 'r1', description: 'Hallazgo operativo', status: 'open', severity: 'medium', created_at: daysAgo(1), metadata: {} },
    ],
    inventory_movements: [{ id: 'm1', inventory_item_id: 'it1', movement_type: 'counted', movement_at: daysAgo(1) }],
    inventory_items: [
      { id: 'it1', sku: 'CLORO', name: 'Cloro piscina', current_quantity: 1, reorder_point: 3, is_active: true },
    ],
    weekly_reports: [{ id: 'wr1', period_label: 'Semana demo', status: 'submitted', submitted_at: daysAgo(1) }],
    work_assignments: [
      { id: 'w1', assignment_number: 'WO-1', title: 'Mantenimiento preventivo bombas', task_type: 'preventive', priority: 'normal', status: 'open', created_at: daysAgo(3), due_at: daysFromNow(2) },
      { id: 'w2', assignment_number: 'WO-2', title: 'Reparación correctiva puerta', task_type: 'corrective', priority: 'high', status: 'open', created_at: daysAgo(12), due_at: daysAgo(1) },
      { id: 'w3', assignment_number: 'WO-3', title: 'Proyecto capital ascensor', task_type: 'project', priority: 'high', status: 'in_progress', created_at: daysAgo(35), due_at: daysFromNow(14), metadata: { capital_project: true } },
    ],
    compliance_cases: [],
  };

  await page.route('https://tgoitmwdpdkhlpqpwrvs.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    if (req.method() !== 'GET' && req.method() !== 'HEAD') state.nonGet.push(`${req.method()} ${req.url()}`);
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'writes disabled in mock' }) });
      return;
    }
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop() || '';
    const rows = fixtures[table] || [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  });
  return state;
}

test.describe('P3-RPT-002 premium board scorecard', () => {
  test('Reportes board packet renders owner/source scorecard and weekly metrics without writes', async ({ page }) => {
    const state = await mockSupabase(page);
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/reportes');
    await page.getByRole('button', { name: 'Paquete Junta' }).click();

    const packet = page.getByTestId('board-packet');
    await expect(packet).toBeVisible({ timeout: 30_000 });
    await expect(packet).toContainText('No incluye datos personales');

    const cards = page.getByTestId('board-kpi-card');
    await expect(cards).toHaveCount(8);
    await expect(page.getByTestId('board-scorecard')).toContainText('Responsable');
    await expect(page.getByTestId('board-scorecard')).toContainText('Fuente');
    await expect(page.getByTestId('board-scorecard')).toContainText('Ver detalle');
    await expect(page.getByTestId('board-scorecard')).toContainText('Preventivo / correctivo');
    await expect(page.getByTestId('board-scorecard')).toContainText('Patrones crónicos');
    await expect(page.getByTestId('board-scorecard')).toContainText('Cumplimiento recorridos');

    await expect(page.getByTestId('board-backlog-age')).toContainText('0–7 días');
    await expect(page.getByTestId('backlog-age-bucket-8-30')).toContainText('1');
    await expect(page.getByTestId('backlog-age-bucket-31-plus')).toContainText('1');

    await expect(packet).not.toContainText(/555-0100|persona sensible|cuenta 123|correo@example\.com/i);
    expect(state.nonGet).toEqual([]);
  });

  test('Junta dashboard uses the same owner/source scorecard language and drilldowns without writes', async ({ page }) => {
    const state = await mockSupabase(page);
    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/junta');

    const scorecard = page.getByTestId('junta-scorecard');
    await expect(scorecard).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('junta-kpi-card')).toHaveCount(8);
    await expect(scorecard).toContainText('Responsable');
    await expect(scorecard).toContainText('Fuente');
    await expect(scorecard).toContainText('Preventivo / correctivo');
    await expect(scorecard).toContainText('Backlog abierto');
    await expect(scorecard).toContainText('Cumplimiento recorridos');

    await page.getByRole('button', { name: /Backlog abierto/i }).click();
    await expect(page.getByTestId('junta-kpi-detail')).toBeVisible();
    await expect(page.getByTestId('junta-kpi-detail')).toContainText('Detalle: Backlog abierto');
    await expect(page.getByTestId('junta-kpi-detail')).toContainText('WO-1');

    await page.getByRole('button', { name: /Preventivo \/ correctivo/i }).click();
    await expect(page.getByTestId('junta-kpi-detail')).toContainText('Detalle: Preventivo / correctivo');
    await expect(page.getByTestId('junta-kpi-detail')).toContainText('2 / 1');

    expect(state.nonGet).toEqual([]);
  });

});
