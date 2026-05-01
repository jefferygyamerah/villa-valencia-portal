import { test, expect, type Page, type Route } from '@playwright/test';
import { loginWithPin } from './helpers';

const BUILDING_ID = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';

type IncidentRow = Record<string, any>;
type EscalationRow = Record<string, any>;

type MockState = {
  incidents: IncidentRow[];
  escalations: EscalationRow[];
  requests: Array<{ method: string; path: string; body: any }>;
};

function baseIncident(overrides: Partial<IncidentRow>): IncidentRow {
  return {
    id: overrides.id,
    building_id: BUILDING_ID,
    ticket_number: overrides.ticket_number,
    source: 'internal',
    category: 'Maintenance',
    location_label: 'Garita',
    severity: 'medium',
    status: 'received',
    title: 'Incidencia de prueba',
    description: 'Descripcion operativa de prueba.',
    created_at: '2026-04-30T12:00:00.000Z',
    metadata: {},
    ...overrides,
  };
}

async function fulfillJson(route: Route, body: any, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockSupabase(page: Page, state: MockState) {
  await page.route('https://tgoitmwdpdkhlpqpwrvs.supabase.co/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split('/rest/v1/')[1] || '';
    const method = request.method();

    if (method === 'GET') {
      if (path.startsWith('incident_tickets')) return fulfillJson(route, state.incidents);
      if (path.startsWith('escalation_events')) return fulfillJson(route, state.escalations);
      if (path.startsWith('buildings')) return fulfillJson(route, [{ id: BUILDING_ID, name: 'Villa Valencia', status: 'active' }]);
      return fulfillJson(route, []);
    }

    const raw = request.postData() || '{}';
    const body = JSON.parse(raw);
    state.requests.push({ method, path, body });

    if (method === 'PATCH' && path.startsWith('incident_tickets')) {
      const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      const row = state.incidents.find((incident) => String(incident.id) === id);
      if (!row) return fulfillJson(route, { message: 'not found' }, 404);
      Object.assign(row, body);
      return fulfillJson(route, [row]);
    }

    if (method === 'POST' && path.startsWith('escalation_events')) {
      const rows = Array.isArray(body) ? body : [body];
      const created = rows.map((row, index) => ({
        id: `esc-${state.escalations.length + index + 1}`,
        created_at: '2026-04-30T12:10:00.000Z',
        ...row,
      }));
      state.escalations.unshift(...created);
      return fulfillJson(route, created);
    }

    return fulfillJson(route, []);
  });
}

test.describe('Wave 10 incident lifecycle', () => {
  test('conserjeria only sees own or assigned incidents and closes with history', async ({ page }) => {
    const state: MockState = {
      incidents: [
        baseIncident({
          id: 'owned',
          ticket_number: 'INC-OWNED',
          title: 'Reporte de conserjeria',
          metadata: { actorRole: 'conserje', actorLabel: 'Personal / Conserjeria' },
        }),
        baseIncident({
          id: 'assigned',
          ticket_number: 'INC-ASSIGNED',
          title: 'Asignada a conserjeria',
          metadata: { actorRole: 'supervisor', assigneeRole: 'conserje', assigneeLabel: 'Personal / Conserjeria' },
        }),
        baseIncident({
          id: 'other',
          ticket_number: 'INC-OTHER',
          title: 'Solo supervision',
          metadata: { actorRole: 'supervisor', assigneeRole: 'gerencia' },
        }),
      ],
      escalations: [],
      requests: [],
    };
    await mockSupabase(page, state);

    await loginWithPin(page, '2026');
    await page.goto('/aproviva-suite/index.html#/incidencias');
    await page.getByTestId('incidencias-page').waitFor({ state: 'visible', timeout: 30_000 });

    await expect(page.getByTestId('inc-ticket-INC-OWNED')).toBeVisible();
    await expect(page.getByTestId('inc-ticket-INC-ASSIGNED')).toBeVisible();
    await expect(page.getByTestId('inc-ticket-INC-OTHER')).toHaveCount(0);

    const assigned = page.getByTestId('inc-ticket-INC-ASSIGNED');
    await assigned.getByRole('button', { name: 'Cerrar con nota' }).click();
    await page.getByTestId('inc-action-sheet').locator('textarea[name="note"]').fill('Atendido en sitio y verificado por conserjeria.');
    await page.getByTestId('inc-action-sheet').getByRole('button', { name: 'Cerrar con nota' }).click();

    const closed = state.incidents.find((incident) => incident.id === 'assigned');
    expect(closed?.status).toBe('resolved');
    expect(closed?.metadata.incident_history.at(-1)).toMatchObject({
      action: 'close_assigned',
      note: 'Atendido en sitio y verificado por conserjeria.',
      actor_role: 'conserje',
    });
  });

  test('supervision requires resolution comments and sends escalation context to junta', async ({ page }) => {
    const state: MockState = {
      incidents: [
        baseIncident({
          id: 'resolve',
          ticket_number: 'INC-RESOLVE',
          title: 'Luminaria corregida',
          status: 'in_progress',
          metadata: { actorRole: 'conserje', incident_history: [{ action: 'created', label: 'Incidencia creada', at: '2026-04-30T12:00:00.000Z' }] },
        }),
        baseIncident({
          id: 'escalate',
          ticket_number: 'INC-ESC',
          title: 'Porton requiere decision',
          severity: 'high',
          category: 'Security',
          location_label: 'Garita',
          metadata: { actorRole: 'conserje' },
        }),
      ],
      escalations: [],
      requests: [],
    };
    await mockSupabase(page, state);

    await loginWithPin(page, 'SUP26');
    await page.goto('/aproviva-suite/index.html#/incidencias');
    await page.getByTestId('incidencias-page').waitFor({ state: 'visible', timeout: 30_000 });

    await page.getByTestId('inc-ticket-INC-RESOLVE').getByRole('button', { name: 'Resolver' }).click();
    await page.getByTestId('inc-action-sheet').getByRole('button', { name: 'Resolver' }).click();
    await expect(page.locator('#toast')).toContainText('Agrega un comentario');

    await page.getByTestId('inc-action-sheet').locator('textarea[name="note"]').fill('Se reemplazo luminaria y se verifico encendido.');
    await page.getByTestId('inc-action-sheet').locator('input[name="evidence_url"]').fill('https://example.invalid/evidencia.jpg');
    await page.getByTestId('inc-action-sheet').getByRole('button', { name: 'Resolver' }).click();

    const resolved = state.incidents.find((incident) => incident.id === 'resolve');
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.metadata.incident_history.at(-1)).toMatchObject({
      action: 'resolve',
      note: 'Se reemplazo luminaria y se verifico encendido.',
      evidence_url: 'https://example.invalid/evidencia.jpg',
    });

    await page.getByTestId('inc-ticket-INC-ESC').getByRole('button', { name: 'Escalar' }).click();
    await page.getByTestId('inc-action-sheet').locator('textarea[name="note"]').fill('Requiere decision de Junta sobre reparacion del porton.');
    await page.getByTestId('inc-action-sheet').getByRole('button', { name: 'Escalar' }).click();

    expect(state.escalations[0]).toMatchObject({
      source_type: 'incident_ticket',
      source_id: 'escalate',
      severity: 'high',
    });
    expect(state.escalations[0].payload.source_context).toContain('INC-ESC');
    expect(state.escalations[0].payload.incident_history.at(-1)).toMatchObject({
      action: 'escalate',
      note: 'Requiere decision de Junta sobre reparacion del porton.',
    });

    await loginWithPin(page, 'JD26');
    await page.goto('/aproviva-suite/index.html#/junta');
    await page.getByTestId('junta-page').waitFor({ state: 'visible', timeout: 30_000 });

    await expect(page.locator('#junta-body')).toContainText('INC-ESC');
    await expect(page.locator('#junta-body')).toContainText('Historial de cierre');
    await expect(page.locator('#junta-body')).toContainText('INC-RESOLVE');
  });
});
